import { transformShapes } from "@/lib/utils";
import { signal, effect } from "@preact/signals-react";
import type { Editor, TLShape, TLShapeId } from "tldraw";

// Global signals
export const timelinePosition = signal(0);
export const elapsedTime = signal(0);
export const isPlaying = signal(false);
export const activeDocuments = signal<TLShapeId[]>([]);
export const documents = signal<TLShape[]>([]);
export const editor = signal<Editor | null>(null);

const SPEED = 100; // pixels per second
const MAX_WIDTH = 5000;
const TIMELINE_CURSOR_ID = "shape:timeline-cursor" as TLShapeId;

// Helper functions
export const resetTimeline = () => {
	timelinePosition.value = 0;
	elapsedTime.value = 0;
	isPlaying.value = false;
};

export const togglePlayback = () => {
	isPlaying.value = !isPlaying.value;
};

export const updateShapes = async () => {
	if (!editor.value) return;

	// Get all shapes from the current page
	const allShapes = editor.value.getCurrentPageShapes();

  const simpleShapes = transformShapes(allShapes);

  // Send shapes to the API
  try {
    await fetch("/api/shapes", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(simpleShapes),
    });
  } catch (error) {
    console.error("Failed to save shapes:", error);
  }

	// Update documents signal with a new array
	const shapeArray = Array.from(allShapes);
	documents.value = shapeArray;

	// Update active documents based on timeline position
	const activeShapeIds = shapeArray
		.filter((shape) => shape.x > timelinePosition.value)
		.map((shape) => shape.id);

	activeDocuments.value = activeShapeIds;
};

// Create and manage timeline cursor
export const createTimelineCursor = () => {
	if (!editor.value) return;

	// Create timeline cursor shape
	editor.value.createShapes([
		{
			id: TIMELINE_CURSOR_ID,
			type: "line",
			x: timelinePosition.value,
			y: 0,
			props: {
				color: "light-blue",
				dash: "draw",
				size: "m",
			},
		},
	]);
};

// Timeline animation effect
effect(() => {
	if (!isPlaying.value || !editor.value) return;

	let lastTime = performance.now();
	const intervalId = window.setInterval(() => {
		const currentTime = performance.now();
		const deltaTime = (currentTime - lastTime) / 1000;
		lastTime = currentTime;

		timelinePosition.value += SPEED * deltaTime;
		elapsedTime.value += deltaTime;

		// Reset if we reach the end
		if (timelinePosition.value >= MAX_WIDTH) {
			timelinePosition.value = 0;
			elapsedTime.value = 0;
		}

		// Update the timeline shape position
		editor.value?.updateShapes([
			{
				id: TIMELINE_CURSOR_ID,
				type: "line",
				x: timelinePosition.value,
				y: 0,
			},
		]);
	}, 1000 / 60); // 60fps

	return () => window.clearInterval(intervalId);
});
