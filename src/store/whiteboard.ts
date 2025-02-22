import { transformShapes } from "@/lib/utils";
import { signal, effect } from "@preact/signals-react";
import type { Editor, TLShape, TLShapeId } from "tldraw";

// Global signals
export const timelinePosition = signal(0);
export const elapsedTime = signal(0);
export const isPlaying = signal(true); // Default to playing
export const activeDocuments = signal<TLShapeId[]>([]);
export const documents = signal<TLShape[]>([]);
export const editor = signal<Editor | null>(null);

// debug panel state
export const isDebugOpen = signal(true);

const SPEED = 100; // pixels per second
export const MAX_WIDTH = 5000;
export const TIMELINE_CURSOR_ID = "shape:timeline-cursor" as TLShapeId;

// Initial shape positions
const INITIAL_SHAPES = [
	{ x: 100, y: 100, color: "blue" },
	{ x: 300, y: 150, color: "green" },
	{ x: 500, y: 200, color: "yellow" },
] as const;

// Helper functions
export const resetTimeline = () => {
	timelinePosition.value = 0;
	elapsedTime.value = 0;
	isPlaying.value = true; // Keep playing after reset
};

export const togglePlayback = () => {
	isPlaying.value = !isPlaying.value;
};

export const updateShapes = async () => {
	if (!editor.value) return;

	// Get all shapes from the current page
	const allShapes = editor.value.getCurrentPageShapes();

	// Filter out the timeline cursor
	const userShapes = Array.from(allShapes).filter(
		(shape) => shape.id !== TIMELINE_CURSOR_ID,
	);

	const simpleShapes = transformShapes(userShapes);

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
	documents.value = userShapes;

	// Update active documents based on timeline position
	const activeShapeIds = userShapes
		.filter((shape) => shape.x > timelinePosition.value)
		.map((shape) => shape.id);

	activeDocuments.value = activeShapeIds;
};

// Create and manage timeline cursor
export const createTimelineCursor = () => {
	if (!editor.value) return;

	// Check if cursor already exists
	const existingCursor = editor.value.getShape(TIMELINE_CURSOR_ID);
	if (existingCursor) return;

	editor.value.createShapes([
		{
			id: TIMELINE_CURSOR_ID,
			type: "geo",
			x: timelinePosition.value,
			y: 0,
			props: {
				geo: "rectangle",
				color: "light-red",
				dash: "solid",
				size: "s",
				w: 1,
				h: 2000,
			},
		},
	]);
};

// Create initial shapes
export const createInitialShapes = (editorInstance: Editor) => {
	// Check if we already have shapes (excluding cursor)
	const existingShapes = Array.from(
		editorInstance.getCurrentPageShapes(),
	).filter((shape) => shape.id !== TIMELINE_CURSOR_ID);

	if (existingShapes.length > 0) return;

	// Create initial shapes
	INITIAL_SHAPES.forEach(({ x, y, color }) => {
		editorInstance.createShapes([
			{
				type: "geo",
				x,
				y,
				props: {
					geo: "rectangle",
					color,
					w: 100,
					h: 100,
				},
			},
		]);
	});
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
				type: "geo",
				x: timelinePosition.value,
				y: -1000,
			},
		]);
	}, 1000 / 60); // 60fps

	return () => window.clearInterval(intervalId);
});
