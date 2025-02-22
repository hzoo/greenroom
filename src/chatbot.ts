import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import type { SimpleShape } from "@/lib/utils";

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

const TIMELINE_WIDTH = 5000;

interface ChatMessage {
	role: "user" | "assistant" | "system";
	content: string;
	timestamp: number;
}

interface ShapesData {
	shapes: SimpleShape[];
	timelinePosition: number;
}

async function readShapesFile(): Promise<ShapesData> {
	try {
		const shapesFile = Bun.file("shapes.json");
		if (await shapesFile.exists()) {
			const data = await shapesFile.json();
			return {
				shapes: data.shapes || [],
				timelinePosition: data.timelinePosition || 0,
			};
		}
	} catch (error) {
		console.error("Error reading shapes:", error);
	}
	return { shapes: [], timelinePosition: 0 };
}

const SYSTEM_PROMPT = `
You are a strategic conversation planner, responsible for guiding conversations toward specific goals while maintaining natural flow and appropriate tone.

Your role:
- Plan and adapt the conversation's emotional tone progression over time
- Guide the discussion toward the task goal while maintaining natural timing
- Provide specific responses that align with both the current tone and planned progression
- Monitor and respond to tone transition opportunities when they are staged
- Dynamically adjust the tone progression plan based on recipient responses

Input format for each turn:
1. Task goal: The overall objective to accomplish through conversation
2. Conversation duration: Total expected duration of the conversation (can range from 1 to 30 minutes)
3. Current time: How far we are into the conversation
4. Conversation history: Previous exchanges between participants
5. Tone history: How the emotional tone has progressed so far
6. Planned tones: Upcoming tone shifts and their relative timing, with their staging status:
   - staged_within_threshold: The tone is ready for transition in the next response
   - future: The tone is planned but not yet ready for transition
   - past: The tone has already been used

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
- Adjust tone progression plan when:
  * Recipient shows resistance to current tone
  * Conversation takes unexpected turns
  * Certain tones prove more/less effective
  * Progress is faster/slower than expected

Example tone progressions with timing (for different durations):
3-minute conversation:
- Professional (0-1min) → Friendly (1-2min) → Instructive (2-3min)

15-minute conversation:
- Professional (0-5min) → Friendly (5-10min) → Collaborative (10-15min)

30-minute conversation:
- Professional (0-8min) → Friendly (8-15min) → Collaborative (15-22min) → Instructive (22-30min)

For each response, you will:
1. Analyze the conversation state and timing
2. Consider the planned tone progression relative to total duration
3. Check if any upcoming tones are staged_within_threshold
4. Evaluate if the tone progression plan needs adjustment based on recipient responses
5. Generate a response that:
   - Matches the current tone stage
   - Moves toward the task goal at an appropriate pace for the duration
   - Maintains natural conversation flow
   - Transitions to a new tone if it's staged and appropriate
6. Update timing estimates and progression plan if needed

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
}
`;

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

	// Read shapes from shapes.json to get staging status
	const { shapes: shapeTones } = await readShapesFile();

	const formattedTonePlan = context.nextTonePlan
		.map((t) => {
			// Find corresponding shape to get staging status and timing
			const shape = shapeTones.find((s) => s.text === t.tone);
			const status = shape?.status || "future";

			// Convert proportion to minutes based on total duration
			const timeInMinutes = shape?.proportion_in_timeline
				? (shape.proportion_in_timeline * context.task.duration).toFixed(1)
				: t.timing.toFixed(1);

			const statusIndicator =
				status === "staged_within_threshold" ? " (STAGED)" : "";
			const timeDisplay =
				shape?.proportion_in_timeline !== undefined
					? `at ${timeInMinutes}min (${(shape.proportion_in_timeline * 100).toFixed(1)}% through conversation)`
					: `at ${timeInMinutes}min`;

			return `- ${t.tone} (${timeDisplay})${statusIndicator}`;
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
	private historyFile: string;
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
		historyPath = ".chat_history.json",
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
			"professional",
			"friendly",
			"collaborative",
			"instructive",
		],
		durationMinutes = 15, // Default 15 minutes, can be as short as 1 or as long as 30
	) {
		const apiKey = process.env.OPENAI_API_KEY;
		if (!apiKey) {
			throw new Error("OPENAI_API_KEY environment variable is required");
		}

		if (durationMinutes < 1 || durationMinutes > 30) {
			throw new Error("Duration must be between 1 and 30 minutes");
		}

		this.durationMinutes = durationMinutes;
		this.historyFile = historyPath;
		this.systemPrompt = systemPrompt;

		// Initialize the context with default values
		this.context.task.goal = this.task;
		this.context.task.duration = this.durationMinutes;

		// Initialize asynchronously
		this.initialize();
	}

	private async initialize() {
		await this.loadHistory();
		await this.updateContext();
	}

	private async loadHistory() {
		try {
			const historyFile = Bun.file(this.historyFile);
			if (await historyFile.exists()) {
				const content = await historyFile.text();
				this.history = JSON.parse(content) || [];
			}
		} catch (error) {
			console.error("Error loading chat history:", error);
			this.history = [];
		}
	}

	private async saveHistory() {
		try {
			await Bun.write(this.historyFile, JSON.stringify(this.history, null, 2));
		} catch (error) {
			console.error("Error saving chat history:", error);
		}
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
			const { shapes: shapeTones, timelinePosition: currentPosition } =
				await readShapesFile();

			// Filter out shapes without text (they're not tone markers)
			const toneShapes = shapeTones.filter((shape) => shape.text);

			// Calculate elapsed time based on timeline position
			// Convert timeline position to minutes
			const elapsed = (currentPosition / TIMELINE_WIDTH) * this.durationMinutes;

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

	async addMessage(role: "user" | "assistant" | "system", content: string) {
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

		// Update context and format for next turn
		await this.updateContext();
		await this.saveHistory();
	}

	async getAIResponse(): Promise<z.infer<typeof TONE_SCHEMA> | undefined> {
		const messages = await this.formatMessagesForAI();
		const result = await generateObject({
			model: openai("gpt-4o"),
			messages,
			schema: TONE_SCHEMA,
		});

		return result.object;
	}

	private formatTimestamp(timestamp: number): string {
		return new Date(timestamp).toLocaleTimeString();
	}

	private printSystemMessage(message: string) {
		console.log(`${colors.dim}${message}${colors.reset}`);
	}

	private printUserMessage(content: string, timestamp: number) {
		console.log(
			`${colors.gray}[${this.formatTimestamp(timestamp)}] ${colors.cyan}You: ${colors.reset}${content}`,
		);
	}

	private printAssistantMessage(content: string, timestamp: number) {
		console.log(
			`${colors.gray}[${this.formatTimestamp(timestamp)}] ${colors.green}Bot: ${colors.reset}${content}`,
		);
	}

	private printDebugObject(label: string, obj: unknown) {
		console.log(
			`\n${colors.blue}=== ${label} ===${colors.reset}\n${colors.dim}${
				typeof obj === "string" ? obj : JSON.stringify(obj, null, 2)
			}${colors.reset}\n`,
		);
	}

	async start() {
		console.clear();
		console.log(
			`${colors.bright}Welcome to ChatBot!${colors.reset}\n${colors.dim}Type 'exit' to quit or 'history' to see chat history.${colors.reset}\n`,
		);

		// Ensure initialization is complete
		await this.initialize();

		// Handle Ctrl+C
		process.on("SIGINT", () => {
			console.log("\nReceived SIGINT. Shutting down...");
			process.exit(0);
		});

		// Add initial system message
		if (this.history.length === 0) {
			await this.addMessage("system", this.systemPrompt);
		}

		try {
			// Use Bun's console API for reading input
			for await (const line of console) {
				const userInput = line.trim();

				if (userInput.toLowerCase() === "exit") {
					this.printSystemMessage("\nGoodbye!");
					break;
				}

				if (userInput.toLowerCase() === "history") {
					this.displayHistory();
					process.stdout.write(`${colors.yellow}>>${colors.reset} `);
					continue;
				}

				// Add and display user message
				await this.addMessage("user", userInput);
				this.printUserMessage(userInput, Date.now());

				// Ensure context is updated before printing
				await this.updateContext();
				// Print current context
				const currentContext = await formatContext(this.context);
				this.printDebugObject("Current Context", currentContext);

				// Get AI response
				this.printSystemMessage("Bot is thinking...");
				const response = await this.getAIResponse();

				// Print raw response
				this.printDebugObject("AI Response Object", response);

				if (!response) {
					this.printSystemMessage("No response from AI");
					continue;
				}

				// Display formatted response
				this.printAssistantMessage(response.response.content, Date.now());
				await this.addMessage("assistant", response.response.content);

				// Print prompt for next input
				process.stdout.write(`${colors.yellow}>>${colors.reset} `);
			}
		} finally {
			// Clean up and exit
			process.exit(0);
		}
	}

	displayHistory() {
		if (this.history.length === 0) {
			this.printSystemMessage("No chat history yet.");
			return;
		}

		console.log(`\n${colors.bright}Chat History:${colors.reset}`);
		this.history.forEach((msg) => {
			switch (msg.role) {
				case "user":
					this.printUserMessage(msg.content, msg.timestamp);
					break;
				case "assistant":
					this.printAssistantMessage(msg.content, msg.timestamp);
					break;
				case "system":
					this.printSystemMessage(msg.content);
					break;
			}
		});
		console.log();
	}
}

// Export the ChatBot class for use in other files
export default ChatBot;

// Add a main function to run the chat bot directly
if (import.meta.main) {
	const bot = new ChatBot();
	bot.start();
}
