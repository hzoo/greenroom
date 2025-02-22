import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

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

const SYSTEM_PROMPT = `
You are a strategic conversation planner, responsible for guiding conversations toward specific goals while maintaining natural flow and appropriate tone.

Your role:
- Plan and adapt the conversation's emotional tone progression
- Guide the discussion toward the task goal while remaining natural
- Provide specific responses that align with both the tone plan and goal

Input format for each turn:
1. Task goal: The overall objective to accomplish through conversation
2. Conversation history: Previous exchanges between participants
3. Tone history: How the emotional tone has progressed so far
4. Next tone plan: Planned progression of emotional tones to achieve the goal

Guidelines:
- Keep responses aligned with current tone stage
- Progress naturally between tone stages
- Maintain context from previous exchanges
- Adapt tone plan if conversation takes unexpected turns
- Balance task progress with natural conversation flow

Example tone progressions:
- Professional → Friendly → Collaborative
- Curious → Understanding → Supportive
- Formal → Casual → Instructive

For each response, you will:
1. Analyze the conversation state
2. Consider the planned tone progression
3. Generate a response that:
   - Matches the current tone stage
   - Moves toward the task goal
   - Maintains natural conversation flow
4. Update the tone plan if needed

Output format:
{
  "tone": {
    "current": "current emotional tone",
    "next": "planned next tone shift",
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
		next: z.string().describe("planned next tone shift"),
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
	};
	nextTonePlan: {
		tone: string;
		trigger: string;
	}[];
};

function formatContext(context: Context): string {
	const formattedHistory = context.conversationHistory
		.filter((msg) => msg.role !== "system")
		.map((msg) => `${msg.role}: ${msg.content}`)
		.join("\n");

	const formattedToneHistory = context.toneHistory
		.map((t) => `[${new Date(t.timestamp).toISOString()}] ${t.tone}`)
		.join("\n");

	const formattedTonePlan = context.nextTonePlan
		.map((t) => `- ${t.tone} (Trigger: ${t.trigger})`)
		.join("\n");

	return `
## Task
Goal: ${context.task.goal}
Progress: ${Math.round(context.task.progress * 100)}%

## Conversation History
${formattedHistory}

## Tone Progression
Current tones:
${formattedToneHistory}

Planned progression:
${formattedTonePlan}
`.trim();
}

class ChatBot {
	private historyFile: string;
	private history: ChatMessage[] = [];
	private systemPrompt: string;
	private currentToneIndex = 0;
	private toneHistory: { tone: string; timestamp: number }[] = [];
	private context: Context;

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
	) {
		const apiKey = process.env.OPENAI_API_KEY;
		if (!apiKey) {
			throw new Error("OPENAI_API_KEY environment variable is required");
		}

		this.historyFile = historyPath;
		this.systemPrompt = systemPrompt;
		this.loadHistory();

		// Initialize context
		this.context = {
			conversationHistory: this.history,
			toneHistory: this.toneHistory,
			task: {
				goal: this.task,
				progress: 0,
			},
			nextTonePlan: this.initialToneProgression.map((tone, index) => ({
				tone,
				trigger: index === 0 ? "conversation start" : "natural progression",
			})),
		};
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

	private formatMessagesForAI() {
		// Format the current context as a user message
		const contextMessage = {
			role: "user" as const,
			content: formatContext(this.context),
		};

		return [
			{ role: "system" as const, content: this.systemPrompt },
			contextMessage,
		];
	}

	private updateContext() {
		this.context = {
			conversationHistory: this.history,
			toneHistory: this.toneHistory,
			task: {
				goal: this.task,
				progress: Math.min(
					this.currentToneIndex / (this.initialToneProgression.length - 1),
					1,
				),
			},
			nextTonePlan: this.initialToneProgression
				.slice(this.currentToneIndex)
				.map((tone, index) => ({
					tone,
					trigger: index === 0 ? "current stage" : "natural progression",
				})),
		};
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

				// Update tone progression if needed
				if (
					parsed.tone.progress === "late" &&
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
		this.updateContext();
		await this.saveHistory();
	}

	async getAIResponse(): Promise<z.infer<typeof TONE_SCHEMA> | undefined> {
		const result = await generateObject({
			model: openai("gpt-4o"),
			messages: this.formatMessagesForAI(),
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

				// Print current context
				this.printDebugObject("Current Context", formatContext(this.context));

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
