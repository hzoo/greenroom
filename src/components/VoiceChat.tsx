import { signal, effect } from "@preact/signals-react";
import type { Role } from "@11labs/client";
import { useEffect, memo, useRef } from "react";
import { useSignalEffect, useSignals } from "@preact/signals-react/runtime";
import { cn } from "@/lib/utils";
import { createPersistedSignal } from "@/store/signals";
import ChatBot from "@/chatbot";

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
export const isConnected = signal(false);
export const isSpeaking = signal(false);
export const isUserSpeaking = signal(false);
export const agentName = signal<string>("");
export const agentId = signal<string>("");
export const volume = signal(1);
export const transcript = signal<Array<{ message: string; source: Role }>>([]);

// ChatBot instance signal
export const chatbot = signal<ChatBot | null>(null);

// Debug mode signal
const isDebugMode = signal(true);
const debugPanelHeight = signal(300);

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

// Mock conversation for debug mode
const mockConversation = {
	setVolume: ({ volume }: { volume: number }) => {
		debugLog("Mock setVolume:", volume);
	},
	getInputVolume: () => Math.random() * (isUserSpeaking.value ? 0.8 : 0.2),
	getOutputVolume: () => Math.random() * (isSpeaking.value ? 0.8 : 0.2),
	getInputByteFrequencyData: () => {
		// Generate fake frequency data
		const data = new Uint8Array(64);
		for (let i = 0; i < data.length; i++) {
			data[i] = Math.floor(Math.random() * (isUserSpeaking.value ? 255 : 50));
		}
		return data;
	},
	getOutputByteFrequencyData: () => {
		// Generate fake frequency data
		const data = new Uint8Array(64);
		for (let i = 0; i < data.length; i++) {
			data[i] = Math.floor(Math.random() * (isSpeaking.value ? 255 : 50));
		}
		return data;
	},
	getId: () => "mock-conversation-id",
	endSession: async () => {
		debugLog("Mock endSession");
		isConnected.value = false;
		isSpeaking.value = false;
		isUserSpeaking.value = false;
	},
};

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

const StatusIndicator = memo(function StatusIndicator() {
	useSignals();
	return (
		<div
			className={cn(
				"px-3 py-1 rounded-full text-xs font-medium",
				isConnected.value
					? isSpeaking.value
						? "bg-blue-500/20 text-blue-200 border border-blue-500/30"
						: isUserSpeaking.value
							? "bg-green-500/20 text-green-200 border border-green-500/30"
							: "bg-gray-500/20 text-gray-200 border border-gray-500/30"
					: "bg-red-500/20 text-red-200 border border-red-500/30",
			)}
		>
			{isConnected.value
				? isSpeaking.value
					? "Agent Speaking"
					: isUserSpeaking.value
						? "You're Speaking"
						: "Agent Listening"
				: "Disconnected"}
		</div>
	);
});

const VolumeControl = memo(function VolumeControl() {
	useSignals();
	return (
		<div className="flex items-center gap-3">
			<div className="text-xs text-gray-400">Volume</div>
			<input
				type="range"
				min="0"
				max="1"
				step="0.1"
				value={volume.value}
				onChange={(e) => {
					volume.value = Number.parseFloat(e.target.value);
				}}
				className="w-24 accent-blue-500"
			/>
			<div className="text-xs text-gray-400 font-mono w-8">
				{Math.round(volume.value * 100)}%
			</div>
		</div>
	);
});

const AgentCircle = memo(function AgentCircle() {
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

const TranscriptMessage = memo(function TranscriptMessage({
	message,
	source,
}: {
	message: string;
	source: Role;
}) {
	return (
		<div
			className={cn(
				"p-2 rounded-lg text-sm",
				source === "ai"
					? "bg-blue-500/10 text-blue-200"
					: "bg-green-500/10 text-green-200",
			)}
		>
			{message}
		</div>
	);
});

const TranscriptSidebar = memo(function TranscriptSidebar() {
	useSignals();
	const scrollRef = useRef<HTMLDivElement>(null);
	const dragRef = useRef<HTMLDivElement>(null);

	// Auto-scroll to bottom when new messages arrive
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	});

	// Dragging logic
	const handleDragStart = (e: React.MouseEvent) => {
		e.preventDefault();
		const startX = e.pageX;
		const startWidth = transcriptWidth.value;

		const handleDrag = (e: MouseEvent) => {
			const delta = startX - e.pageX;
			const newWidth = Math.min(Math.max(startWidth + delta, 240), 480);
			transcriptWidth.value = newWidth;
		};

		const handleDragEnd = () => {
			document.removeEventListener("mousemove", handleDrag);
			document.removeEventListener("mouseup", handleDragEnd);
		};

		document.addEventListener("mousemove", handleDrag);
		document.addEventListener("mouseup", handleDragEnd);
	};

	if (!isConnected.value || !isTranscriptOpen.value) return null;

	return (
		<div
			className="relative border-l border-gray-700/50 bg-gray-800/30 backdrop-blur-sm overflow-hidden"
			style={{ width: transcriptWidth.value }}
		>
			{/* Drag handle */}
			<div
				ref={dragRef}
				className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/20 group"
				onMouseDown={handleDragStart}
			>
				<div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gray-700/50 group-hover:bg-blue-500/50" />
			</div>

			{/* Header */}
			<div className="flex items-center justify-between h-9 px-3 border-b border-gray-700/50">
				<div className="text-sm font-medium text-gray-400">Transcript</div>
				<button
					onClick={() => (isTranscriptOpen.value = false)}
					className="text-gray-400 hover:text-gray-300"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
						fill="currentColor"
						className="w-4 h-4"
					>
						<path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
					</svg>
				</button>
			</div>

			{/* Content */}
			<div
				ref={scrollRef}
				className="p-4 space-y-4 overflow-y-auto"
				style={{ height: "calc(100% - 36px)" }}
			>
				{transcript.value.map((msg, i) => (
					<TranscriptMessage
						key={`${msg.source}-${msg.message}-${i}`}
						message={msg.message}
						source={msg.source}
					/>
				))}
			</div>
		</div>
	);
});

// Add a toggle button component
const TranscriptToggle = memo(function TranscriptToggle() {
	useSignals();
	if (isTranscriptOpen.value || !isConnected.value) return null;

	return (
		<button
			onClick={() => (isTranscriptOpen.value = true)}
			className="absolute right-4 bottom-4 p-2 rounded-full bg-gray-800 border border-gray-700/50 text-gray-400 hover:text-gray-300 hover:bg-gray-700"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 20 20"
				fill="currentColor"
				className="w-5 h-5"
			>
				<path d="M3.505 2.365A41.369 41.369 0 019 2c1.863 0 3.697.124 5.495.365 1.247.167 2.18 1.108 2.435 2.268a4.45 4.45 0 00-.577-.069 43.141 43.141 0 00-4.706 0C9.229 4.696 7.5 6.727 7.5 8.998v2.24c0 1.413.67 2.735 1.76 3.562l-2.98 2.98A.75.75 0 015 17.25v-3.443c-.501-.048-1-.106-1.495-.172C2.033 13.438 1 12.162 1 10.72V5.28c0-1.441 1.033-2.717 2.505-2.914z" />
			</svg>
		</button>
	);
});

// Debug Panel Components
const DebugControls = memo(function DebugControls() {
	useSignals();

	const simulateAgentMessage = () => {
		transcript.value = [
			...transcript.value,
			{
				message: `Mock agent message ${transcript.value.length + 1}`,
				source: "ai",
			},
		];
	};

	const simulateUserMessage = () => {
		transcript.value = [
			...transcript.value,
			{
				message: `Mock user message ${transcript.value.length + 1}`,
				source: "user",
			},
		];
	};

	const toggleConnection = () => {
		if (!isConnected.value) {
			isConnected.value = true;
			conversation.value = mockConversation;
		} else {
			isConnected.value = false;
			conversation.value = null;
		}
	};

	return (
		<div className="space-y-4 p-3 text-gray-100">
			<div className="flex items-center gap-2">
				<button
					onClick={toggleConnection}
					className={cn(
						buttonStyles,
						isConnected.value
							? "bg-red-500/30 text-white hover:bg-red-500/40"
							: "bg-green-500/30 text-white hover:bg-green-500/40",
					)}
				>
					{isConnected.value ? "Disconnect" : "Connect"}
				</button>
				<button
					onClick={() => (isSpeaking.value = !isSpeaking.value)}
					disabled={!isConnected.value}
					className={cn(
						buttonStyles,
						isSpeaking.value ? "bg-blue-500/30 text-white" : "bg-gray-700/30",
						!isConnected.value && "opacity-50",
					)}
				>
					Toggle Agent Speaking
				</button>
				<button
					onClick={() => (isUserSpeaking.value = !isUserSpeaking.value)}
					disabled={!isConnected.value}
					className={cn(
						buttonStyles,
						isUserSpeaking.value
							? "bg-green-500/30 text-white"
							: "bg-gray-700/30",
						!isConnected.value && "opacity-50",
					)}
				>
					Toggle User Speaking
				</button>
			</div>

			<div className="space-y-2">
				<div className="text-sm font-medium text-white">Messages</div>
				<div className="flex gap-2">
					<button
						onClick={simulateAgentMessage}
						disabled={!isConnected.value}
						className={cn(
							buttonStyles,
							"bg-blue-500/30 text-white hover:bg-blue-500/40",
							!isConnected.value && "opacity-50",
						)}
					>
						Add Agent Message
					</button>
					<button
						onClick={simulateUserMessage}
						disabled={!isConnected.value}
						className={cn(
							buttonStyles,
							"bg-green-500/30 text-white hover:bg-green-500/40",
							!isConnected.value && "opacity-50",
						)}
					>
						Add User Message
					</button>
				</div>
			</div>

			<div className="space-y-2">
				<div className="text-sm font-medium text-white">State</div>
				<div className="space-y-1 font-mono text-xs text-gray-100">
					<div>Connected: {isConnected.value ? "Yes" : "No"}</div>
					<div>Agent Speaking: {isSpeaking.value ? "Yes" : "No"}</div>
					<div>User Speaking: {isUserSpeaking.value ? "Yes" : "No"}</div>
					<div>Messages: {transcript.value.length}</div>
					<div>Volume: {volume.value.toFixed(2)}</div>
				</div>
			</div>
		</div>
	);
});

const DebugPanel = memo(function DebugPanel() {
	useSignals();
	const dragRef = useRef<HTMLDivElement>(null);
	const startHeightRef = useRef(0);
	const startYRef = useRef(0);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.altKey && e.code === "KeyD") {
				e.preventDefault();
				isDebugMode.value = !isDebugMode.value;
			} else if (e.altKey && e.code === "KeyT") {
				isTranscriptOpen.value = !isTranscriptOpen.value;
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			if (!dragRef.current?.dataset.dragging) return;

			const dy = startYRef.current - e.clientY;
			const newHeight = Math.min(
				800,
				Math.max(200, startHeightRef.current + dy),
			);
			debugPanelHeight.value = newHeight;
		};

		const handleMouseUp = () => {
			if (dragRef.current) {
				dragRef.current.dataset.dragging = "";
			}
			document.body.style.cursor = "";
		};

		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);
		return () => {
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
		};
	}, []);

	const handleDragStart = (e: React.MouseEvent) => {
		dragRef.current!.dataset.dragging = "true";
		startHeightRef.current = debugPanelHeight.value;
		startYRef.current = e.clientY;
		document.body.style.cursor = "row-resize";
	};

	if (!isDebugMode.value) return null;

	return (
		<div
			className="fixed bottom-0 left-0 right-0 bg-gray-950/95 backdrop-blur-sm border-t border-gray-700/50 z-[9999]"
			style={{ height: `${debugPanelHeight.value}px` }}
		>
			{/* Drag handle */}
			<div
				ref={dragRef}
				className="absolute -top-3 left-0 right-0 h-3 flex items-center justify-center cursor-row-resize group"
				onMouseDown={handleDragStart}
			>
				<div className="w-16 h-1 rounded-full bg-gray-700/50 group-hover:bg-gray-600/50 transition-colors" />
			</div>

			<div className="flex items-center justify-between p-2 border-b border-gray-700/50 bg-gray-900/50">
				<div className="text-sm font-medium text-white">Voice Chat Debug</div>
				<div className="text-xs text-gray-300">Press Alt+D to toggle</div>
			</div>

			<DebugControls />
		</div>
	);
});

async function requestMicrophonePermission() {
	try {
		await navigator.mediaDevices.getUserMedia({ audio: true });
		return true;
	} catch (error) {
		console.error("Microphone permission denied:", error);
		return false;
	}
}

async function getSignedUrl(agentId: string) {
	try {
		const response = await fetch(
			`/api/elevenlabs/signed-url?agentId=${agentId}`,
		);
		if (!response.ok) throw new Error("Failed to get signed URL");
		const data = await response.json();
		return data.signedUrl;
	} catch (error) {
		console.error("Error getting signed URL:", error);
		throw error;
	}
}

// Add at the top level with other signals
export const audioQueue = signal<{
	chunks: Array<{
		buffer: AudioBuffer;
		alignment?: {
			charStartTimesMs: number[];
			charDurationsMs: number[];
			chars: string[];
		};
	}>;
	isPlaying: boolean;
}>({ chunks: [], isPlaying: false });

// Add AudioQueueManager class before the startConversation function
class AudioQueueManager {
	private ctx: AudioContext;
	private currentSource: AudioBufferSourceNode | null = null;
	private nextStartTime: number = 0;

	constructor(ctx: AudioContext) {
		this.ctx = ctx;
	}

	async addToQueue(
		arrayBuffer: ArrayBuffer,
		alignment?: {
			charStartTimesMs: number[];
			charDurationsMs: number[];
			chars: string[];
		},
	) {
		try {
			const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
			audioQueue.value = {
				...audioQueue.value,
				chunks: [
					...audioQueue.value.chunks,
					{ buffer: audioBuffer, alignment },
				],
			};
			this.processQueue();
		} catch (error) {
			console.error("Error decoding audio for queue:", error);
		}
	}

	private processQueue() {
		if (audioQueue.value.isPlaying || audioQueue.value.chunks.length === 0) {
			return;
		}

		audioQueue.value = { ...audioQueue.value, isPlaying: true };
		this.playNextChunk();
	}

	private playNextChunk() {
		if (audioQueue.value.chunks.length === 0) {
			audioQueue.value = { ...audioQueue.value, isPlaying: false };
			return;
		}

		const { buffer, alignment } = audioQueue.value.chunks[0];
		audioQueue.value = {
			...audioQueue.value,
			chunks: audioQueue.value.chunks.slice(1),
		};

		const source = this.ctx.createBufferSource();
		source.buffer = buffer;
		source.connect(this.ctx.destination);

		// Calculate start time for precise scheduling
		const startTime = Math.max(this.ctx.currentTime, this.nextStartTime);
		source.start(startTime);
		this.nextStartTime = startTime + buffer.duration;

		// Log alignment data for debugging
		if (alignment) {
			debugLog(
				"Playing audio chunk with alignment",
				{
					duration: buffer.duration,
					chars: alignment.chars.join(""),
					startTimes: alignment.charStartTimesMs,
				},
				"speech",
			);
		}

		source.onended = () => {
			this.currentSource = null;
			this.playNextChunk();
		};

		this.currentSource = source;
	}

	clear() {
		if (this.currentSource) {
			this.currentSource.stop();
			this.currentSource.disconnect();
			this.currentSource = null;
		}
		audioQueue.value = { chunks: [], isPlaying: false };
		this.nextStartTime = 0;
	}
}

// Update the speakText function
async function speakText(text: string) {
	const ctx = audioContext.value;
	if (!ctx) {
		console.error("No audio context available");
		return;
	}

	debugLog("Sending text to speech", { text }, "speech");
	isSpeaking.value = true;

	// Create queue manager instance
	const queueManager = new AudioQueueManager(ctx);

	const ws = new WebSocket(
		"wss://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb/stream-input?optimize_streaming_latency=0",
	);

	ws.onopen = () => {
		ws.send(
			JSON.stringify({
				text: " ",
				voice_settings: {
					stability: 0.5,
					similarity_boost: 0.8,
				},
				"xi-api-key": import.meta.env.VITE_ELEVENLABS_API_KEY,
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

	ws.onmessage = async (event) => {
		const data = JSON.parse(event.data);
		if (data.audio) {
			debugLog(
				"Received audio chunk",
				{
					length: data.audio.length,
					isFinal: data.isFinal,
					hasAlignment: !!data.alignment,
				},
				"speech",
			);

			try {
				// Convert base64 to ArrayBuffer
				const audioData = atob(data.audio);
				const arrayBuffer = new ArrayBuffer(audioData.length);
				const view = new Uint8Array(arrayBuffer);
				for (let i = 0; i < audioData.length; i++) {
					view[i] = audioData.charCodeAt(i);
				}

				// Add to queue with alignment data if available
				await queueManager.addToQueue(
					arrayBuffer,
					data.normalizedAlignment || data.alignment,
				);

				if (data.isFinal) {
					debugLog("Final audio chunk received", null, "speech");
					ws.close();
				}
			} catch (error) {
				console.error("Error processing audio chunk:", error);
			}
		}
	};

	ws.onerror = (error) => {
		console.error("WebSocket error:", error);
		queueManager.clear();
		isSpeaking.value = false;
		ws.close();
	};

	ws.onclose = () => {
		debugLog("WebSocket closed", null, "speech");
		// Keep isSpeaking true until the last chunk finishes playing
		if (!audioQueue.value.chunks.length && !audioQueue.value.isPlaying) {
			isSpeaking.value = false;
		}
	};
}

// Replace startConversation with our own implementation
async function startConversation() {
	debugLog("Starting conversation...");
	try {
		const hasPermission = await requestMicrophonePermission();
		if (!hasPermission) {
			debugLog("Microphone permission denied");
			alert("Microphone permission is required for the conversation.");
			return;
		}

		const params = new URLSearchParams(window.location.search);
		const agentId = params.get("agentId");
		if (!agentId) {
			debugLog("No agent ID found");
			alert("No agent ID found. Please try refreshing the page.");
			return;
		}

		// Initialize ChatBot
		const bot = new ChatBot();
		await bot.initialize();
		chatbot.value = bot;

		// Initialize audio context and analyzer for speech detection
		const context = new AudioContext();
		audioContext.value = context;

		// Set up audio stream for microphone
		const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		audioStream.value = stream;

		// Create analyzer node for speech detection
		const analyzer = context.createAnalyser();
		analyzer.fftSize = 2048;
		const source = context.createMediaStreamSource(stream);
		source.connect(analyzer);

		speechDetector.value = { context, analyzer, source };

		// Start speech detection loop
		let silenceStart = Date.now();
		const silenceThreshold = -50; // dB
		const silenceTimeout = 1000; // ms

		function detectSpeech() {
			if (!isListening.value || !speechDetector.value) return;

			const { analyzer } = speechDetector.value;
			const dataArray = new Float32Array(analyzer.frequencyBinCount);
			analyzer.getFloatFrequencyData(dataArray);

			// Calculate average volume
			const average = dataArray.reduce((a, b) => a + b) / dataArray.length;

			if (average > silenceThreshold) {
				if (!isUserSpeaking.value) {
					debugLog("User started speaking", { volume: average }, "user");
					isUserSpeaking.value = true;
				}
				silenceStart = Date.now();
			} else if (
				isUserSpeaking.value &&
				Date.now() - silenceStart > silenceTimeout
			) {
				debugLog(
					"User stopped speaking",
					{ silenceDuration: Date.now() - silenceStart },
					"user",
				);
				isUserSpeaking.value = false;
				// TODO: Trigger speech-to-text processing here
			}

			requestAnimationFrame(detectSpeech);
		}

		// Start listening
		isListening.value = true;
		isConnected.value = true;
		detectSpeech();

		// Handle user speech end and generate response
		effect(() => {
			if (!isUserSpeaking.value && chatbot.value) {
				// TODO: Get speech-to-text transcript and process it
				const mockTranscript = "This is a mock transcript"; // Replace with actual STT
				chatbot.value
					.handleVoiceTranscript(mockTranscript, "user")
					.then((response) => {
						if (response) {
							speakText(response.response.content);
							transcript.value = [
								...transcript.value,
								{ message: mockTranscript, source: "user" },
								{ message: response.response.content, source: "ai" },
							];
						}
					});
			}
		});
	} catch (error) {
		debugLog("Error starting conversation:", error);
		console.error("Error starting conversation:", error);
		alert("Failed to start conversation. Please try again.");
	}
}

// Update endConversation to clean up our new resources
async function endConversation() {
	debugLog("Ending conversation...");

	// Stop listening
	isListening.value = false;
	isConnected.value = false;
	isSpeaking.value = false;
	isUserSpeaking.value = false;

	// Clean up audio resources
	if (speechDetector.value) {
		speechDetector.value.source.disconnect();
		speechDetector.value = null;
	}

	if (audioStream.value) {
		audioStream.value.getTracks().forEach((track) => track.stop());
		audioStream.value = null;
	}

	if (audioContext.value) {
		await audioContext.value.close();
		audioContext.value = null;
	}

	// Clean up ChatBot
	chatbot.value = null;

	// Clear audio queue
	if (audioContext.value) {
		const queueManager = new AudioQueueManager(audioContext.value);
		queueManager.clear();
	}

	debugLog("Conversation ended");
}

export function VoiceChat() {
	useSignals();

	useEffect(() => {
		// Get agent ID from URL parameters
		const params = new URLSearchParams(window.location.search);
		const id = params.get("agentId");
		const name = params.get("name");
		if (name) {
			agentName.value = decodeURIComponent(name);
		}
		if (id) {
			agentId.value = id;
		}

		return () => {
			// if (conversation.value) {
			// 	conversation.value.endSession();
			// }
		};
	}, []);

	return (
		<>
			<div className="flex flex-col h-screen bg-gray-900 text-gray-100">
				{/* Top toolbar */}
				<div className="h-14 flex justify-between items-center px-4 bg-gray-800/50 backdrop-blur-sm border-b border-gray-700/50">
					<div className="flex items-center gap-4">
						<h2 className="text-sm font-medium text-gray-300">
							{agentName.value || "Voice Chat"}
						</h2>
						<StatusIndicator />
					</div>
					<div className="flex items-center gap-4">
						<VolumeControl />
						{isConnected.value && (
							<button
								onClick={endConversation}
								className={cn(
									buttonStyles,
									"text-red-200/70 hover:text-red-200",
								)}
							>
								End Conversation
							</button>
						)}
					</div>
				</div>

				<div className="flex-1 flex">
					{/* Main content */}
					<div className="flex-1 flex flex-col items-center justify-center p-4 relative">
						<div className="w-full max-w-sm space-y-4">
							{!new URLSearchParams(window.location.search).get("agentId") ? (
								<div className="text-center space-y-3">
									<div className="text-gray-400">
										No agent ID provided. You need a unique link to access an
										agent.
									</div>
									<div className="text-sm text-gray-500">
										Use the create-agent script to generate a new agent and get
										its URL.
									</div>
								</div>
							) : !isConnected.value ? (
								<div className="text-center space-y-4">
									<button
										onClick={startConversation}
										className={cn(
											buttonStyles,
											"w-full text-blue-200/70 hover:text-blue-200",
										)}
									>
										Start Conversation
									</button>
									<div className="text-sm text-gray-500">
										Click the button above to start talking with{" "}
										{agentName.value}
									</div>
								</div>
							) : (
								<AgentCircle />
							)}
						</div>
						<TranscriptToggle />
					</div>

					<TranscriptSidebar />
				</div>
			</div>
			<DebugPanel />
		</>
	);
}
