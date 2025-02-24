import { batch } from "@preact/signals-react";
import type {
	SpeechControlConfig,
	SpeechControlEvents,
	SpeechRecognition,
	SpeechRecognitionEvent,
	SpeechRecognitionErrorEvent,
} from "./types";
import { AudioQueueManager, audioChunks } from "./AudioQueueManager";
import {
	isConnected,
	isUserSpeaking,
	isListening,
	transcript,
	volume,
	isAgentSpeaking,
	hasSentFinalTranscript,
	speechDetector,
} from "@/store/signals";
import { debugLog } from "../debug";

// Default configuration
const DEFAULT_CONFIG: Required<SpeechControlConfig> = {
	silenceThreshold: 0.1,
	silenceDuration: 1500,
	language: "en-US",
	elevenlabsApiKey: "",
	elevenlabsVoiceId: "JBFqnCBsd6RMkjVDRZzb",
};

export class SpeechControl {
	private config: Required<SpeechControlConfig>;
	private recognition: SpeechRecognition | null = null;
	private audioContext: AudioContext = new AudioContext();
	private audioQueue: AudioQueueManager | null = null;
	private events: SpeechControlEvents;
	private silenceTimeout: ReturnType<typeof setTimeout> | null = null;
	private currentTranscript = "";

	constructor(
		config: SpeechControlConfig = {},
		events: SpeechControlEvents = {},
	) {
		this.config = { ...DEFAULT_CONFIG, ...config };
		this.events = events;

		// Initialize audio context first since it doesn't require permissions
		this.audioQueue = new AudioQueueManager(this.audioContext);
		debugLog("Audio context initialized", {
			state: this.audioContext.state,
			sampleRate: this.audioContext.sampleRate,
		});

		window.addEventListener("unload", () => {
			this.stop();
		});
	}

	async requestMicrophonePermission(): Promise<boolean> {
		try {
			// First check if we already have permission
			const permissions = await navigator.permissions.query({
				name: "microphone" as PermissionName,
			});
			if (permissions.state === "granted") {
				return true;
			}

			// If not granted, request it
			await navigator.mediaDevices.getUserMedia({ audio: true });
			return true;
		} catch (error) {
			debugLog("Microphone permission error:", error, "error");
			return false;
		}
	}

	async initialize() {
		try {
			// Check for microphone permission
			debugLog("Checking microphone permission...", null, "speech");
			const hasPermission = await this.requestMicrophonePermission();
			if (!hasPermission) {
				throw new Error("Microphone permission not granted");
			}
			console.log("Microphone permission granted", hasPermission);

			// Set up audio analyzer for visualization
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			debugLog("Got microphone stream", { active: stream.active }, "speech");

			const source = this.audioContext.createMediaStreamSource(stream);
			const analyzer = this.audioContext.createAnalyser();
			analyzer.fftSize = 512;
			analyzer.smoothingTimeConstant = 0.8;
			source.connect(analyzer);

			// Test the analyzer is receiving data
			const testData = new Uint8Array(analyzer.frequencyBinCount);
			analyzer.getByteFrequencyData(testData);
			debugLog(
				"Analyzer setup complete",
				{
					fftSize: analyzer.fftSize,
					frequencyBinCount: analyzer.frequencyBinCount,
					sampleRate: this.audioContext.sampleRate,
					hasData: testData.some((val) => val > 0),
				},
				"speech",
			);

			speechDetector.value = analyzer;

			// Initialize speech recognition
			await this.initializeSpeechRecognition();
		} catch (error) {
			this.handleError(error as Error);
			throw error; // Re-throw to handle in the caller
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
		this.recognition.start();
	}

	private handleRecognitionResult(event: Event) {
		// If agent is speaking, ignore speech recognition results
		if (isAgentSpeaking.value) {
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
			debugLog("[FINAL] transcript received", { transcript: finalTranscript });
			if (!hasSentFinalTranscript.value) {
				hasSentFinalTranscript.value = true;
			} else {
				return;
			}
			this.currentTranscript = finalTranscript;
			batch(() => {
				isUserSpeaking.value = false;
				transcript.value = transcript.value.concat({
					message: finalTranscript,
					source: "user",
				});
			});
			this.events.onTranscriptUpdate?.(finalTranscript, true);
		} else if (interimTranscript) {
			// debugLog("INTERIM transcript update", { transcript: interimTranscript });
			this.currentTranscript = interimTranscript;
			isUserSpeaking.value = true;
			this.events.onTranscriptUpdate?.(interimTranscript, false);
			this.checkSilence();
		}
	}

	private handleRecognitionStart() {
		debugLog("Speech recognition started", {
			state: "listening",
			timestamp: new Date().toISOString(),
		});
		isListening.value = true;
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
			// isConnected.value = false;
			// this.handleError(new Error(`Speech recognition error: ${error.error}`));
		}
	}

	private handleRecognitionEnd() {
		debugLog("Speech recognition ended", {
			isListening: isListening.value,
			isAgentSpeaking: isAgentSpeaking.value,
			timestamp: new Date().toISOString(),
		});

		// Only auto-restart if we're still connected and agent isn't speaking
		if (isConnected.value && !isAgentSpeaking.value) {
			this.resumeRecognition();
		}
	}

	private checkSilence() {
		if (this.silenceTimeout) {
			clearTimeout(this.silenceTimeout);
		}

		this.silenceTimeout = setTimeout(() => {
			if (isUserSpeaking.value) {
				debugLog("Silence timeout, sending transcript", {
					transcript: this.currentTranscript,
				});
				isUserSpeaking.value = false;
				if (!hasSentFinalTranscript.value) {
					hasSentFinalTranscript.value = true;
					this.events.onTranscriptUpdate?.(this.currentTranscript, true);
				}
			}
		}, this.config.silenceDuration);
	}

	private pauseRecognition() {
		if (this.recognition) {
			debugLog("Aborting speech recognition while agent speaks");
			this.recognition.stop();
		}
	}

	private async resumeRecognition() {
		if (!isListening.value || isAgentSpeaking.value) return;

		// Reset the final transcript flag when starting a new recognition session
		hasSentFinalTranscript.value = false;

		debugLog("resuming speech recognition session");
		if (!this.recognition) {
			await this.initializeSpeechRecognition();
		} else {
			this.recognition.start();
		}
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
		isAgentSpeaking.value = true;
		this.pauseRecognition();

		// Track the completion handler
		let completionHandler: (() => void) | undefined;
		let hasError = false;

		// Set up error recovery handler
		const errorRecoveryHandler = () => {
			if (!hasError) {
				hasError = true;
				debugLog(
					"Error in audio processing, recovering speech recognition",
					null,
					"error",
				);
				isAgentSpeaking.value = false;
				this.resumeRecognition();
			}
		};

		try {
			const ws = new WebSocket(
				`wss://api.elevenlabs.io/v1/text-to-speech/${this.config.elevenlabsVoiceId}/stream-input?optimize_streaming_latency=0`,
			);

			// Set up completion handler
			completionHandler = () => {
				debugLog("Audio playback completed, resuming recognition");
				isAgentSpeaking.value = false;
				this.resumeRecognition();
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
			let lastArrayBuffer: ArrayBuffer | null = null; // Store last array buffer

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

					// debugLog(
					// 	"Received audio chunk",
					// 	{
					// 		length: data.audio.length,
					// 		isFinal: data.isFinal,
					// 		hasAlignment: !!data.alignment,
					// 		contextState: this.audioContext.state,
					// 	},
					// 	"synthesis",
					// );

					try {
						const audioData = atob(data.audio);
						const arrayBuffer = new ArrayBuffer(audioData.length);
						const view = new Uint8Array(arrayBuffer);
						for (let i = 0; i < audioData.length; i++) {
							view[i] = audioData.charCodeAt(i);
						}

						// Clone the buffer for later use if needed
						lastArrayBuffer = arrayBuffer.slice(0);

						// If this is the last chunk before WebSocket closes, attach completion handler
						if (!lastChunkProcessed && data.isFinal) {
							debugLog("Processing final chunk", null, "synthesis");
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
							// debugLog("Processing non-final chunk", null, "synthesis");
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
				// If we haven't processed the last chunk yet and have the last array buffer
				if (
					!lastChunkProcessed &&
					lastArrayBuffer &&
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
						const lastChunk = audioChunks.value[currentQueueLength - 1];
						audioChunks.value = audioChunks.value.slice(0, -1);

						// Reuse the stored array buffer
						await this.audioQueue
							.addToQueue(
								lastArrayBuffer,
								lastChunk.alignment,
								completionHandler,
							)
							.catch(errorRecoveryHandler);
					} else {
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

	setVolume(vol: number) {
		volume.value = vol;
	}

	async stop() {
		if (this.recognition) {
			this.recognition.stop();
		}

		if (this.silenceTimeout) {
			clearTimeout(this.silenceTimeout);
			this.silenceTimeout = null;
		}

		if (this.audioContext) {
			this.audioQueue?.clear();
		}

		batch(() => {
			isConnected.value = false;
			isListening.value = false;
			isUserSpeaking.value = false;
			hasSentFinalTranscript.value = false;
			// Keep the speechDetector connected for visualization
			// speechDetector.value = null;
		});
	}

	private handleError(error: Error) {
		debugLog(error.message, { stack: error.stack }, "error");
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
}
