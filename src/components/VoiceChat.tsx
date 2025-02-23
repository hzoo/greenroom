import { signal } from "@preact/signals-react";
import { memo, useRef } from "react";
import { useSignalEffect, useSignals } from "@preact/signals-react/runtime";
import { cn } from "@/lib/utils";
import { isSpeaking, isUserSpeaking } from "@/store/signals";

// Add at the top level with other signals
export const audioContext = signal<AudioContext | null>(null);

// Add these new signals at the top with other signals
export const audioStream = signal<MediaStream | null>(null);
export const speechDetector = signal<{
	context: AudioContext;
	analyzer: AnalyserNode;
	source: MediaStreamAudioSourceNode;
} | null>(null);

// Add new signal for WebSocket audio analyzer
export const wsAudioAnalyzer = signal<AnalyserNode | null>(null);

// Export AgentCircle for reuse
export const AgentCircle = memo(function AgentCircle() {
	useSignals();
	const canvasRef = useRef<HTMLCanvasElement>(null);

	// Effect for frequency visualization
	useSignalEffect(() => {
		if (!canvasRef.current) return;

		const canvas = canvasRef.current;
		const context = canvas.getContext("2d");
		if (!context) return;

		const centerX = canvas.width / 2;
		const centerY = canvas.height / 2;
		const radius = Math.min(centerX, centerY) - 10;

		let animationFrame: number;

		function drawFrequencies() {
			if (!context) return;

			// Get frequency data from appropriate analyzer
			const freqData = new Uint8Array(256);
			if (isSpeaking.value && wsAudioAnalyzer.value) {
				wsAudioAnalyzer.value.getByteFrequencyData(freqData);
			} else if (isUserSpeaking.value && speechDetector.value?.analyzer) {
				speechDetector.value.analyzer.getByteFrequencyData(freqData);
			}

			// Clear canvas
			context.clearRect(0, 0, canvas.width, canvas.height);

			// Draw frequency bars in a circle
			const barCount = Math.min(64, freqData.length);
			const barWidth = (2 * Math.PI) / barCount;

			for (let i = 0; i < barCount; i++) {
				const amplitude = freqData[i] / 255.0;
				const barHeight = amplitude * 30;

				const angle = i * barWidth;

				const innerX = centerX + (radius - 5) * Math.cos(angle);
				const innerY = centerY + (radius - 5) * Math.sin(angle);
				const outerX = centerX + (radius - 5 + barHeight) * Math.cos(angle);
				const outerY = centerY + (radius - 5 + barHeight) * Math.sin(angle);

				context.beginPath();
				context.moveTo(innerX, innerY);
				context.lineTo(outerX, outerY);
				context.strokeStyle = isSpeaking.value
					? `rgba(59, 130, 246, ${amplitude})`
					: `rgba(34, 197, 94, ${amplitude})`;
				context.lineWidth = 3;
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
				width={200}
				height={200}
				className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
			/>
			<div
				className={cn(
					"h-32 w-32 rounded-full transition-all duration-300 relative",
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
