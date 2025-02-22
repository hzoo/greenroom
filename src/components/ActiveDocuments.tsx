import { useSignals } from "@preact/signals-react/runtime";
import { useEffect, memo, useRef } from "react";
import type { TLShape } from "@tldraw/tldraw";
import {
	activeDocuments,
	documents,
	timelinePosition,
	TIMELINE_CURSOR_ID,
	isDebugOpen,
	progress,
	TIMELINE_WIDTH,
	isPlaying,
	markerPositions,
	debugPanelHeight,
	DEFAULT_DEBUG_HEIGHT,
} from "@/store/whiteboard";
import { cn } from "@/lib/utils";
import { ChatPanel } from "./ChatPanel";

// Constants
const MIN_HEIGHT = 120;
const MAX_HEIGHT = 800;

// Types for shape props
interface ShapeProps {
	w: number;
	h: number;
	geo?: string;
	color?: string;
	text?: string;
	size?: string;
	fill?: string;
	dash?: string;
	font?: string;
	align?: string;
	verticalAlign?: string;
	labelColor?: string;
	url?: string;
}

// Utilities
const getShapeStatus = (shape: TLShape, timelinePos: number) => {
	const buffer = 5;
	const shapeStart = shape.x;
	const shapeEnd = shape.x + (shape.props as ShapeProps).w;

	// Consider a shape "current" if the timeline position is within its bounds
	// plus a small buffer on either side
	if (timelinePos >= shapeStart - buffer && timelinePos <= shapeEnd + buffer) {
		return "current";
	}

	// Past if we've crossed the left edge of the shape
	if (timelinePos > shapeStart) {
		return "past";
	}

	return "future";
};

const getStatusStyle = (status: "past" | "current" | "future") => {
	switch (status) {
		case "current":
			return "bg-yellow-600/50 border-yellow-500/50";
		case "past":
			return "bg-gray-700/50 border-gray-600/50";
		case "future":
			return "bg-blue-700/50 border-blue-600/50";
	}
};

const formatCoord = (n: number) => n.toFixed(0).padStart(4, " ");
const formatPercent = (n: number) => (n * 100).toFixed(1).padStart(5, " ");

// Separate the play status indicator for better performance
const PlayStatus = memo(function PlayStatus() {
	useSignals();
	return (
		<div className="flex items-center gap-1.5 min-w-[60px]">
			<div
				className={cn(
					"w-1.5 h-1.5 rounded-full transition-colors",
					isPlaying.value ? "bg-green-500" : "bg-gray-500",
				)}
			/>
			<span className="text-gray-400">
				{isPlaying.value ? "Playing" : "Paused"}
			</span>
		</div>
	);
});

// Separate position display for better performance
const PositionDisplay = memo(function PositionDisplay() {
	useSignals();
	return (
		<div className="ml-auto flex items-center gap-3 font-mono text-xs">
			<div>
				<span className="text-gray-400">At: </span>
				<span className="text-gray-200 tabular-nums">
					{formatPercent(progress.value)}%
				</span>
			</div>
			<div className="tabular-nums">
				<span className="text-gray-200">
					{formatCoord(timelinePosition.value)}
				</span>
				<span className="text-gray-500">/</span>
				<span className="text-gray-400">{formatCoord(TIMELINE_WIDTH)}</span>
			</div>
		</div>
	);
});

// Simplified timeline visualization
const TimelineMarkers = memo(function TimelineMarkers() {
	useSignals();

	return (
		<div className="absolute inset-0 overflow-hidden">
			{/* Simple markers */}
			<div className="absolute inset-0 flex items-center">
				{markerPositions.value.map((x) => (
					<div
						key={x}
						className="absolute h-full w-0.5 bg-gray-500/50"
						style={{ left: `${(x / TIMELINE_WIDTH) * 100}%` }}
					/>
				))}
			</div>

			{/* Simple progress bar */}
			<div
				className="absolute inset-y-0 left-0 right-0 origin-left bg-gradient-to-r from-blue-500/5 to-transparent"
				style={{
					transform: `scaleX(${progress.value})`,
					transformOrigin: "left",
				}}
			/>

			{/* Cursor line */}
			<div
				className="absolute top-0 bottom-0 w-0.5 bg-red-500/50"
				style={{
					left: `${(timelinePosition.value / TIMELINE_WIDTH) * 100}%`,
				}}
			/>
		</div>
	);
});

// Stats display
const StatsDisplay = memo(function StatsDisplay({
	totalShapes,
	activeShapes,
}: {
	totalShapes: number;
	activeShapes: number;
}) {
	return (
		<div className="flex items-center gap-2 text-xs border-l border-gray-700/50 pl-3">
			<div className="flex items-center gap-1">
				<span className="text-gray-400">Shapes:</span>
				<span className="font-medium text-gray-200 tabular-nums">
					{totalShapes}
				</span>
			</div>
			<div className="flex items-center gap-1">
				<span className="text-gray-400">Active:</span>
				<span className="font-medium text-gray-200 tabular-nums">
					{activeShapes}
				</span>
			</div>
		</div>
	);
});

// Optimized header that composes smaller components
const DebugHeader = memo(function DebugHeader({
	shapes,
}: {
	shapes: TLShape[];
}) {
	useSignals();
	return (
		<div className="relative border-b border-gray-700/50">
			<TimelineMarkers />
			<div className="relative flex items-center h-9 px-2">
				<div className="flex items-center gap-3">
					<div className="flex items-center gap-2 text-xs">
						<div className="font-medium text-gray-200">Debug</div>
						<PlayStatus />
					</div>
					<StatsDisplay
						totalShapes={shapes.length}
						activeShapes={activeDocuments.value.length}
					/>
				</div>
				<PositionDisplay />
			</div>
		</div>
	);
});

const ShapeItem = memo(function ShapeItem({ shape }: { shape: TLShape }) {
	useSignals();
	const status = getShapeStatus(shape, timelinePosition.value);
	const props = shape.props as ShapeProps;

	return (
		<div
			className={cn(
				"px-3 py-1.5 rounded border text-xs font-mono flex items-center justify-between",
				getStatusStyle(status),
			)}
		>
			<div className="flex items-center gap-3">
				<span className="text-gray-400 text-[10px] uppercase">{status}</span>
				<span className="text-gray-300">{shape.id.slice(-8)}</span>
				{props.text && (
					<span className="text-gray-400 truncate max-w-[200px]">
						"{props.text}"
					</span>
				)}
			</div>
			<div className="flex items-center gap-2 text-gray-400">
				<span>x:{formatCoord(shape.x)}</span>
				<span>y:{formatCoord(shape.y)}</span>
			</div>
		</div>
	);
});

const ShapesList = memo(function ShapesList({ shapes }: { shapes: TLShape[] }) {
	return (
		<div className="space-y-1.5">
			{shapes.length === 0 ? (
				<div className="text-xs text-gray-500 italic px-1">
					No shapes on timeline...
				</div>
			) : (
				shapes.map((doc) => <ShapeItem key={doc.id} shape={doc} />)
			)}
		</div>
	);
});

export function ActiveDocuments() {
	useSignals();
	const dragRef = useRef<HTMLDivElement>(null);
	const startHeightRef = useRef(0);
	const startYRef = useRef(0);

	const displayShapes = documents.value
		.filter((doc) => doc.id !== TIMELINE_CURSOR_ID)
		.sort((a, b) => a.x - b.x);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.altKey && e.code === "KeyD") {
				e.preventDefault();
				isDebugOpen.value = !isDebugOpen.value;
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
				MAX_HEIGHT,
				Math.max(MIN_HEIGHT, startHeightRef.current + dy),
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

	const handleDoubleClick = () => {
		debugPanelHeight.value = DEFAULT_DEBUG_HEIGHT;
	};

	if (!isDebugOpen.value) return null;

	return (
		<div
			className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-sm border-t border-gray-700/50 z-[9999] transition-colors"
			style={{ height: `${debugPanelHeight.value}px` }}
		>
			{/* Drag handle */}
			<div
				ref={dragRef}
				className="absolute -top-3 left-0 right-0 h-3 flex items-center justify-center cursor-row-resize group"
				onMouseDown={handleDragStart}
				onDoubleClick={handleDoubleClick}
			>
				<div className="w-16 h-1 rounded-full bg-gray-700/50 group-hover:bg-gray-600/50 transition-colors" />
			</div>

			<DebugHeader shapes={displayShapes} />
			<div className="flex h-[calc(100%-36px)]">
				<div className="flex-1 overflow-auto p-3">
					<ShapesList shapes={displayShapes} />
				</div>
				<div className="w-3/4">
					<ChatPanel />
				</div>
			</div>
		</div>
	);
}
