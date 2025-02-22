import { Tldraw, defaultShapeUtils } from "tldraw";
import type { Editor, TLShape, TLShapeId } from "tldraw";
import "tldraw/tldraw.css";
import { signal } from "@preact/signals-react";
import { useSignals } from "@preact/signals-react/runtime";
import { TimelineCursor } from "./TimelineCursor";

// Global signals
const timelinePosition = signal(0);
const elapsedTime = signal(0);
const isPlaying = signal(false);
const activeDocuments = signal<TLShapeId[]>([]);
const documents = signal<TLShape[]>([]);

export function WhiteboardApp() {
	useSignals();

	const handleMount = (editor: Editor) => {
		// Initial setup when TLDraw mounts
		editor.setCurrentTool("geo");
		editor.user.updateUserPreferences({
			animationSpeed: 1,
		});

		// Listen for shape changes
		editor.store.listen(function handleStoreChange() {
			// Get all shapes from the current page
			const allShapes = editor.getCurrentPageShapes();

			// Update documents signal with a new array
			const shapeArray = Array.from(allShapes);
			documents.value = shapeArray;

			// Update active documents based on timeline position
			// Create a new array for activeDocuments to avoid structuredClone issues
			const activeShapeIds = shapeArray
				.filter((shape) => shape.x > timelinePosition.value)
				.map((shape) => shape.id);

			activeDocuments.value = activeShapeIds;
		});
	};

	const resetTimeline = () => {
		timelinePosition.value = 0;
		elapsedTime.value = 0;
		isPlaying.value = false;
	};

	const togglePlayback = () => {
		isPlaying.value = !isPlaying.value;
	};

	return (
		<div className="flex flex-col h-screen">
			<div className="flex justify-between items-center p-4 bg-gray-800 text-white">
				<div className="flex gap-4 items-center">
					<button
						onClick={resetTimeline}
						className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded"
					>
						Reset
					</button>
					<button
						onClick={togglePlayback}
						className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded"
					>
						{isPlaying.value ? "Pause" : "Play"}
					</button>
					<div>Elapsed Time: {elapsedTime.value.toFixed(1)}s</div>
				</div>
			</div>

			<div className="flex-1 relative">
				<Tldraw
					shapeUtils={defaultShapeUtils}
					onMount={handleMount}
					hideUi={false}
					components={{
						Background: () => (
							<TimelineCursor
								timelinePosition={timelinePosition}
								elapsedTime={elapsedTime}
								isPlaying={isPlaying}
							/>
						),
					}}
				/>
			</div>

			<div className="p-4 bg-gray-800 text-white">
				<h3 className="font-bold mb-2">Debug View - Active Documents</h3>
				<div className="space-y-1">
					{activeDocuments.value.map((docId) => {
						const doc = documents.value.find((d) => d.id === docId);
						return (
							<div key={docId} className="p-2 bg-gray-700 rounded">
								ID: {docId} | X: {doc?.x.toFixed(0)} | Y: {doc?.y.toFixed(0)}
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
