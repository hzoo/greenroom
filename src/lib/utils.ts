import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { TLShape, TLTextShape } from "tldraw";
import { TIMELINE_WIDTH, timelinePosition } from "@/store/whiteboard";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export type SimpleShape = {
	id: string;
	x: number;
	y: number;
	text?: string | undefined;
	proportion_in_timeline?: number;
	type: "tone" | "document" | "cursor"; // What kind of node this is
	status: "staged_within_threshold" | "past" | "future";
};

const STAGE_THRESHOLD = 100; // (pixels)

export function transformShapes(shapes: TLShape[]): SimpleShape[] {
	return shapes.map((shape) => {
		// Cast to TLTextShape to access text property safely
		const textShape = shape as TLTextShape;

		// Determine status based on position relative to timeline
		const status = computeStatus(shape);

		return {
			id: shape.id,
			x: shape.x,
			y: shape.y,
			text: textShape.props?.text,
			type: "tone", // Default to tone for now
			status,
			proportion_in_timeline: shape.x / TIMELINE_WIDTH,
		};
	});
}

function computeStatus(shape: TLShape): SimpleShape["status"] {
	if (shape.x < timelinePosition.value) {
		return "past";
	}

	if (
		shape.x >= timelinePosition.value &&
		shape.x <= timelinePosition.value + STAGE_THRESHOLD
	) {
		return "staged_within_threshold";
	}

	return "future";
}
