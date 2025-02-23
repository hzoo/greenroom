// Speech Recognition Types
export interface SpeechRecognitionResult {
	transcript: string;
	confidence: number;
}

export interface SpeechRecognitionAlternative {
	[index: number]: SpeechRecognitionResult;
	length: number;
}

export interface SpeechRecognitionResults {
	[index: number]: {
		[index: number]: SpeechRecognitionResult;
		isFinal: boolean;
		length: number;
	};
	length: number;
}

export interface SpeechRecognitionEvent extends Event {
	resultIndex: number;
	results: SpeechRecognitionResults;
}

export interface SpeechRecognitionErrorEvent extends Event {
	error:
		| "no-speech"
		| "aborted"
		| "audio-capture"
		| "network"
		| "not-allowed"
		| "service-not-allowed"
		| "bad-grammar"
		| "language-not-supported";
	message?: string;
}

export interface SpeechRecognition extends EventTarget {
	continuous: boolean;
	interimResults: boolean;
	lang: string;
	onresult:
		| ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void)
		| null;
	onerror:
		| ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void)
		| null;
	onend: ((this: SpeechRecognition, ev: Event) => void) | null;
	onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
	start(): void;
	stop(): void;
	abort(): void;
}

// Browser globals
declare global {
	interface Window {
		SpeechRecognition: new () => SpeechRecognition;
		webkitSpeechRecognition: new () => SpeechRecognition;
		AudioContext: new () => AudioContext;
		webkitAudioContext: new () => AudioContext;
	}
}

// Audio Queue Types
export interface AudioChunk {
	buffer: AudioBuffer;
	sequence: number;
	alignment?: {
		charStartTimesMs: number[];
		charDurationsMs: number[];
		chars: string[];
	};
}

// Speech Control Types
export interface SpeechControlConfig {
	silenceThreshold?: number;
	silenceDuration?: number;
	language?: string;
	elevenlabsApiKey?: string;
	elevenlabsVoiceId?: string;
}

export interface SpeechControlState {
	volume: number;
	transcript: Array<{ message: string; source: "user" | "ai" }>;
}

export interface SpeechControlEvents {
	onTranscriptUpdate?: (transcript: string, isFinal: boolean) => void;
	onStateChange?: (state: Partial<SpeechControlState>) => void;
	onError?: (error: Error) => void;
}
