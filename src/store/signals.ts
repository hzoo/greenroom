import { signal, type Signal } from "@preact/signals-react";
import type { Role } from "@11labs/client";
import type ChatBot from "@/chatbot";

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
export const transcriptWidth = signal(320);
export const isSpeaking = signal(false);
export const isUserSpeaking = signal(false);
export const isConnected = signal(false);

// Voice chat controls
export const volume = signal(1);
export const isPlaying = signal(false);

// Chatbot state
export const chatbot = signal<ChatBot | null>(null);
