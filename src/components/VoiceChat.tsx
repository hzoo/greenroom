import { signal, effect } from "@preact/signals-react";
import { Conversation } from "@11labs/client";
import type { Role } from "@11labs/client";
import { useEffect, memo, useRef } from "react";
import { useSignalEffect, useSignals } from "@preact/signals-react/runtime";
import { cn } from "@/lib/utils";

// Debug logging for signal changes
function debugLog(message: string, data?: unknown) {
	console.log(
		`%c[Debug] %c${message}`,
		"color: #8b5cf6",
		"color: #94a3b8",
		data ?? "",
	);
}

// Conversation state signals
const conversation = signal<Conversation | null>(null);
const isConnected = signal(false);
const isSpeaking = signal(false);
const isUserSpeaking = signal(false);
const agentName = signal<string>("");
const agentId = signal<string>("");
const volume = signal(1);
const transcript = signal<Array<{ message: string; source: Role }>>([]);

// Debug mode signal
const isDebugMode = signal(true);
const debugPanelHeight = signal(300);

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
					if (conversation.value) {
						conversation.value.setVolume({ volume: volume.value });
					}
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

	// Auto-scroll to bottom when new messages arrive
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	});

	if (!isConnected.value) return null;

	return (
		<div
			className="w-80 border-l border-gray-700/50 bg-gray-800/30 backdrop-blur-sm p-4 overflow-y-auto"
			ref={scrollRef}
		>
			<div className="text-sm font-medium text-gray-400 mb-4">Transcript</div>
			<div className="space-y-4">
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
			conversation.value = mockConversation as unknown as Conversation;
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

		debugLog("Getting signed URL for agent:", agentId);
		const signedUrl = await getSignedUrl(agentId);
		debugLog("Got signed URL:", signedUrl);

		debugLog("Starting session...");
		const conv = await Conversation.startSession({
			signedUrl,
			onConnect: (props) => {
				debugLog("Connected to conversation:", props);
				isConnected.value = true;
				isSpeaking.value = true;
			},
			onDisconnect: (details) => {
				debugLog("Disconnected from conversation:", details);
				isConnected.value = false;
				isSpeaking.value = false;
			},
			onError: (error, context) => {
				debugLog("Conversation error:", { error, context });
				console.error("Conversation error:", error);
				alert("An error occurred during the conversation.");
			},
			onModeChange: (mode) => {
				debugLog("Mode changed:", mode);
				isSpeaking.value = mode.mode === "speaking";
				isUserSpeaking.value = mode.mode === "listening";
			},
			onMessage: (msg) => {
				debugLog("Message received:", msg);
				transcript.value = [
					...transcript.value,
					{ message: msg.message, source: msg.source },
				];
			},
			onStatusChange: (status) => {
				debugLog("Status changed:", status);
			},
		});
		debugLog("Session started successfully");
		conversation.value = conv;
		debugLog("Conversation ID:", conv.getId());

		// Set initial volume
		debugLog("Setting initial volume:", volume.value);
		conv.setVolume({ volume: volume.value });
	} catch (error) {
		debugLog("Error starting conversation:", error);
		console.error("Error starting conversation:", error);
		alert("Failed to start conversation. Please try again.");
	}
}

async function endConversation() {
	debugLog("Ending conversation...");
	if (conversation.value) {
		await conversation.value.endSession();
		conversation.value = null;
		debugLog("Conversation ended");
	}
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
			if (conversation.value) {
				conversation.value.endSession();
			}
		};
	}, []);

	return (
		<>
			<div className="flex flex-col h-screen bg-gray-900 text-gray-100">
				{/* Top toolbar */}
				<div className="flex justify-between items-center p-4 bg-gray-800/50 backdrop-blur-sm border-b border-gray-700/50">
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
								<button
									onClick={startConversation}
									className={cn(
										buttonStyles,
										"w-full text-blue-200/70 hover:text-blue-200",
									)}
								>
									Start Conversation
								</button>
							) : (
								<AgentCircle />
							)}
						</div>
					</div>

					<TranscriptSidebar />
				</div>
			</div>
			<DebugPanel />
		</>
	);
}
