import type { Signal } from "@preact/signals-react";
import { useSignals } from "@preact/signals-react/runtime";
import { useEffect } from "react";

interface TimelineCursorProps {
	timelinePosition: Signal<number>;
	elapsedTime: Signal<number>;
	isPlaying: Signal<boolean>;
	width?: number;
}

export function TimelineCursor({
	timelinePosition,
	elapsedTime,
	isPlaying,
	width = 5000, // Default timeline width
}: TimelineCursorProps) {
	useSignals();

	useEffect(() => {
		let lastTime = performance.now();
		let animationFrameId: number | null = null;

		const animate = (currentTime: number) => {
			const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
			lastTime = currentTime;

			if (isPlaying.value) {
				timelinePosition.value += 100 * deltaTime; // Move 100 pixels per second
				elapsedTime.value += deltaTime;

				// Reset if we reach the end
				if (timelinePosition.value >= width) {
					timelinePosition.value = 0;
					elapsedTime.value = 0;
				}
			}

			animationFrameId = requestAnimationFrame(animate);
		};

		if (isPlaying.value) {
			animationFrameId = requestAnimationFrame(animate);
		}

		return () => {
			if (animationFrameId) {
				cancelAnimationFrame(animationFrameId);
			}
		};
	}, [isPlaying.value, timelinePosition, elapsedTime, width]);

	return (
		<div
			className="absolute top-0 bottom-0 w-1 bg-blue-500 z-50 cursor-col-resize"
			style={{
				left: `${timelinePosition.value}px`,
				transform: "translateX(-50%)",
			}}
		/>
	);
}
