import { Tldraw } from "tldraw";
import type { Editor } from "tldraw";
import { useSignals } from "@preact/signals-react/runtime";
import {
	editor,
	updateShapes,
	createTimelineCursor,
	createInitialShapes,
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

		// Create timeline cursor
		createTimelineCursor();

		// Create initial shapes
		createInitialShapes(editorInstance);

		// Listen for shape changes
		editorInstance.store.listen(updateShapes);
	};

	return (
		<div className="flex-1 relative">
			<Tldraw onMount={handleMount} hideUi={false} />
		</div>
	);
}
