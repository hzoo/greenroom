import { useSignals } from "@preact/signals-react/runtime";
import { useEffect } from "react";
import {
	activeDocuments,
	documents,
	timelinePosition,
	TIMELINE_CURSOR_ID,
	isDebugOpen,
	progress,
} from "@/store/whiteboard";
import { cn } from "@/lib/utils";

const getShapeStatus = (x: number) => {
	if (x <= timelinePosition.value) return "past";
	return "future";
};

const getStatusStyle = (status: "past" | "future") => {
	switch (status) {
		case "past":
			return "bg-gray-700/50";
		case "future":
			return "bg-blue-700/50";
	}
};

const formatCoord = (n: number) => n.toFixed(0).padStart(4, " ");
const formatPercent = (n: number) => (n * 100).toFixed(1).padStart(5, " ");

const MIN_HEIGHT = 32; // minimum height when empty
const MAX_HEIGHT = 256; // maximum height
const ITEM_HEIGHT = 32; // approximate height of each item including padding
const HEADER_HEIGHT = 28; // height of the header

export function ActiveDocuments() {
	useSignals();

	// Filter out the timeline cursor and sort by X coordinate
	const displayShapes = documents.value
		.filter((doc) => doc.id !== TIMELINE_CURSOR_ID)
		.sort((a, b) => a.x - b.x);

	// Calculate panel height based on content
	const contentHeight = Math.min(
		MAX_HEIGHT,
		Math.max(MIN_HEIGHT, HEADER_HEIGHT + displayShapes.length * ITEM_HEIGHT),
	);

	// Handle keyboard shortcut
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

	return (
		<>
			{/* Debug Panel - Hidden when closed */}
			{isDebugOpen.value && (
				<div
					className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-sm border-t border-gray-700/50 z-[9999] transition-all duration-300"
					style={{ height: `${contentHeight}px` }}
				>
					{/* Header */}
					<div className="flex justify-between items-center p-1 border-b border-gray-700/50">
						<h3 className="text-xs font-medium text-gray-400">
							Debug View - {displayShapes.length} Shapes (
							{activeDocuments.value.length} Active) -{" "}
							{formatPercent(progress.value)}% Complete
						</h3>
					</div>

					{/* Content - Scrollable */}
					<div className="overflow-auto h-[calc(100%-28px)] p-2 space-y-1">
						{displayShapes.length === 0 ? (
							<div className="text-xs text-gray-500 italic">
								No shapes yet...
							</div>
						) : (
							displayShapes.map((doc) => {
								const status = getShapeStatus(doc.x);
								return (
									<div
										key={doc.id}
										className={cn(
											"p-1.5 rounded-sm text-xs font-mono",
											getStatusStyle(status),
										)}
									>
										<span className="text-gray-400">ID:</span>{" "}
										{doc.id.slice(-8)} |{" "}
										<span className="text-gray-400">X:</span>{" "}
										{formatCoord(doc.x)} |{" "}
										<span className="text-gray-400">Y:</span>{" "}
										{formatCoord(doc.y)} |{" "}
										<span
											className={cn(
												"px-1.5 py-0.5 rounded-sm text-[10px] uppercase",
												status === "past" ? "bg-gray-600/50" : "bg-blue-600/50",
											)}
										>
											{status}
										</span>
									</div>
								);
							})
						)}
					</div>
				</div>
			)}
		</>
	);
}
