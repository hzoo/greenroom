import { Tldraw } from "tldraw";
import type { Editor } from "tldraw";
import { useSignals } from "@preact/signals-react/runtime";
import { setupEditorListeners } from "@/store/whiteboard";

import "tldraw/tldraw.css";

export function TldrawWrapper() {
	useSignals();

	const handleMount = (editorInstance: Editor) => {
		// Initial setup
		editorInstance.setCurrentTool("geo");
		editorInstance.user.updateUserPreferences({
			animationSpeed: 1,
		});

		// Setup editor with all listeners and initial shapes
		setupEditorListeners(editorInstance);
	};

	return (
		<div className="flex-1 relative">
			<Tldraw onMount={handleMount} hideUi={false} />
		</div>
	);
}
