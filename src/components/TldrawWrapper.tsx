import { Tldraw } from "tldraw";
import type { Editor, StoreListenerFilters } from "tldraw";
import { useSignals } from "@preact/signals-react/runtime";
import {
	editor,
	updateShapes,
	createTimelineCursor,
	createInitialShapes,
	createTimelineBox,
} from "@/store/whiteboard";

import "tldraw/tldraw.css";

export function TldrawWrapper() {
	useSignals();

	const handleMount = (editorInstance: Editor) => {
		// Store editor instance in signal
		editor.value = editorInstance;

		// Initial setup
		editorInstance.setCurrentTool("geo");
		editorInstance.user.updateUserPreferences({
			animationSpeed: 1,
		});

		// Create initial shapes
		createInitialShapes(editorInstance);

		// Create timeline cursor and box
		createTimelineCursor();
		createTimelineBox();

		// Listen for shape changes with filters
		const listenerOptions: Partial<StoreListenerFilters> = {
			source: "user", // Only listen for user-initiated changes
			scope: "document", // Only listen for document changes
		};

		editorInstance.store.listen(updateShapes, listenerOptions);
	};

	return (
		<div className="flex-1 relative">
			<Tldraw onMount={handleMount} hideUi={false} />
		</div>
	);
}
