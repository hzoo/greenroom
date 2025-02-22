import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { TLShape } from "tldraw";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

type SimpleShape = {
	id: string;
	x: number;
	y: number;
	text?: string | undefined;
};

export function transformShapes(shapes: TLShape[]): SimpleShape[] {
	return shapes.map((shape) => ({
		id: shape.id,
		x: shape.x,
		y: shape.y,
		// text: shape.props.text,
	}));
}
