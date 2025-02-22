#!/usr/bin/env bun
import { $ } from "bun";
import { z } from "zod";

const TONE_DICTIONARY = [
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
];

async function createAgent(name: string, prompt: string) {
	const response = await fetch(
		"https://api.elevenlabs.io/v1/convai/agents/create",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"xi-api-key": process.env.XI_API_KEY!,
			},
			body: JSON.stringify({
				name,
				conversation_config: {
					agent: {
						prompt: {
							prompt,
							llm: "claude-3-5-sonnet",
						},
						first_message: "Hello! I'm your AI assistant.",
					},
				},
			}),
		},
	);

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Failed to create agent: ${error}`);
	}

	const data = await response.json();
	return data.agent_id;
}

async function main() {
	// Check for API key
	if (!process.env.XI_API_KEY) {
		console.error("Error: XI_API_KEY environment variable is required");
		process.exit(1);
	}

	// Get command line arguments
	const args = process.argv.slice(2);
	const name =
		args[0] ||
		(await new Response(
			await new Promise((resolve) => {
				process.stdout.write("Enter agent name: ");
				process.stdin.once("data", resolve);
			}),
		)
			.text()
			.then((t) => t.trim()));

	const tone =
		args[1] ||
		(await new Response(
			await new Promise((resolve) => {
				process.stdout.write(
					`Enter agent tone (${TONE_DICTIONARY.join(", ")}): `,
				);
				process.stdin.once("data", resolve);
			}),
		)
			.text()
			.then((t) => t.trim()));

	const customPrompt =
		args[2] ||
		(await new Response(
			await new Promise((resolve) => {
				process.stdout.write("Enter custom prompt (optional): ");
				process.stdin.once("data", resolve);
			}),
		)
			.text()
			.then((t) => t.trim()));

	// Validate tone
	if (!TONE_DICTIONARY.includes(tone)) {
		console.error(
			`Error: Invalid tone. Must be one of: ${TONE_DICTIONARY.join(", ")}`,
		);
		process.exit(1);
	}

	// Generate prompt if not provided
	const prompt =
		customPrompt ||
		`You are a ${tone} AI assistant named ${name}. Be concise and helpful.`;

	try {
		console.log("\nCreating agent...");
		const agentId = await createAgent(name, prompt);

		// Generate URL with query parameters
		const baseUrl = process.env.BASE_URL || "http://localhost:5173";
		const url = new URL("/voice/", baseUrl);
		url.searchParams.set("agentId", agentId);
		url.searchParams.set("name", name);

		console.log("\nAgent created successfully! 🎉");
		console.log("\nAgent Details:");
		console.log("-------------");
		console.log(`Name: ${name}`);
		console.log(`Tone: ${tone}`);
		console.log(`Agent ID: ${agentId}`);
		console.log(`\nAccess URL:\n${url.toString()}`);

		// Copy URL to clipboard
		await $`echo ${url.toString()} | pbcopy`;
		console.log("\nURL has been copied to your clipboard! 📋");
	} catch (error) {
		console.error("Error creating agent:", error);
		process.exit(1);
	}
}

main();
