import { useSignals } from "@preact/signals-react/runtime";
import { useEffect, memo, useRef } from "react";
import { cn } from "@/lib/utils";
import { speechState } from "@/lib/speech/SpeechControl";
import { createPersistedSignal } from "@/store/signals";
import { signal } from "@preact/signals-react";

// UI State
const isTranscriptOpen = signal(true);
const transcriptWidth = createPersistedSignal("transcript-width", 320);
const buttonStyles =
	"px-3 py-2 text-sm rounded-md border border-gray-200/20 hover:bg-gray-700/50 transition-colors";

// Status Indicator Component
const StatusIndicator = memo(function StatusIndicator() {
	useSignals();
	const { isConnected, isSpeaking, isUserSpeaking } = speechState.value;

	return (
		<div
			className={cn(
				"px-3 py-1 rounded-full text-xs font-medium",
				isConnected
					? isSpeaking
						? "bg-blue-500/20 text-blue-200 border border-blue-500/30"
						: isUserSpeaking
							? "bg-green-500/20 text-green-200 border border-green-500/30"
							: "bg-gray-500/20 text-gray-200 border border-gray-500/30"
					: "bg-red-500/20 text-red-200 border border-red-500/30",
			)}
		>
			{isConnected
				? isSpeaking
					? "Agent Speaking"
					: isUserSpeaking
						? "You're Speaking"
						: "Agent Listening"
				: "Disconnected"}
		</div>
	);
});

// Volume Control Component
const VolumeControl = memo(function VolumeControl() {
	useSignals();
	const { volume } = speechState.value;

	return (
		<div className="flex items-center gap-3">
			<div className="text-xs text-gray-400">Volume</div>
			<input
				type="range"
				min="0"
				max="1"
				step="0.1"
				value={volume}
				onChange={(e) => {
					speechState.value = {
						...speechState.value,
						volume: Number(e.target.value),
					};
				}}
				className="w-24 accent-blue-500"
			/>
			<div className="text-xs text-gray-400 font-mono w-8">
				{Math.round(volume * 100)}%
			</div>
		</div>
	);
});

// Agent Circle Component
export const AgentCircle = memo(function AgentCircle() {
	useSignals();
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const { isSpeaking } = speechState.value;

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		// Store dimensions and context to avoid null checks
		const width = canvas.width;
		const height = canvas.height;
		const centerX = width / 2;
		const centerY = height / 2;
		const radius = Math.min(centerX, centerY) - 10;
		const context = ctx; // Reassign to const to ensure TypeScript knows it's not null

		let animationFrame: number;

		function drawFrequencies() {
			// Get frequency data from audio queue
			const freqData = new Uint8Array(64).fill(0); // Placeholder for now

			// Clear canvas
			context.clearRect(0, 0, width, height);

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
				context.strokeStyle = isSpeaking
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
	}, [isSpeaking]);

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
					isSpeaking
						? "bg-blue-500/20 scale-110 animate-pulse border-blue-400/30"
						: speechState.value.isUserSpeaking
							? "bg-green-500/20 scale-105 border-green-400/30"
							: "bg-gray-600/20 border-gray-400/20",
					"border-2",
				)}
			/>
		</div>
	);
});

// Transcript Message Component
const TranscriptMessage = memo(function TranscriptMessage({
	message,
	source,
}: {
	message: string;
	source: "user" | "ai";
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

// Transcript Sidebar Component
const TranscriptSidebar = memo(function TranscriptSidebar() {
	useSignals();
	const scrollRef = useRef<HTMLDivElement>(null);
	const dragRef = useRef<HTMLDivElement>(null);
	const { isConnected, transcript } = speechState.value;

	// Auto-scroll to bottom when new messages arrive
	useEffect(() => {
		const container = scrollRef.current;
		if (container) {
			container.scrollTop = container.scrollHeight;
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

	if (!isConnected || !isTranscriptOpen.value) return null;

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
				{transcript.map((msg, i) => (
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

// Transcript Toggle Component
const TranscriptToggle = memo(function TranscriptToggle() {
	useSignals();
	const { isConnected } = speechState.value;

	if (isTranscriptOpen.value || !isConnected) return null;

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

// Main Voice Chat UI Component
export function VoiceChatUI({
	onStart,
	onStop,
}: {
	onStart: () => void;
	onStop: () => void;
}) {
	useSignals();
	const { isConnected } = speechState.value;

	return (
		<div className="flex flex-col h-screen bg-gray-900 text-gray-100">
			{/* Top toolbar */}
			<div className="h-14 flex justify-between items-center px-4 bg-gray-800/50 backdrop-blur-sm border-b border-gray-700/50">
				<div className="flex items-center gap-4">
					<h2 className="text-sm font-medium text-gray-300">Voice Chat</h2>
					<StatusIndicator />
				</div>
				<div className="flex items-center gap-4">
					<VolumeControl />
					{isConnected ? (
						<button
							onClick={onStop}
							className={cn(buttonStyles, "text-red-200/70 hover:text-red-200")}
						>
							End Conversation
						</button>
					) : (
						<button
							onClick={onStart}
							className={cn(
								buttonStyles,
								"text-blue-200/70 hover:text-blue-200",
							)}
						>
							Start Conversation
						</button>
					)}
				</div>
			</div>

			<div className="flex-1 flex">
				{/* Main content */}
				<div className="flex-1 flex flex-col items-center justify-center p-4 relative">
					<div className="w-full max-w-sm space-y-4">
						<AgentCircle />
					</div>
					<TranscriptToggle />
				</div>

				<TranscriptSidebar />
			</div>
		</div>
	);
}
