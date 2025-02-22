import { useSignals } from "@preact/signals-react/runtime";
import {
	elapsedTime,
	isPlaying,
	resetTimeline,
	togglePlayback,
} from "@/store/whiteboard";
import { cn } from "@/lib/utils";

const buttonStyles =
	"px-2 py-1 text-sm rounded-md border border-gray-200/20 hover:bg-gray-700/50 transition-colors";

export function Header() {
	useSignals();

	return (
		<div className="flex justify-between items-center p-2 bg-gray-800/50 backdrop-blur-sm border-b border-gray-700/50">
			<div className="flex gap-2 items-center">
				<button
					onClick={resetTimeline}
					className={cn(buttonStyles, "text-red-200/70 hover:text-red-200")}
				>
					Reset
				</button>
				<button
					onClick={togglePlayback}
					className={cn(buttonStyles, "text-blue-200/70 hover:text-blue-200")}
				>
					{isPlaying.value ? "Pause" : "Play"}
				</button>
				<div className="text-sm text-gray-400">
					{elapsedTime.value.toFixed(1)}s
				</div>
			</div>
		</div>
	);
}
