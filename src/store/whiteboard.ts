import { transformShapes } from "@/lib/utils";
import { signal, effect, computed } from "@preact/signals-react";
import { createPersistedSignal } from "./signals";
import type { Editor, TLShape, TLShapeId } from "tldraw";

// Constants
const SPEED = 100; // pixels per second
export const TIMELINE_WIDTH = 5000;
export const TIMELINE_HEIGHT = 2000;
export const TIMELINE_CURSOR_ID = "shape:timeline-cursor" as TLShapeId;
export const TIMELINE_BOX_ID = "shape:timeline-box" as TLShapeId;
export const DEFAULT_DEBUG_HEIGHT = 320;

// Global signals
export const timelinePosition = signal(0);
export const elapsedTime = signal(0);
export const isPlaying = signal(true); // Default to playing
export const activeDocuments = signal<TLShapeId[]>([]);
export const documents = signal<TLShape[]>([]);
export const editor = signal<Editor | null>(null);
export const debugPanelHeight = createPersistedSignal(
	"debug-panel-height",
	DEFAULT_DEBUG_HEIGHT,
);

// computed signals
export const progress = computed(() => timelinePosition.value / TIMELINE_WIDTH);
export const markerPositions = computed(() => {
	const positions = new Set(
		documents.value
			.filter((doc) => doc.id !== TIMELINE_CURSOR_ID)
			.map((shape) => Math.round(shape.x / 10) * 10),
	);
	return Array.from(positions);
});

// debug panel state
export const isDebugOpen = signal(true);

// System shape IDs to ignore in updates
export const SYSTEM_SHAPE_IDS = [
	TIMELINE_CURSOR_ID,
	TIMELINE_BOX_ID,
] as readonly TLShapeId[];

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

	// Filter out system shapes (timeline cursor and box)
	const userShapes = Array.from(allShapes).filter(
		(shape) => !SYSTEM_SHAPE_IDS.includes(shape.id),
	);

	const simpleShapes = transformShapes(userShapes);

	// Send shapes to the API
	try {
		await fetch("/api/shapes", {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				shapes: simpleShapes,
				timelinePosition: timelinePosition.value,
			}),
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

// Create timeline bounding box
export const createTimelineBox = () => {
	if (!editor.value) return;

	// Check if box already exists
	const existingBox = editor.value.getShape(TIMELINE_BOX_ID);
	if (existingBox) return;

	editor.value.createShapes([
		{
			id: TIMELINE_BOX_ID,
			type: "geo",
			x: 0,
			y: -TIMELINE_HEIGHT / 2,
			props: {
				geo: "rectangle",
				color: "light-violet",
				dash: "dashed",
				size: "l",
				w: TIMELINE_WIDTH,
				h: TIMELINE_HEIGHT,
			},
		},
	]);
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
				h: TIMELINE_HEIGHT,
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
		if (timelinePosition.value >= TIMELINE_WIDTH) {
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
