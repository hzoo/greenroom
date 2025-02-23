import { Tldraw, DefaultToolbar, useTools, TldrawUiMenuItem } from "tldraw";
import type { Editor, TLUiComponents } from "tldraw";
import { useSignals } from "@preact/signals-react/runtime";
import { setupEditorListeners } from "@/store/whiteboard";

import "tldraw/tldraw.css";

function CustomToolbar() {
	const tools = useTools();

	return (
		<DefaultToolbar>
			<TldrawUiMenuItem {...tools.select} />
			<TldrawUiMenuItem {...tools.hand} />
			<TldrawUiMenuItem {...tools.rectangle} />
		</DefaultToolbar>
	);
}

// Define which UI components to hide/show
const components: TLUiComponents = {
	ContextMenu: null,
	ActionsMenu: null,
	HelpMenu: null,
	ZoomMenu: null,
	MainMenu: null,
	Minimap: null,
	StylePanel: null,
	PageMenu: null,
	NavigationPanel: null,
	KeyboardShortcutsDialog: null,
	QuickActions: null,
	HelperButtons: null,
	DebugPanel: null,
	DebugMenu: null,
	SharePanel: null,
	MenuPanel: null,
	TopPanel: null,
	CursorChatBubble: null,
	Dialogs: null,
	Toasts: null,
	Toolbar: CustomToolbar,
};

export function TldrawWrapper() {
	useSignals();

	const handleMount = (editorInstance: Editor) => {
		// Initial setup
		editorInstance.setCurrentTool("select");
		editorInstance.user.updateUserPreferences({
			animationSpeed: 1,
			colorScheme: "system",
		});

		// Setup editor with all listeners and initial shapes
		setupEditorListeners(editorInstance);
	};

	return (
		<div className="flex-1 relative">
			<Tldraw
				onMount={handleMount}
				hideUi={false}
				components={components}
				options={{
					maxPages: 1,
				}}
			/>
		</div>
	);
}
