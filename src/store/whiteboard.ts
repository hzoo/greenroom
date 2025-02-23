import { transformShapes } from "../lib/utils";
import { signal, effect, computed } from "@preact/signals-react";
import type { Editor, TLShape, TLShapeId } from "tldraw";
import type { SimpleShape } from "../lib/utils";
import { createPersistedSignal } from "./signals";

// Constants
const SPEED = 10; // pixels per second
export const TIMELINE_WIDTH = 2000;
export const TIMELINE_HEIGHT = 1200;
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

// Track shapes being modified and their last modification time
export const modifiedShapes = signal<Map<TLShapeId, number>>(new Map());
const MODIFICATION_COOLDOWN = 2000; // 2 seconds before a shape is considered "unmodified"

// Check if a shape is being modified or was recently modified
const isShapeModified = (shapeId: TLShapeId): boolean => {
	const lastModified = modifiedShapes.value.get(shapeId);
	if (!lastModified) return false;
	return Date.now() - lastModified < MODIFICATION_COOLDOWN;
};

// Update modification time for a shape
export const markShapeAsModified = (shapeId: TLShapeId) => {
	const newMap = new Map(modifiedShapes.value);
	newMap.set(shapeId, Date.now());
	modifiedShapes.value = newMap;
};

// Clean up old modifications
const cleanupModifications = () => {
	const now = Date.now();
	const newMap = new Map();
	for (const [id, time] of modifiedShapes.value.entries()) {
		if (now - time < MODIFICATION_COOLDOWN) {
			newMap.set(id, time);
		}
	}
	modifiedShapes.value = newMap;
};

// Cleanup effect
effect(() => {
	const intervalId = setInterval(cleanupModifications, MODIFICATION_COOLDOWN);
	return () => clearInterval(intervalId);
});

// computed
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

// Helper function to calculate size based on text length
export const calculateShapeSize = (text: string) => {
	const height = 68; // Fixed height for all boxes
	const charWidth = 14; // Width per character in mono font
	const horizontalPadding = 32; // Padding on both sides to prevent text touching edges
	const maxWidth = 200; // Maximum width

	// Calculate width with max limit
	const width = Math.min(maxWidth, text.length * charWidth + horizontalPadding);

	return {
		w: width,
		h: height,
	};
};

// Initial shape positions
const INITIAL_SHAPES = [
	{
		x: 100,
		y: 0,
		color: getColorForStatus("future"),
		text: "casual",
		...calculateShapeSize("casual"),
	},
	{
		x: 300,
		y: TIMELINE_HEIGHT * -0.15,
		color: getColorForStatus("future"),
		text: "enthusiastic",
		...calculateShapeSize("enthusiastic"),
	},
	{
		x: 500,
		y: TIMELINE_HEIGHT * 0.2,
		color: getColorForStatus("future"),
		text: "friendly",
		...calculateShapeSize("friendly"),
	},
	{
		x: 700,
		y: TIMELINE_HEIGHT * -0.25,
		color: getColorForStatus("future"),
		text: "supportive",
		...calculateShapeSize("supportive"),
	},
] as const;

// Helper functions to create tone shapes with jitter
const VERTICAL_SCATTER_RANGE = 200; // pixels
const HORIZONTAL_JITTER_RANGE = 50; // pixels

function addRandomJitter(value: number, range: number): number {
	return value + (Math.random() - 0.5) * range;
}

export const createToneShapes = (editorInstance: Editor) => {
	// Check if we already have shapes (excluding cursor and box)
	const existingShapes = Array.from(
		editorInstance.getCurrentPageShapes(),
	).filter((shape) => !SYSTEM_SHAPE_IDS.includes(shape.id));

	if (existingShapes.length > 0) return;

	// Create tone shapes with vertical scatter and horizontal jitter
	INITIAL_SHAPES.forEach(({ x, y, color, text, w, h }) => {
		const jitteredX = addRandomJitter(x, HORIZONTAL_JITTER_RANGE);
		const scatteredY = addRandomJitter(y, VERTICAL_SCATTER_RANGE);

		editorInstance.createShapes([
			{
				type: "geo",
				x: jitteredX,
				y: scatteredY,
				props: {
					geo: "rectangle",
					color,
					w,
					h,
					text,
					font: "mono",
				},
			},
		]);
	});
};

// Function to update whiteboard shapes from shapes.json
export const updateWhiteboardShapes = async () => {
	if (!editor.value) return;

	try {
		const response = await fetch("/api/shapes");
		const { shapes } = await response.json();

		if (!shapes?.length) return;

		// Get existing shapes (excluding system shapes)
		const existingShapes = Array.from(
			editor.value.getCurrentPageShapes(),
		).filter((shape) => !SYSTEM_SHAPE_IDS.includes(shape.id));

		// Sort both sets of shapes by x position
		const sortedNewShapes = [...shapes].sort((a, b) => a.x - b.x);
		const sortedExistingShapes = [...existingShapes].sort((a, b) => a.x - b.x);

		// Compare sequences by tone names
		const newSequence = sortedNewShapes.map((shape) => shape.text);
		const existingSequence = sortedExistingShapes.map((shape) => {
			const props = shape.props as { text?: string };
			return props.text;
		});

		// Get positions of manually modified shapes
		const modifiedPositions = new Map<string, { x: number; y: number }>();
		existingShapes.forEach((shape) => {
			if (isShapeModified(shape.id)) {
				const props = shape.props as { text?: string };
				modifiedPositions.set(props.text || "", { x: shape.x, y: shape.y });
			}
		});

		// Only update if sequences are different and there are no modified shapes
		const sequencesMatch =
			newSequence.length === existingSequence.length &&
			newSequence.every((text, i) => text === existingSequence[i]);

		const hasModifiedShapes = modifiedPositions.size > 0;

		if (!sequencesMatch && !hasModifiedShapes) {
			// Complete redraw - only if no shapes are being modified
			editor.value.deleteShapes(existingShapes.map((shape) => shape.id));

			// Create new shapes from shapes.json
			shapes.forEach((shape: SimpleShape) => {
				editor.value?.createShapes([
					{
						id: shape.id as TLShapeId,
						type: "geo",
						x: shape.x,
						y: shape.y,
						props: {
							geo: "rectangle",
							color: getColorForStatus(shape.status),
							text: shape.text,
						},
						...calculateShapeSize(shape.text || ""),
					},
				]);
			});
		} else {
			// Update existing shapes while preserving modified positions
			existingShapes.forEach((shape) => {
				const props = shape.props as { text?: string };
				const matchingNewShape = shapes.find(
					(s: SimpleShape) => s.text === props.text,
				);

				if (matchingNewShape) {
					// If shape is modified, only update color/status
					const isModified = isShapeModified(shape.id);
					const modifiedPos = modifiedPositions.get(props.text || "");

					editor.value?.updateShape({
						id: shape.id,
						type: "geo",
						...(isModified
							? {}
							: {
									x: modifiedPos?.x ?? matchingNewShape.x,
									y: modifiedPos?.y ?? matchingNewShape.y,
								}),
						props: {
							...shape.props,
							color: getColorForStatus(matchingNewShape.status),
						},
					});
				}
			});
		}

		// Update the shapes.json file with current positions
		const updatedShapes = transformShapes(
			Array.from(editor.value.getCurrentPageShapes()),
		);
		await fetch("/api/shapes", {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(updatedShapes),
		});
	} catch (error) {
		console.error("Failed to update whiteboard shapes:", error);
	}
};

// Helper to get color based on shape status
// "black", "grey", "light-violet", "violet", "blue", "light-blue", "yellow", "orange", "green", "light-green", "light-red", "red", "white"
export function getColorForStatus(status: string) {
	switch (status) {
		case "past":
			return "grey";
		case "staged_within_threshold":
			return "yellow";
		case "future":
			return "blue";
		default:
			return "light-violet";
	}
}

// Effect to poll for changes to shapes.json
effect(() => {
	if (!editor.value) return;

	const pollInterval = 1000; // Poll every second
	const intervalId = setInterval(updateWhiteboardShapes, pollInterval);

	return () => clearInterval(intervalId);
});

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
				color: "grey",
				dash: "dashed",
				fill: "none",
				size: "s", // Thinner border
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
			y: -TIMELINE_HEIGHT / 2,
			props: {
				geo: "rectangle",
				color: "light-blue",
				dash: "solid",
				fill: "semi",
				size: "s",
				w: 1,
				h: TIMELINE_HEIGHT,
			},
		},
	]);
};

// Timeline animation effect
effect(() => {
	if (!isPlaying.value || !editor.value) return;

	let lastTime = performance.now();
	const intervalId = window.setInterval(() => {
		if (!editor.value) return;
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
		editor.value.animateShape({
			id: TIMELINE_CURSOR_ID,
			type: "geo",
			x: timelinePosition.value,
			y: -TIMELINE_HEIGHT / 2,
		});

		// Update shape colors based on timeline position
		const shapes = Array.from(editor.value.getCurrentPageShapes()).filter(
			(shape) => !SYSTEM_SHAPE_IDS.includes(shape.id),
		);

		shapes.forEach((shape) => {
			const shapeStart = shape.x;
			const shapeEnd = shape.x + (shape.props as { w: number }).w;
			const isCurrent =
				timelinePosition.value >= shapeStart &&
				timelinePosition.value <= shapeEnd;

			const status = isCurrent
				? "staged_within_threshold"
				: timelinePosition.value > shapeEnd
					? "past"
					: "future";

			editor.value?.updateShape({
				id: shape.id,
				type: "geo",
				props: {
					...shape.props,
					color: getColorForStatus(status),
				},
			});
		});
	}, 1000 / 60); // 60fps

	return () => window.clearInterval(intervalId);
});

// Setup editor event listeners
export const setupEditorListeners = (editorInstance: Editor) => {
	editor.value = editorInstance;

	// Create initial shapes and setup
	createTimelineBox();
	createTimelineCursor();
	createToneShapes(editorInstance);

	// Listen for shape changes
	editorInstance.on("change", (change) => {
		// Check if any shapes were updated
		if (change.source === "user") {
			Object.values(change.changes).forEach((record) => {
				if (record.type === "update" && record.id) {
					// Mark shape as modified if it's not a system shape
					if (!SYSTEM_SHAPE_IDS.includes(record.id as TLShapeId)) {
						markShapeAsModified(record.id as TLShapeId);
					}
				}
			});
			// Update shapes.json with the latest state
			updateShapes();
		}
	});
};

// Chat signals
export const chatHistory = signal<ChatMessage[]>([]);
export const isChatOpen = signal(false);
export const isChatLoading = signal(false);

interface ChatMessage {
	role: "user" | "assistant" | "system";
	content: string;
	timestamp: number;
}
