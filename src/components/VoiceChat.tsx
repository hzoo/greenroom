import { signal, effect } from "@preact/signals-react";
import type { Role } from "@11labs/client";
import { useEffect, memo, useRef, useMemo } from "react";
import { useSignalEffect, useSignals } from "@preact/signals-react/runtime";
import { cn } from "@/lib/utils";
import { createPersistedSignal, chatbot, volume } from "@/store/signals";
import ChatBot from "@/chatbot";
import { SpeechControl, speechState } from "@/lib/speech/SpeechControl";
import { VoiceChatUI } from "./VoiceChatUI";
import {
	isPlaying,
	isConnected,
	isSpeaking,
	isUserSpeaking,
	transcript,
} from "@/store/signals";

// Add at the top of the file after imports
declare global {
	interface Window {
		SpeechRecognition: typeof SpeechRecognition;
		webkitSpeechRecognition: typeof SpeechRecognition;
		AudioContext: typeof AudioContext;
		webkitAudioContext: typeof AudioContext;
	}
}

// Add type definitions for Web Speech API
interface SpeechRecognitionEvent extends Event {
	resultIndex: number;
	results: {
		[key: number]: {
			[key: number]: {
				transcript: string;
				confidence: number;
			};
			isFinal: boolean;
			length: number;
		};
		length: number;
	};
}

interface SpeechRecognitionErrorEvent extends Event {
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

interface SpeechRecognition extends EventTarget {
	continuous: boolean;
	interimResults: boolean;
	lang: string;
	onresult:
		| ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any)
		| null;
	onerror:
		| ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any)
		| null;
	onend: ((this: SpeechRecognition, ev: Event) => any) | null;
	onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
	start(): void;
	stop(): void;
	abort(): void;
}

// Debug logging for signal changes
function debugLog(
	message: string,
	data?: unknown,
	type: "tone" | "speech" | "user" | "system" = "system",
) {
	const colors = {
		tone: "#8b5cf6", // Purple for tone context
		speech: "#3b82f6", // Blue for speech generation
		user: "#10b981", // Green for user input
		system: "#94a3b8", // Gray for system messages
	};

	console.log(
		`%c[${type.toUpperCase()}] %c${message}`,
		`color: ${colors[type]}; font-weight: bold`,
		`color: ${colors[type]}`,
		data ? "\n" : "",
		data ? data : "",
	);
}

// Conversation state signals
export const conversation = signal<null>(null);
export const agentName = signal<string>("");
export const agentId = signal<string>("");

// Add at the top level with other signals
export const audioContext = signal<AudioContext | null>(null);

// Add these new signals at the top with other signals
export const audioStream = signal<MediaStream | null>(null);
export const speechDetector = signal<{
	context: AudioContext;
	analyzer: AnalyserNode;
	source: MediaStreamAudioSourceNode;
} | null>(null);
export const isListening = signal(false);

// Debounce volume changes for conversation
effect(() => {
	const conv = conversation.value;
	if (!conv) return;
	const timeoutId = setTimeout(() => {
		conv.setVolume({ volume: volume.value });
	}, 200); // 200ms debounce
	return () => clearTimeout(timeoutId);
});

// Transcript sidebar state
export const isTranscriptOpen = signal(true);
export const transcriptWidth = createPersistedSignal("transcript-width", 320);

// Debug effects for signal changes
effect(() => {
	debugLog(
		"Connection state changed:",
		isConnected.value ? "Connected" : "Disconnected",
	);
});

effect(() => {
	debugLog(
		"Speaking state changed:",
		isSpeaking.value ? "Speaking" : "Not speaking",
	);
});

effect(() => {
	debugLog(
		"User speaking state changed:",
		isUserSpeaking.value ? "Speaking" : "Not speaking",
	);
});

effect(() => {
	if (transcript.value.length > 0) {
		debugLog("Transcript updated:", transcript.value);
	}
});

const buttonStyles =
	"px-3 py-2 text-sm rounded-md border border-gray-200/20 hover:bg-gray-700/50 transition-colors";

// Export AgentCircle for reuse
export const AgentCircle = memo(function AgentCircle() {
	useSignals();
	const canvasRef = useRef<HTMLCanvasElement>(null);

	// Effect for frequency visualization
	useSignalEffect(() => {
		const conv = conversation.value;
		if (!canvasRef.current || !conv) return;

		const canvas = canvasRef.current;
		const context = canvas.getContext("2d");
		if (!context) return;

		const centerX = canvas.width / 2;
		const centerY = canvas.height / 2;
		const radius = Math.min(centerX, centerY) - 10;

		let animationFrame: number;

		conversation.value;
		isSpeaking.value;

		function drawFrequencies() {
			if (!conv || !context) return;

			// Get frequency data
			const freqData = isSpeaking.value
				? conv.getOutputByteFrequencyData()
				: conv.getInputByteFrequencyData();

			// Clear canvas
			context.clearRect(0, 0, canvas.width, canvas.height);

			// Draw frequency bars in a circle
			const barCount = Math.min(64, freqData.length);
			const barWidth = (2 * Math.PI) / barCount;

			for (let i = 0; i < barCount; i++) {
				const amplitude = freqData[i] / 255.0;
				const barHeight = amplitude * 50;

				const angle = i * barWidth;

				const innerX = centerX + (radius - 10) * Math.cos(angle);
				const innerY = centerY + (radius - 10) * Math.sin(angle);
				const outerX = centerX + (radius - 10 + barHeight) * Math.cos(angle);
				const outerY = centerY + (radius - 10 + barHeight) * Math.sin(angle);

				context.beginPath();
				context.moveTo(innerX, innerY);
				context.lineTo(outerX, outerY);
				context.strokeStyle = isSpeaking.value
					? `rgba(59, 130, 246, ${amplitude})`
					: `rgba(34, 197, 94, ${amplitude})`;
				context.lineWidth = 4;
				context.lineCap = "round";
				context.stroke();
			}

			animationFrame = requestAnimationFrame(drawFrequencies);
		}

		drawFrequencies();

		return () => {
			if (animationFrame) {
				cancelAnimationFrame(animationFrame);
			}
		};
	});

	return (
		<div className="relative flex flex-col items-center">
			<canvas
				ref={canvasRef}
				width={600}
				height={600}
				className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
			/>
			<div
				className={cn(
					"h-48 w-48 rounded-full transition-all duration-300 relative",
					isSpeaking.value
						? "bg-blue-500/20 scale-110 animate-pulse border-blue-400/30"
						: isUserSpeaking.value
							? "bg-green-500/20 scale-105 border-green-400/30"
							: "bg-gray-600/20 border-gray-400/20",
					"border-2",
				)}
			/>
		</div>
	);
});

export function VoiceChat() {
	useSignals();

	// Initialize SpeechControl with proper event handlers
	const speechControl = useMemo(() => {
		return new SpeechControl(
			{
				elevenlabsApiKey: import.meta.env.VITE_ELEVENLABS_API_KEY,
			},
			{
				onTranscriptUpdate: async (transcriptText, isFinal) => {
					debugLog("Transcript update:", { transcriptText, isFinal }, "speech");
					if (isFinal && chatbot.value) {
						debugLog(
							"Processing final transcript with chatbot",
							null,
							"speech",
						);
						const response = await chatbot.value.handleVoiceTranscript(
							transcriptText,
							"user",
						);
						if (response) {
							debugLog("Got chatbot response:", response, "speech");
							// Update transcript
							transcript.value = [
								...transcript.value,
								{ message: transcriptText, source: "user" },
								{ message: response.response.content, source: "ai" },
							];
							// Speak response
							await speechControl.speak(response.response.content);
						}
					}
				},
				onError: (error) => {
					console.error("Speech control error:", error);
					isConnected.value = false;
					isPlaying.value = false;
				},
			},
		);
	}, []);

	useEffect(() => {
		return () => {
			// Cleanup
			speechControl.stop();
		};
	}, [speechControl]);

	// Add effect to sync voice chat with isConnected signal
	useEffect(() => {
		if (isConnected.value) {
			debugLog("Starting speech control...", null, "speech");
			speechControl
				.initialize()
				.then(() => {
					// Start playing when successfully connected
					isPlaying.value = true;
					debugLog("Speech control initialized and playing", null, "speech");
				})
				.catch((error) => {
					console.error("Failed to start conversation:", error);
					isConnected.value = false;
					isPlaying.value = false;
				});
		} else {
			debugLog("Stopping speech control...", null, "speech");
			speechControl.stop().catch((error) => {
				console.error("Failed to stop conversation:", error);
			});
		}
	}, [isConnected.value, speechControl]);

	// Add effect to sync voice chat with isPlaying signal
	useEffect(() => {
		if (!isConnected.value) return;

		if (isPlaying.value) {
			debugLog("Resuming speech control...", null, "speech");
			speechControl.resume();
		} else {
			debugLog("Pausing speech control...", null, "speech");
			speechControl.pause();
		}
	}, [isPlaying.value, speechControl]);

	// Add effect to sync with speechState
	useEffect(() => {
		const unsubscribe = effect(() => {
			const state = speechState.value;
			isSpeaking.value = state.isSpeaking;
			isUserSpeaking.value = state.isUserSpeaking;
			volume.value = state.volume;
		});

		return () => unsubscribe();
	}, []);

	return null; // We don't need to render anything since we're using the debug panel UI
}
