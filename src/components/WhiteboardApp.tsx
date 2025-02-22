import { Header } from "@/components/Header";
import { TldrawWrapper } from "@/components/TldrawWrapper";
import { ActiveDocuments } from "@/components/ActiveDocuments";

export function WhiteboardApp() {
	return (
		<div className="flex flex-col h-screen bg-gray-900 text-gray-100">
			<Header />
			<TldrawWrapper />
			<ActiveDocuments />
		</div>
	);
}
