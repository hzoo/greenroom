import { signal } from "@preact/signals-react";
import type {
	SpeechControlConfig,
	SpeechControlState,
	SpeechControlEvents,
	SpeechRecognition,
	SpeechRecognitionEvent,
	SpeechRecognitionErrorEvent,
} from "./types";
import { AudioQueueManager, audioChunks } from "./AudioQueueManager";

// Default configuration
const DEFAULT_CONFIG: Required<SpeechControlConfig> = {
	silenceThreshold: 0.1,
	silenceDuration: 1500,
	language: "en-US",
	elevenlabsApiKey: "",
	elevenlabsVoiceId: "JBFqnCBsd6RMkjVDRZzb",
};

// State signals
export const speechState = signal<SpeechControlState>({
	isConnected: false,
	isSpeaking: false,
	isListening: false,
	isUserSpeaking: false,
	volume: 1,
	transcript: [],
});

// Debug logging with color coding
function debugLog(
	message: string,
	data?: unknown,
	type: "recognition" | "synthesis" | "error" = "recognition",
) {
	const colors = {
		recognition: "#10b981", // Green for speech recognition
		synthesis: "#3b82f6", // Blue for speech synthesis
		error: "#ef4444", // Red for errors
	};

	console.log(
		`%c[SPEECH ${type.toUpperCase()}] %c${message}`,
		`color: ${colors[type]}; font-weight: bold`,
		`color: ${colors[type]}`,
		data ? "\n" : "",
		data ? data : "",
	);
}

export class SpeechControl {
	private config: Required<SpeechControlConfig>;
	private recognition: SpeechRecognition | null = null;
	private audioContext: AudioContext | null = null;
	private audioQueue: AudioQueueManager | null = null;
	private events: SpeechControlEvents;
	private silenceTimeout: ReturnType<typeof setTimeout> | null = null;
	private currentTranscript = "";
	private isAgentSpeaking = false;
	private isPaused: boolean = false;

	constructor(
		config: SpeechControlConfig = {},
		events: SpeechControlEvents = {},
	) {
		this.config = { ...DEFAULT_CONFIG, ...config };
		this.events = events;
	}

	async initialize() {
		try {
			// Request microphone permission
			const hasPermission = await this.requestMicrophonePermission();
			if (!hasPermission) {
				throw new Error("Microphone permission denied");
			}

			// Initialize audio context
			if (!this.audioContext || this.audioContext.state === "closed") {
				this.audioContext = new (
					window.AudioContext || window.webkitAudioContext
				)();
				// Ensure context is running
				if (this.audioContext.state === "suspended") {
					await this.audioContext.resume();
				}
				this.audioQueue = new AudioQueueManager(this.audioContext);
				debugLog("Audio context initialized", {
					state: this.audioContext.state,
					sampleRate: this.audioContext.sampleRate,
				});
			}

			// Initialize speech recognition
			await this.initializeSpeechRecognition();

			speechState.value = { ...speechState.value, isConnected: true };
		} catch (error) {
			this.handleError(error as Error);
		}
	}

	private async requestMicrophonePermission(): Promise<boolean> {
		try {
			await navigator.mediaDevices.getUserMedia({ audio: true });
			return true;
		} catch (error) {
			return false;
		}
	}

	private async initializeSpeechRecognition() {
		const SpeechRecognition =
			window.SpeechRecognition || window.webkitSpeechRecognition;
		if (!SpeechRecognition) {
			throw new Error("Speech recognition not supported in this browser");
		}

		debugLog("Initializing speech recognition", {
			language: this.config.language,
			continuous: true,
			interimResults: true,
		});

		const recognition = new SpeechRecognition();
		recognition.continuous = true;
		recognition.interimResults = true;
		recognition.lang = this.config.language;

		recognition.onresult = this.handleRecognitionResult.bind(this);
		recognition.onstart = this.handleRecognitionStart.bind(this);
		recognition.onerror = this.handleRecognitionError.bind(this);
		recognition.onend = this.handleRecognitionEnd.bind(this);

		this.recognition = recognition;
		recognition.start();
	}

	private handleRecognitionResult(event: Event) {
		// If agent is speaking, ignore speech recognition results
		if (this.isAgentSpeaking) {
			debugLog("Ignoring speech recognition while agent is speaking");
			return;
		}

		const speechEvent = event as SpeechRecognitionEvent;
		let interimTranscript = "";
		let finalTranscript = "";

		for (let i = 0; i < speechEvent.results.length; i++) {
			const result = speechEvent.results[i];
			if (result.isFinal) {
				finalTranscript += result[0].transcript;
			} else {
				interimTranscript += result[0].transcript;
			}
		}

		if (finalTranscript) {
			debugLog("Final transcript received", { transcript: finalTranscript });
			this.currentTranscript = finalTranscript;
			speechState.value = {
				...speechState.value,
				isUserSpeaking: false,
				transcript: [
					...speechState.value.transcript,
					{ message: finalTranscript, source: "user" },
				],
			};
			this.events.onTranscriptUpdate?.(finalTranscript, true);
		} else if (interimTranscript) {
			debugLog("Interim transcript update", { transcript: interimTranscript });
			this.currentTranscript = interimTranscript;
			speechState.value = { ...speechState.value, isUserSpeaking: true };
			this.events.onTranscriptUpdate?.(interimTranscript, false);
			this.checkSilence();
		}
	}

	private handleRecognitionStart() {
		debugLog("Speech recognition started", {
			state: "listening",
			timestamp: new Date().toISOString(),
		});
		speechState.value = {
			...speechState.value,
			isListening: true,
			isConnected: true,
		};
	}

	private handleRecognitionError(event: Event) {
		const error = event as SpeechRecognitionErrorEvent;
		debugLog(
			`Speech recognition error: ${error.error}`,
			{
				message: error.message,
				timestamp: new Date().toISOString(),
			},
			"error",
		);
		if (error.error === "no-speech") {
			this.recognition?.start();
		} else {
			this.handleError(new Error(`Speech recognition error: ${error.error}`));
		}
	}

	private handleRecognitionEnd() {
		debugLog("Speech recognition ended", {
			isListening: speechState.value.isListening,
			isAgentSpeaking: this.isAgentSpeaking,
			timestamp: new Date().toISOString(),
		});

		// Only auto-restart if we're still listening and agent isn't speaking
		if (speechState.value.isListening && !this.isAgentSpeaking) {
			this.resumeRecognition();
		}
	}

	private checkSilence() {
		if (this.silenceTimeout) {
			clearTimeout(this.silenceTimeout);
		}

		this.silenceTimeout = setTimeout(() => {
			if (speechState.value.isUserSpeaking) {
				speechState.value = { ...speechState.value, isUserSpeaking: false };
				this.events.onTranscriptUpdate?.(this.currentTranscript, true);
			}
		}, this.config.silenceDuration);
	}

	private pauseRecognition() {
		if (this.recognition) {
			debugLog("Aborting speech recognition while agent speaks");
			// Use abort() instead of stop() to immediately end the session
			this.recognition.abort();
			// Clear the reference so a new instance will be created when we resume
			this.recognition = null;
		}
	}

	private async resumeRecognition() {
		if (!speechState.value.isListening || this.isAgentSpeaking) return;

		debugLog("Creating new speech recognition session");
		const SpeechRecognition =
			window.SpeechRecognition || window.webkitSpeechRecognition;

		if (!SpeechRecognition) {
			throw new Error("Speech recognition not supported");
		}

		const recognition = new SpeechRecognition();
		recognition.continuous = true;
		recognition.interimResults = true;
		recognition.lang = this.config.language;

		recognition.onresult = this.handleRecognitionResult.bind(this);
		recognition.onstart = this.handleRecognitionStart.bind(this);
		recognition.onerror = this.handleRecognitionError.bind(this);
		recognition.onend = this.handleRecognitionEnd.bind(this);

		this.recognition = recognition;
		recognition.start();
	}

	async speak(text: string) {
		if (!this.audioContext) {
			throw new Error("Audio context not initialized");
		}
		if (!this.config.elevenlabsApiKey) {
			throw new Error("ElevenLabs API key not configured");
		}

		// Check if context is closed or suspended
		if (this.audioContext.state === "closed") {
			debugLog("Audio context is closed, reinitializing...", null, "synthesis");
			this.audioContext = new (
				window.AudioContext || window.webkitAudioContext
			)();
			this.audioQueue = new AudioQueueManager(this.audioContext);
		} else if (this.audioContext.state === "suspended") {
			debugLog("Audio context is suspended, resuming...", null, "synthesis");
			await this.audioContext.resume();
		}

		debugLog(
			"Starting speech synthesis",
			{
				textLength: text.length,
				timestamp: new Date().toISOString(),
				contextState: this.audioContext.state,
			},
			"synthesis",
		);

		// Set speaking state and abort current recognition session
		this.isAgentSpeaking = true;
		speechState.value = { ...speechState.value, isSpeaking: true };
		this.pauseRecognition();

		// Track the completion handler
		let completionHandler: (() => void) | undefined;
		let hasError = false;

		try {
			const ws = new WebSocket(
				`wss://api.elevenlabs.io/v1/text-to-speech/${this.config.elevenlabsVoiceId}/stream-input?optimize_streaming_latency=0`,
			);

			// Set up completion handler
			completionHandler = () => {
				debugLog("Audio playback completed, resuming recognition");
				this.isAgentSpeaking = false;
				speechState.value = { ...speechState.value, isSpeaking: false };
				this.resumeRecognition();
			};

			// Set up error recovery handler
			const errorRecoveryHandler = () => {
				if (!hasError) {
					hasError = true;
					debugLog(
						"Error in audio processing, recovering speech recognition",
						null,
						"error",
					);
					this.isAgentSpeaking = false;
					speechState.value = { ...speechState.value, isSpeaking: false };
					this.resumeRecognition();
				}
			};

			ws.onopen = () => {
				debugLog("WebSocket connection opened", null, "synthesis");
				ws.send(
					JSON.stringify({
						text: " ",
						voice_settings: {
							stability: 0.5,
							similarity_boost: 0.8,
						},
						"xi-api-key": this.config.elevenlabsApiKey,
					}),
				);

				ws.send(
					JSON.stringify({
						text,
						try_trigger_generation: true,
					}),
				);

				ws.send(JSON.stringify({ text: "" }));
			};

			let lastChunkProcessed = false;

			ws.onmessage = async (event) => {
				const data = JSON.parse(event.data);
				if (data.audio) {
					// Check audio context state and try to reinitialize if needed
					if (!this.audioContext || this.audioContext.state === "closed") {
						debugLog(
							"Audio context is closed, attempting to reinitialize...",
							null,
							"synthesis",
						);
						try {
							this.audioContext = new (
								window.AudioContext || window.webkitAudioContext
							)();
							await this.audioContext.resume();
							this.audioQueue = new AudioQueueManager(this.audioContext);
							debugLog(
								"Successfully reinitialized audio context",
								{
									state: this.audioContext.state,
									sampleRate: this.audioContext.sampleRate,
								},
								"synthesis",
							);
						} catch (error) {
							debugLog("Failed to reinitialize audio context", null, "error");
							errorRecoveryHandler();
							ws.close();
							return;
						}
					} else if (this.audioContext.state === "suspended") {
						debugLog(
							"Audio context is suspended, resuming...",
							null,
							"synthesis",
						);
						try {
							await this.audioContext.resume();
						} catch (error) {
							debugLog("Failed to resume audio context", null, "error");
							errorRecoveryHandler();
							ws.close();
							return;
						}
					}

					debugLog(
						"Received audio chunk",
						{
							length: data.audio.length,
							isFinal: data.isFinal,
							hasAlignment: !!data.alignment,
							contextState: this.audioContext.state,
						},
						"synthesis",
					);

					try {
						const audioData = atob(data.audio);
						const arrayBuffer = new ArrayBuffer(audioData.length);
						const view = new Uint8Array(arrayBuffer);
						for (let i = 0; i < audioData.length; i++) {
							view[i] = audioData.charCodeAt(i);
						}

						// If this is the last chunk before WebSocket closes, attach completion handler
						if (!lastChunkProcessed && data.isFinal) {
							lastChunkProcessed = true;
							await this.audioQueue
								?.addToQueue(
									arrayBuffer,
									data.normalizedAlignment || data.alignment,
									completionHandler,
								)
								.catch(errorRecoveryHandler);
							ws.close();
						} else {
							// Process other chunks immediately without completion handler
							await this.audioQueue
								?.addToQueue(
									arrayBuffer,
									data.normalizedAlignment || data.alignment,
								)
								.catch(errorRecoveryHandler);
						}
					} catch (error) {
						errorRecoveryHandler();
						this.handleError(error as Error);
					}
				}
			};

			ws.onclose = async () => {
				debugLog("WebSocket connection closed", null, "synthesis");
				// If we haven't processed the last chunk yet (no isFinal flag received)
				// and the context is still valid, attach completion handler to the last chunk
				if (
					!lastChunkProcessed &&
					this.audioQueue &&
					this.audioContext?.state === "running"
				) {
					const currentQueueLength = audioChunks.value.length;
					if (currentQueueLength > 0) {
						debugLog(
							"Attaching completion handler to final queued chunk",
							null,
							"synthesis",
						);
						// Get the raw audio data from the last chunk
						const lastChunk = audioChunks.value[currentQueueLength - 1];
						// Create an array buffer from the audio data
						const audioData = new Float32Array(lastChunk.buffer.length);
						lastChunk.buffer.copyFromChannel(audioData, 0);
						const arrayBuffer = audioData.buffer;

						// Remove the last chunk and re-add it with the completion handler
						audioChunks.value = audioChunks.value.slice(0, -1);
						await this.audioQueue
							.addToQueue(arrayBuffer, lastChunk.alignment, completionHandler)
							.catch(errorRecoveryHandler);
					} else {
						// If no chunks were processed successfully, recover
						errorRecoveryHandler();
					}
				}
			};

			ws.onerror = (error: Event) => {
				this.handleWebSocketError(error);
				this.audioQueue?.clear();
				errorRecoveryHandler();
				ws.close();
			};
		} catch (error) {
			errorRecoveryHandler();
			this.handleError(error as Error);
		}
	}

	setVolume(volume: number) {
		speechState.value = { ...speechState.value, volume };
	}

	async stop() {
		if (this.recognition) {
			this.recognition.stop();
			this.recognition = null;
		}

		if (this.silenceTimeout) {
			clearTimeout(this.silenceTimeout);
			this.silenceTimeout = null;
		}

		if (this.audioContext) {
			this.audioQueue?.clear();
			await this.audioContext.close();
			this.audioContext = null;
		}

		speechState.value = {
			...speechState.value,
			isConnected: false,
			isListening: false,
			isSpeaking: false,
			isUserSpeaking: false,
		};
	}

	private handleError(error: Error) {
		debugLog(error.message, { stack: error.stack }, "error");
		this.events.onError?.(error);
	}

	// Update error handling for WebSocket
	private handleWebSocketError(error: unknown) {
		const errorMessage =
			error instanceof Error
				? error.message
				: error instanceof Event
					? "WebSocket error"
					: "Unknown error";
		this.handleError(new Error(errorMessage));
	}

	pause() {
		this.isPaused = true;
		if (this.recognition) {
			this.recognition.stop();
		}
		if (this.audioContext?.state === "running") {
			this.audioContext.suspend();
			// Clear the audio queue when pausing
			this.audioQueue?.clear();
		}
	}

	resume() {
		this.isPaused = false;
		if (this.recognition) {
			this.recognition.start();
		}
		if (this.audioContext?.state === "suspended") {
			this.audioContext.resume().then(() => {
				// Only recreate the audio queue after context is resumed
				if (this.audioContext) {
					this.audioQueue = new AudioQueueManager(this.audioContext);
				}
			});
		}
	}
}
