import { signal, type Signal } from "@preact/signals-react";
import type { Role } from "@11labs/client";
import type { ChatBot } from "@/chatbot";

// Debounce helper with proper types
function debounce<Args extends unknown[], R>(
	func: (...args: Args) => R,
	wait: number,
) {
	let timeoutId: ReturnType<typeof setTimeout>;

	const debounced = (...args: Args) => {
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => func(...args), wait);
	};

	debounced.cancel = () => {
		clearTimeout(timeoutId);
	};

	return debounced;
}

export function createPersistedSignal<T>(
	key: string,
	defaultValue: T,
	options = { debounceMs: 100 },
): Signal<T> {
	// Try to get initial value from localStorage
	const stored = localStorage.getItem(key);
	const initial = stored ? JSON.parse(stored) : defaultValue;

	// Create signal with initial value
	const sig = signal<T>(initial);

	// Set up persistence with debouncing
	const persist = debounce(() => {
		localStorage.setItem(key, JSON.stringify(sig.value));
	}, options.debounceMs);

	// Create a proxy to intercept value changes
	return new Proxy(sig, {
		get(target, prop) {
			return target[prop as keyof typeof target];
		},
		set(target, prop, value) {
			const result = Reflect.set(target, prop, value);
			if (prop === "value") {
				persist();
			}
			return result;
		},
	});
}

// Voice chat state
export const transcript = signal<Array<{ message: string; source: Role }>>([]);
export const isTranscriptOpen = signal(true);
export const transcriptWidth = createPersistedSignal("transcript-width", 320);
export const isAgentSpeaking = signal(false);
export const isUserSpeaking = signal(false);
export const isConnected = signal(false);
export const isListening = signal(false);
export const hasSentFinalTranscript = signal(false);

// Voice chat controls
export const volume = signal(1);

// Chatbot state
export const chatbot = signal<ChatBot | null>(null);

// Latest context signal
export const latestContext = signal<string>("");

// Speech controls
export const speechDetector = signal<AnalyserNode | null>(null);
export const wsAudioAnalyzer = signal<AnalyserNode | null>(null);

// Mock voice chat state
export const isMockMode = signal(false);
export const mockMessages = signal<Array<{ message: string; source: Role }>>([
	{ message: "Hi there! How can I help you today?", source: "ai" },
	{ message: "Can you help me understand how this works?", source: "user" },
	{
		message:
			"Of course! This is a voice chat interface that lets you interact with an AI assistant. You can speak naturally and I'll respond accordingly.",
		source: "ai",
	},
	{
		message:
			"You can also ask me to perform actions like creating notes, searching your files, or even controlling your Obsidian vault. Just let me know what you need!",
		source: "ai",
	},
	{
		message: "What is the weather in Tokyo?",
		source: "user",
	},
	{
		message: "The weather in Tokyo is sunny and warm today.",
		source: "ai",
	},
	{
		message: "What is the weather in NYC?",
		source: "user",
	},
	{
		message: "The weather in NYC is sunny and warm today.",
		source: "ai",
	},
	{
		message: "What is the weather in Tokyo?",
		source: "user",
	},
]);
export const currentMockIndex = signal(-1);
