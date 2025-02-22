import { useSignals } from "@preact/signals-react/runtime";
import { activeDocuments, documents } from "@/store/whiteboard";

export function ActiveDocuments() {
	useSignals();

	return (
		<div className="p-2 bg-gray-800/50 backdrop-blur-sm border-t border-gray-700/50">
			<h3 className="text-sm font-medium text-gray-400 mb-2">
				Debug View - Active Documents
			</h3>
			<div className="space-y-1">
				{activeDocuments.value.map((docId) => {
					const doc = documents.value.find((d) => d.id === docId);
					return (
						<div
							key={docId}
							className="p-1.5 bg-gray-700/50 rounded-sm text-xs text-gray-300"
						>
							ID: {docId} | X: {doc?.x.toFixed(0)} | Y: {doc?.y.toFixed(0)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
