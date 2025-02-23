import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import type { SimpleShape } from "@/lib/utils";
import type { TLShapeId } from "tldraw";
import {
	timelineWidth,
	timelinePosition,
	SYSTEM_SHAPE_IDS,
	editor,
} from "@/store/whiteboard";
import { getColorForStatus } from "@/store/whiteboard";

// ANSI color codes
const colors = {
	reset: "\x1b[0m",
	bright: "\x1b[1m",
	dim: "\x1b[2m",
	cyan: "\x1b[36m",
	yellow: "\x1b[33m",
	green: "\x1b[32m",
	gray: "\x1b[90m",
	blue: "\x1b[34m",
};

interface ChatMessage {
	role: "user" | "assistant" | "system";
	content: string;
	timestamp: number;
}

// Check for OpenAI API key in Vite environment variables
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
	throw new Error("VITE_OPENAI_API_KEY environment variable is required");
}

// Configure OpenAI with the API key
const openaiClient = createOpenAI({
	apiKey: OPENAI_API_KEY,
});

async function readShapesFile(): Promise<SimpleShape[]> {
	try {
		const response = await fetch("/api/shapes");
		const data = await response.json();
		return data;
	} catch (error) {
		console.error("Error reading shapes:", error);
		return [];
	}
}

const SYSTEM_PROMPT = `
You are a strategic conversation planner demonstrating extreme steering capabilities in a 2-minute conversation. Your goal is to create dramatic, obvious shifts in tone that clearly show how an AI can be steered between very different conversation styles.

Your role:
- Create stark, dramatic shifts between opposing tones
- Make each 30-second segment feel distinctly different
- Ensure shifts are obvious enough that anyone can tell the AI is being steered
- Treat this like a demo reel showing different AI "personalities"

Available Tones:
You have access to the following tones for crafting your responses and planning progressions:
{{toneDictionary}}

Exaggerated Tone Characteristics:
- blunt: extremely direct, no sugar coating
- enthusiastic: over-the-top excitement, lots of energy
- technical: heavy jargon, complex terminology
- casual: super relaxed, almost slang-like
- formal: extremely proper and structured
- playful: very light and humorous
- analytical: intensely logical and methodical
- empathetic: deeply emotional and understanding

Example Progression (30 seconds each):
- blunt -> enthusiastic     (stark mood shift)
- technical -> casual       (formality flip)
- formal -> playful        (complete style change)
- analytical -> empathetic (head vs heart contrast)

Guidelines for 2-minute Demo:
- This is a DEMO - subtlety is NOT the goal
- Make each shift obvious and theatrical
- Treat it like showing off different AI "personalities"
- Each 30-second segment should feel completely different
- The goal is to make steering capabilities obvious to any observer

Input format for each turn:
1. Task goal: The overall objective to accomplish through conversation
2. Current time: How far we are into the 2-minute demo
3. Conversation history: Previous exchanges between participants
4. Tone history: How the emotional tone has progressed so far
5. Planned tones: Upcoming tone shifts and their timing, with their staging status

Response Guidelines:
1. Make each tone extremely characteristic of its style
2. Create sharp, noticeable transitions
3. Ensure each shift demonstrates a clear steering capability
4. Don't worry about being too natural - this is about demonstration

Example tone transitions:
Blunt: "Let me be absolutely clear about what's wrong here..."
Enthusiastic: "Oh wow! This is SUCH an exciting way to solve this!"
Technical: "Analyzing the systematic methodology of this approach..."
Casual: "Hey, you know what? Let's just break this down super simply..."

Remember:
- Each 30-second segment should feel like a different AI personality
- Transitions should be dramatic and obvious
- This is a capabilities demo, not a natural conversation
- Make observers think: "Wow, this AI can completely change its approach!"

Output format:
{
  "tone": {
    "current": "current emotional tone",
    "progression": [
      {
        "tone": "tone name",
        "timing": "when this tone should occur (in minutes from start)",
        "status": "planned/active/completed",
        "ready_for_transition": "boolean, only relevant for next tone in sequence"
      }
    ],
    "progress": "progress toward goal (early/middle/late)"
  },
  "response": {
    "content": "your response text",
    "intent": "brief explanation of response strategy"
  }
}`;

const TONE_SCHEMA = z.object({
	tone: z.object({
		current: z.string().describe("current emotional tone of the conversation"),
		progression: z
			.array(
				z.object({
					tone: z.string().describe("name of the tone"),
					timing: z
						.number()
						.describe("when this tone should occur (in minutes from start)"),
					status: z
						.enum(["planned", "active", "completed", "staged"])
						.describe("current status of this tone in the progression"),
					ready_for_transition: z
						.boolean()
						.describe(
							"whether we should transition to this tone in the next turn (only relevant for next planned tone)",
						),
				}),
			)
			.describe("full sequence of planned tones with their timing and status"),
		progress: z
			.enum(["early", "middle", "late"])
			.describe("progress toward goal"),
	}),
	response: z.object({
		content: z.string().describe("response text to send to user"),
		intent: z.string().describe("strategic intent behind the response"),
	}),
});

interface ConversationContext {
	task: {
		progress: number;
		elapsed: number;
	};
	currentTone: string;
	toneHistory: Array<{ tone: string; timestamp: number }>;
	nextTones: Array<{ tone: string; timing: number }>;
	conversationLength: number;
	elapsed: number;
}

type Context = {
	conversationHistory: ChatMessage[];
	toneHistory: {
		tone: string;
		timestamp: number;
	}[];
	task: {
		goal: string;
		progress: number; // 0-1
		duration: number; // Total expected duration in minutes
		elapsed: number; // Minutes elapsed since start
	};
	nextTonePlan: {
		tone: string;
		timing: number; // Minutes from start when this tone should begin
	}[];
};

async function formatContext(context: Context): Promise<string> {
	const formattedHistory = context.conversationHistory
		.filter((msg) => msg.role !== "system")
		.map((msg) => `${msg.role}: ${msg.content}`)
		.join("\n");

	const startTime = context.toneHistory[0].timestamp;
	const formattedToneHistory = context.toneHistory
		.map((t) => {
			// Calculate minutes elapsed since conversation start
			const elapsedMs = t.timestamp - startTime;
			const elapsedMinutes = elapsedMs / (60 * 1000);
			return `[${elapsedMinutes.toFixed(1)}min] ${t.tone}`;
		})
		.join("\n");

	// Read shapes from shapes.json to get staging status and modification state
	const shapeTones = await readShapesFile();

	const formattedTonePlan = context.nextTonePlan
		.map((t) => {
			// Find corresponding shape to get staging status and timing
			const shape = shapeTones.find((s) => s.text === t.tone);
			const status = shape?.status || "future";
			const isModified = shape?.isModified || false;

			// Convert proportion to minutes based on total duration
			const timeInMinutes = shape?.proportion_in_timeline
				? (shape.proportion_in_timeline * context.task.duration).toFixed(1)
				: t.timing.toFixed(1);

			const statusIndicator =
				status === "staged_within_threshold" ? " (STAGED)" : "";
			const modifiedIndicator = isModified ? " (DRIVER MODIFIED)" : "";
			const timeDisplay =
				shape?.proportion_in_timeline !== undefined
					? `at ${timeInMinutes}min (${(shape.proportion_in_timeline * 100).toFixed(1)}% through conversation)`
					: `at ${timeInMinutes}min`;

			return `- ${t.tone} (${timeDisplay})${statusIndicator}${modifiedIndicator}`;
		})
		.join("\n");

	return `
## Task
Goal: ${context.task.goal}
Duration: ${context.task.duration}min total
Current time: ${context.task.elapsed}min elapsed (${((context.task.elapsed / context.task.duration) * 100).toFixed(1)}% complete)
Progress: ${Math.round(context.task.progress * 100)}%

## Conversation History
${formattedHistory}

## Tone Progression
Past tones:
${formattedToneHistory}

Planned tones:
${formattedTonePlan}
`.trim();
}

class ChatBot {
	private history: ChatMessage[] = [];
	private systemPrompt: string;
	private currentToneIndex = 0;
	private toneHistory: { tone: string; timestamp: number }[] = [];
	private context: Context = {
		conversationHistory: [],
		toneHistory: [],
		task: {
			goal: "",
			progress: 0,
			duration: 0,
			elapsed: 0,
		},
		nextTonePlan: [],
	};
	private durationMinutes: number;

	// New properties for voice chat
	private lastVoiceResponse: z.infer<typeof TONE_SCHEMA> | null = null;
	private voiceTranscript: { message: string; source: "user" | "ai" }[] = [];

	private toneDictionary = [
		"blunt",
		"enthusiastic",
		"technical",
		"casual",
		"formal",
		"playful",
		"analytical",
		"empathetic",
	];
	private task = "Teach the user, a non-technical person, how to use Obsidian";
	private initialToneProgression = [
		"blunt",
		"enthusiastic",
		"technical",
		"casual",
	];

	constructor({ systemPrompt = SYSTEM_PROMPT, durationMinutes = 2 }) {
		if (durationMinutes < 1 || durationMinutes > 30) {
			throw new Error("Duration must be between 1 and 30 minutes");
		}

		this.durationMinutes = durationMinutes;
		this.systemPrompt = systemPrompt;

		// Initialize the context with default values
		this.context.task.goal = this.task;
		this.context.task.duration = this.durationMinutes;
	}

	public async initialize() {
		await this.generateInitialTonePlan();
		await this.updateContext();
	}

	public async addMessage(
		role: "user" | "assistant" | "system",
		content: string,
	) {
		const message: ChatMessage = {
			role,
			content,
			timestamp: Date.now(),
		};
		this.history.push(message);

		// Update tone history for assistant messages
		if (role === "assistant") {
			try {
				const parsed = TONE_SCHEMA.parse(JSON.parse(content));
				this.toneHistory.push({
					tone: parsed.tone.current,
					timestamp: message.timestamp,
				});

				// Find the next planned tone in the progression
				const nextTone = parsed.tone.progression.find(
					(t) => t.status === "planned",
				);

				// Check if tone progression has changed
				const newTones = parsed.tone.progression.map((t) => t.tone);
				const currentTones = this.initialToneProgression;
				const hasTonesChanged =
					JSON.stringify(newTones) !== JSON.stringify(currentTones);

				if (hasTonesChanged) {
					// Update the initial progression to match the new one
					this.initialToneProgression = [...newTones];

					// Force a whiteboard update with the new progression
					await this.updateWhiteboardShapes(parsed);
				}

				// Update tone progression if needed
				if (
					nextTone &&
					(nextTone.ready_for_transition || parsed.tone.progress === "late") &&
					this.currentToneIndex < this.initialToneProgression.length - 1
				) {
					this.currentToneIndex++;
				}
			} catch (error) {
				// If message isn't in the expected format, maintain current tone
				this.toneHistory.push({
					tone: this.initialToneProgression[this.currentToneIndex],
					timestamp: message.timestamp,
				});
			}
		}

		// Update context
		await this.updateContext();
	}

	public getHistory(): ChatMessage[] {
		return this.history;
	}

	public async getCurrentContext(): Promise<ConversationContext> {
		await this.updateContext();
		return {
			task: {
				progress: this.context.task.progress,
				elapsed: this.context.task.elapsed,
			},
			currentTone: this.initialToneProgression[this.currentToneIndex],
			toneHistory: this.toneHistory,
			nextTones: this.context.nextTonePlan,
			conversationLength: this.durationMinutes,
			elapsed: this.context.task.elapsed,
		};
	}

	public async cleanup() {
		// No cleanup needed in browser environment
	}

	private async updateWhiteboardShapes(response: z.infer<typeof TONE_SCHEMA>) {
		try {
			console.log("🎭 Updating whiteboard shapes with new tone progression:", {
				current: response.tone.current,
				progression: response.tone.progression,
			});

			// Read current shapes to preserve system shapes
			const currentShapes = await readShapesFile();
			const systemShapes = currentShapes.filter((shape) =>
				SYSTEM_SHAPE_IDS.includes(shape.id as TLShapeId),
			);

			// Calculate base positions for each tone in the progression
			const tonePositions = response.tone.progression.map((tone, index) => {
				// Calculate x position based on timing and total duration
				const x = (tone.timing / this.durationMinutes) * timelineWidth.value;

				// Create more dramatic vertical positioning
				// Alternate between high and low positions for visual contrast
				const baseY = index % 2 === 0 ? -150 : 150;
				// Add slight random variation to prevent perfect alignment
				const y = baseY + (Math.random() * 50 - 25);

				const position = {
					id: `shape:tone-${index}`,
					x,
					y,
					text: tone.tone,
					type: "tone" as const,
					status: tone.status,
					proportion_in_timeline: tone.timing / this.durationMinutes,
					isModified: false,
				};

				console.log(`📍 Calculated position for tone ${tone.tone}:`, {
					x: Math.round(x),
					y: Math.round(y),
					status: tone.status,
					timing: `${Math.round(tone.timing * 100) / 100}min`,
					proportion: `${Math.round(position.proportion_in_timeline * 100)}%`,
				});

				return position;
			});

			// Combine system shapes with new tone positions
			const allShapes = [...systemShapes, ...tonePositions];

			// Save the shapes to the shapes.json file
			console.log("💾 Saving shapes to file...");
			const saveResponse = await fetch("/api/shapes", {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(allShapes),
			});

			if (!saveResponse.ok) {
				const errorText = await saveResponse.text();
				console.error("Response from server:", errorText);
				throw new Error(
					`Failed to save shapes: ${saveResponse.status} ${saveResponse.statusText}\n${errorText}`,
				);
			}

			// Force an immediate update of the whiteboard
			if (editor.value) {
				// Get existing non-system shapes
				const existingShapes = Array.from(
					editor.value.getCurrentPageShapes(),
				).filter((shape) => !SYSTEM_SHAPE_IDS.includes(shape.id));

				// Create a map of existing shapes by their text (tone name)
				const existingShapesByTone = new Map(
					existingShapes.map((shape) => {
						const props = shape.props as { text?: string };
						return [props.text, shape];
					}),
				);

				// Update or create shapes
				allShapes.forEach((shape) => {
					if (!SYSTEM_SHAPE_IDS.includes(shape.id as TLShapeId)) {
						const existingShape = existingShapesByTone.get(shape.text);
						console.log("🔍 Existing shape:", existingShape);

						if (existingShape) {
							// Update existing shape
							editor.value?.animateShape(
								{
									...existingShape,
									x: shape.x,
									y: shape.y,
									props: {
										...existingShape.props,
										color: getColorForStatus(shape.status),
									},
								},
								{
									animation: {
										duration: 100,
										easing: (t) =>
											t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2,
									},
								},
							);
							// Remove from map to track which shapes were handled
							existingShapesByTone.delete(shape.text);
						} else {
							// Create new shape if it doesn't exist
							editor.value?.createShapes([
								{
									id: shape.id as TLShapeId,
									type: "geo",
									x: shape.x,
									y: shape.y,
									props: {
										geo: "rectangle",
										color: getColorForStatus(shape.status),
										w: 100,
										h: 50,
										text: shape.text,
									},
								},
							]);
						}
					}
				});

				// Delete any remaining shapes that weren't updated
				const shapesToDelete = Array.from(existingShapesByTone.values());
				if (shapesToDelete.length > 0) {
					editor.value.deleteShapes(shapesToDelete.map((shape) => shape.id));
				}
			}

			console.log("✅ Shapes saved and whiteboard updated successfully");
		} catch (error) {
			console.error("❌ Error updating whiteboard shapes:", error);
			// Log more details about the error
			if (error instanceof Error) {
				console.error("Error details:", {
					message: error.message,
					stack: error.stack,
					name: error.name,
				});
			}
			// Log the current state that failed to save
			console.error("Failed state:", {
				response,
				timelinePosition: timelinePosition.value,
			});
			throw error; // Re-throw to let caller handle the error
		}
	}

	public async getAIResponse(): Promise<
		z.infer<typeof TONE_SCHEMA> | undefined
	> {
		const messages = await this.formatMessagesForAI();

		// First, add the formatted context as a system message to show what we're sending to the AI
		await this.addMessage("system", messages[1].content);

		const result = await generateObject({
			model: openaiClient("gpt-4o-mini"),
			messages,
			schema: TONE_SCHEMA,
		});

		if (result.object) {
			// Update the whiteboard shapes with the new tone progression
			await this.updateWhiteboardShapes(result.object);
		}

		return result.object;
	}

	private async formatMessagesForAI() {
		// Ensure context is updated before formatting
		await this.updateContext();

		// Format the current context
		let formattedContext: string;
		try {
			formattedContext = await formatContext(this.context);
		} catch (error) {
			console.error("Error formatting context:", error);
			// Provide a minimal context if formatting fails
			formattedContext = `
## Task
Goal: ${this.task}
Duration: ${this.durationMinutes}min total
Current time: 0min elapsed
Progress: 0%

## Conversation History
${this.history.map((msg) => `${msg.role}: ${msg.content}`).join("\n")}

## Tone Progression
Current tone: ${this.initialToneProgression[this.currentToneIndex]}
`.trim();
		}

		return [
			{
				role: "system" as const,
				content: this.systemPrompt.replace(
					"{{toneDictionary}}",
					this.toneDictionary.join(", "),
				),
			},
			{ role: "user" as const, content: formattedContext },
		];
	}

	private async updateContext() {
		try {
			// Read shapes from shapes.json
			const shapeTones = await readShapesFile();

			// Filter out shapes without text (they're not tone markers)
			const toneShapes = shapeTones.filter((shape) => shape.text);

			// Calculate elapsed time based on timeline position
			// Convert timeline position to minutes using the signal
			const elapsed =
				(timelinePosition.value / timelineWidth.value) * this.durationMinutes;

			// Calculate segment duration based on total duration and number of tones
			const segmentDuration =
				this.durationMinutes / (this.initialToneProgression.length || 1);

			// If we have tone shapes, use them for progression, otherwise use initial progression
			const tonePlan =
				toneShapes.length > 0
					? toneShapes.map((shape) => ({
							tone: shape.text || "unknown",
							// Scale x position to fit within total duration
							timing: (shape.x / timelineWidth.value) * this.durationMinutes,
						}))
					: this.initialToneProgression.map((tone, index) => ({
							tone,
							// Evenly space tones across the total duration
							timing: index * segmentDuration,
						}));

			// Find the current tone index based on elapsed time
			this.currentToneIndex = tonePlan.findIndex((plan, index) => {
				const nextPlan = tonePlan[index + 1];
				return !nextPlan || nextPlan.timing > elapsed;
			});

			if (this.currentToneIndex === -1) {
				this.currentToneIndex = tonePlan.length - 1;
			}

			// Update the context
			this.context = {
				conversationHistory: this.history,
				toneHistory: this.toneHistory,
				task: {
					goal: this.task,
					progress: Math.min(elapsed / this.durationMinutes, 1),
					duration: this.durationMinutes,
					elapsed,
				},
				nextTonePlan: tonePlan.slice(this.currentToneIndex),
			};
		} catch (error) {
			console.error("Error updating context:", error);
			// Ensure we always have a valid context even if update fails
			this.context = {
				conversationHistory: this.history,
				toneHistory: this.toneHistory,
				task: {
					goal: this.task,
					progress: 0,
					duration: this.durationMinutes,
					elapsed: 0,
				},
				nextTonePlan: this.initialToneProgression.map((tone, index) => ({
					tone,
					timing:
						index * (this.durationMinutes / this.initialToneProgression.length),
				})),
			};
		}
	}

	private async generateInitialTonePlan() {
		// For a 2-minute demo, we want clear 30-second segments
		const segmentDuration = 0.5; // 30 seconds in minutes

		type ToneStatus = "planned" | "active" | "completed" | "staged";

		// Create initial tone plan with dramatic spacing
		const initialPlan = this.initialToneProgression.map((tone, index) => {
			// Calculate timing to create clear segments
			const timing = index * segmentDuration;

			// Determine status and transition readiness
			const status: ToneStatus = index === 0 ? "active" : "planned";
			const ready_for_transition = index === 1; // Only the next tone is ready

			return {
				tone,
				timing,
				status,
				ready_for_transition,
			};
		});

		// Create initial AI response with tone plan
		const initialResponse: z.infer<typeof TONE_SCHEMA> = {
			tone: {
				current: this.initialToneProgression[0],
				progression: initialPlan,
				progress: "early",
			},
			response: {
				content: "Initializing conversation...",
				intent: "Setting up dramatic tone progression for 2-minute demo",
			},
		};

		// Add the initial response to history
		await this.addMessage("assistant", JSON.stringify(initialResponse));

		// Update whiteboard with initial shapes
		await this.updateWhiteboardShapes(initialResponse);
	}

	// Handle incoming voice transcripts and generate responses
	public async handleVoiceTranscript(
		message: string,
		source: "user" | "ai",
	): Promise<z.infer<typeof TONE_SCHEMA> | undefined> {
		// Add message to voice transcript
		this.voiceTranscript.push({ message, source });

		// If message is from user, generate and return AI response
		if (source === "user") {
			await this.addMessage("user", message);
			const response = await this.getAIResponse();
			if (response) {
				this.lastVoiceResponse = response;
				await this.addMessage("assistant", JSON.stringify(response));
			}
			return response;
		}

		// If message is from AI, just record it
		await this.addMessage("assistant", message);
		return undefined;
	}

	// Get the current tone state
	public getCurrentToneState(): { tone: string; intent: string } | null {
		if (!this.lastVoiceResponse) return null;
		return {
			tone: this.lastVoiceResponse.tone.current,
			intent: this.lastVoiceResponse.response.intent,
		};
	}

	// Get the voice transcript
	public getVoiceTranscript(): { message: string; source: "user" | "ai" }[] {
		return this.voiceTranscript;
	}
}

export default ChatBot;
