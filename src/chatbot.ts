import { $ } from "bun";
import OpenAI from "openai";

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

class ChatBot {
	private historyFile: string;
	private history: ChatMessage[] = [];
	private openai: OpenAI;
	private systemPrompt: string;

	constructor(
		historyPath: string = ".chat_history.json",
		systemPrompt: string = "You are a helpful assistant.",
	) {
		const apiKey = process.env.OPENAI_API_KEY;
		if (!apiKey) {
			throw new Error("OPENAI_API_KEY environment variable is required");
		}

		this.openai = new OpenAI({
			apiKey: apiKey,
		});

		this.historyFile = historyPath;
		this.systemPrompt = systemPrompt;
		this.loadHistory();
	}

	private async loadHistory() {
		try {
			const historyFile = Bun.file(this.historyFile);
			if (await historyFile.exists()) {
				const content = await historyFile.text();
				this.history = JSON.parse(content);
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

	private formatMessagesForOpenAI() {
		return [
			{ role: "system", content: this.systemPrompt },
			...this.history.map((msg) => ({
				role: msg.role,
				content: msg.content,
			})),
		] as const;
	}

	async addMessage(role: "user" | "assistant" | "system", content: string) {
		const message: ChatMessage = {
			role,
			content,
			timestamp: Date.now(),
		};
		this.history.push(message);
		await this.saveHistory();
	}

	async getAIResponse(userInput: string): Promise<string> {
		try {
			const completion = await this.openai.chat.completions.create({
				messages: this.formatMessagesForOpenAI(),
				model: "gpt-3.5-turbo",
			});

			return completion.choices[0]?.message?.content || "No response generated";
		} catch (error) {
			console.error("Error getting AI response:", error);
			return "Sorry, I encountered an error processing your request.";
		}
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

	async start() {
		console.clear();
		console.log(
			`${colors.bright}Welcome to ChatBot!${colors.reset}\n${colors.dim}Type 'exit' to quit or 'history' to see chat history.${colors.reset}\n`,
		);

		// Add initial system message
		if (this.history.length === 0) {
			await this.addMessage("system", this.systemPrompt);
		}

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

			// Get AI response
			this.printSystemMessage("Bot is thinking...");
			const response = await this.getAIResponse(userInput);
			this.printAssistantMessage(response, Date.now());
			await this.addMessage("assistant", response);

			// Print prompt for next input
			process.stdout.write(`${colors.yellow}>>${colors.reset} `);
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
