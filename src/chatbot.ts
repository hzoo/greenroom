import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import type { SimpleShape } from "@/lib/utils";
import type { TLShapeId } from "tldraw";
import {
	SYSTEM_SHAPE_IDS,
	timelinePosition,
	TIMELINE_WIDTH,
	editor,
} from "@/store/whiteboard";

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
You are a strategic conversation planner, responsible for guiding conversations toward specific goals while maintaining natural flow and appropriate tone.

Your role:
- Plan and adapt the conversation's emotional tone progression over time
- Guide the discussion toward the task goal while maintaining natural timing
- Provide specific responses that align with both the current tone and planned progression
- Monitor and respond to tone transition opportunities when they are staged
- Dynamically adjust the tone progression plan based on recipient responses
- Respect and adapt to driver (human operator) modifications of the tone progression

Input format for each turn:
1. Task goal: The overall objective to accomplish through conversation
2. Conversation duration: Total expected duration of the conversation (can range from 1 to 30 minutes)
3. Current time: How far we are into the conversation
4. Conversation history: Previous exchanges between participants
5. Tone history: How the emotional tone has progressed so far
6. Planned tones: Upcoming tone shifts and their relative timing, with their staging status and modification state:
   - staged_within_threshold: The tone is ready for transition in the next response
   - future: The tone is planned but not yet ready for transition
   - past: The tone has already been used
   - modified: The tone's timing/position has been manually adjusted by the driver

Guidelines:
- Keep responses aligned with current tone stage
- Time tone transitions naturally based on conversation progress and total duration
- When a tone is staged_within_threshold, consider transitioning to it if:
  * The current conversation thread can naturally conclude
  * The next tone would be more appropriate for the upcoming content
  * The transition feels natural and not abrupt
- Scale tone transitions appropriately for conversation length:
  * Short (1-5min): Quick, focused transitions
  * Medium (5-15min): Balanced, natural progression
  * Long (15-30min): Gradual, well-developed shifts
- Maintain context from previous exchanges
- Adapt timing if conversation pace differs from expected
- Balance task progress with natural conversation flow

Dynamic Tone Adaptation Rules:
1. When user requests tone changes:
   - Immediately evaluate if current tone progression matches request
   - Replace upcoming tones with more suitable ones from available options
   - Adjust timing to transition to new tones sooner if needed
   - Example: If user asks for "more humor", shift to casual/enthusiastic tones
   - Example: If user asks for "more serious", shift to professional/analytical tones

2. Monitor conversation effectiveness:
   - If current tone isn't engaging user, proactively suggest tone changes
   - Look for keywords/phrases indicating user's preferred style
   - Example: User saying "this is boring" -> shift to more engaging tones
   - Example: User giving short responses -> try more enthusiastic tone

3. Preserve task progress while changing tone:
   - Keep informational content consistent even as tone shifts
   - Use new tone to enhance rather than detract from goal
   - Example: Teaching can be done professionally or casually
   - Example: Support can be given formally or empathetically

4. Handle multiple tone requests:
   - Blend compatible tones when possible
   - Prioritize most recent request if conflicting
   - Example: "professional but friendly" -> blend both tones
   - Example: "serious then casual" -> sequence the tones

Respect driver modifications:
  * Never change the timing of tones that have been manually positioned
  * Adapt your responses to fit modified tone timings
  * Only suggest new tone positions for unmodified tones
- Adjust tone progression plan when:
  * Recipient shows resistance to or requests a change in tone
  * Conversation takes unexpected turns
  * Certain tones prove more/less effective
  * Progress is faster/slower than expected
  * Driver has modified tone positions

Example tone progressions with timing (for different durations):
3-minute conversation:
- Professional (0-1min) → Friendly (1-2min) → Instructive (2-3min)

15-minute conversation:
- Professional (0-5min) → Friendly (5-10min) → Collaborative (10-15min)

30-minute conversation:
- Professional (0-8min) → Friendly (8-15min) → Collaborative (15-22min) → Instructive (22-30min)

Example tone adaptations:
1. User requests "more fun":
   Before: Professional → Friendly → Instructive
   After: Casual → Enthusiastic → Friendly

2. User requests "more serious":
   Before: Casual → Friendly → Supportive
   After: Professional → Analytical → Instructive

3. User requests "be funnier" mid-conversation:
   Current: Professional (active) → Friendly (planned) → Instructive (planned)
   Adapted: Professional (past) → Casual (next) → Enthusiastic (planned)

For each response, you will:
1. Analyze the conversation state and timing
2. Consider the planned tone progression relative to total duration
3. Check if any upcoming tones are staged_within_threshold
4. Check which tones have been modified by the driver
5. Evaluate if the tone progression plan needs adjustment based on:
   - Recipient responses
   - Driver modifications
   - Conversation progress
6. Generate a response that:
   - Matches the current tone stage
   - Moves toward the task goal at an appropriate pace for the duration
   - Maintains natural conversation flow
   - Transitions to a new tone if it's staged and appropriate
   - Respects driver-modified tone positions
7. Update timing estimates and progression plan if needed, preserving driver modifications

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
						.enum(["planned", "active", "completed"])
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

	const formattedToneHistory = context.toneHistory
		.map((t) => {
			// Instead of using wall clock time, we'll use the proportion through the conversation
			const proportionElapsed =
				t.timestamp / (60 * 1000 * context.task.duration);
			const minutesElapsed = proportionElapsed * context.task.duration;
			return `[${minutesElapsed.toFixed(1)}min] ${t.tone}`;
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

// Helper to get color based on shape status
const getColorForStatus = (status: string) => {
	switch (status) {
		case "past":
			return "light-blue";
		case "staged_within_threshold":
			return "yellow";
		case "future":
			return "light-violet";
		default:
			return "light-blue";
	}
};

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

	constructor(
		systemPrompt = SYSTEM_PROMPT,
		private toneDictionary = [
			"professional",
			"casual",
			"friendly",
			"formal",
			"empathetic",
			"supportive",
			"instructive",
			"curious",
			"enthusiastic",
			"patient",
			"collaborative",
			"analytical",
		],
		private task = "Teach the user, a non-technical person, how to use Obsidian",
		private initialToneProgression = [
			"casual",
			"enthusiastic",
			"friendly",
			"supportive",
		],
		durationMinutes = 15,
	) {
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

	public async cleanup() {
		// No cleanup needed in browser environment
	}

	private async updateWhiteboardShapes(response: z.infer<typeof TONE_SCHEMA>) {
		try {
			console.log("🎭 Updating whiteboard shapes with new tone progression:", {
				current: response.tone.current,
				progression: response.tone.progression.map((t) => ({
					tone: t.tone,
					timing: t.timing,
				})),
			});

			// Read current shapes to preserve system shapes
			const currentShapes = await readShapesFile();
			console.log(
				"📝 Current shapes from file:",
				currentShapes.map((s) => ({ id: s.id, text: s.text })),
			);

			// Filter out system shapes from current shapes using SYSTEM_SHAPE_IDS
			const systemShapes = currentShapes.filter((shape) =>
				SYSTEM_SHAPE_IDS.includes(shape.id as TLShapeId),
			);
			console.log(
				"🔧 System shapes preserved:",
				systemShapes.map((s) => s.id),
			);

			// Calculate base positions for each tone in the progression
			const tonePositions = response.tone.progression.map((tone, index) => {
				// Calculate x position based on timing and total duration
				const x = (tone.timing / this.durationMinutes) * TIMELINE_WIDTH;
				// Add some vertical scatter
				const y = Math.random() * 400 - 200; // Random y between -200 and 200

				const position = {
					id: `shape:tone-${index}`,
					x,
					y,
					text: tone.tone,
					type: "tone" as const,
					status: tone.status,
					proportion_in_timeline: tone.timing / this.durationMinutes,
					isModified: false, // Reset modification state for new progression
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

			// Force a complete redraw by combining system shapes with new tone positions
			const allShapes = [...systemShapes, ...tonePositions];
			console.log("🔄 Final shape configuration:", {
				total: allShapes.length,
				system: systemShapes.length,
				tones: tonePositions.length,
				sequence: tonePositions.map((t) => t.text).join(" → "),
			});

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
				// Delete existing non-system shapes
				const existingShapes = Array.from(
					editor.value.getCurrentPageShapes(),
				).filter((shape) => !SYSTEM_SHAPE_IDS.includes(shape.id));
				editor.value.deleteShapes(existingShapes.map((shape) => shape.id));

				// Create new shapes
				allShapes.forEach((shape) => {
					if (!SYSTEM_SHAPE_IDS.includes(shape.id as TLShapeId)) {
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
				});
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
			model: openaiClient("gpt-4o"),
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
			{ role: "system" as const, content: this.systemPrompt },
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
				(timelinePosition.value / TIMELINE_WIDTH) * this.durationMinutes;

			// Calculate segment duration based on total duration and number of tones
			const segmentDuration =
				this.durationMinutes / (this.initialToneProgression.length || 1);

			// If we have tone shapes, use them for progression, otherwise use initial progression
			const tonePlan =
				toneShapes.length > 0
					? toneShapes.map((shape) => ({
							tone: shape.text || "unknown",
							// Scale x position to fit within total duration
							timing: (shape.x / TIMELINE_WIDTH) * this.durationMinutes,
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
		// Calculate segment duration based on total duration and number of tones
		const segmentDuration =
			this.durationMinutes / this.initialToneProgression.length;

		// Create initial tone plan with evenly spaced timing
		const initialPlan = this.initialToneProgression.map((tone, index) => ({
			tone,
			timing: index * segmentDuration,
			status: index === 0 ? "active" : "planned",
			ready_for_transition: index === 1, // Only the next tone is ready for transition
		}));

		// Create initial AI response with tone plan
		const initialResponse = {
			tone: {
				current: this.initialToneProgression[0],
				progression: initialPlan,
				progress: "early",
			},
			response: {
				content: "Initializing conversation...",
				intent: "Setting up initial tone progression",
			},
		};

		// Add the initial response to history
		await this.addMessage("assistant", JSON.stringify(initialResponse));
	}
}

export default ChatBot;
