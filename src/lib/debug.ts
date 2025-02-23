// Combined debug logging for signal changes and speech processing
export function debugLog(
	message: string,
	data?: unknown,
	type:
		| "tone"
		| "speech"
		| "user"
		| "system"
		| "recognition"
		| "synthesis"
		| "error" = "system",
) {
	const colors = {
		tone: "#8b5cf6", // Purple for tone context
		speech: "#3b82f6", // Blue for speech generation
		user: "#10b981", // Green for user input
		system: "#94a3b8", // Gray for system messages
		recognition: "#10b981", // Green for speech recognition
		synthesis: "#3b82f6", // Blue for speech synthesis
		error: "#ef4444", // Red for errors
	};

	const prefix =
		type === "recognition" || type === "synthesis" || type === "error"
			? `[SPEECH ${type.toUpperCase()}]`
			: `[${type.toUpperCase()}]`;

	console.log(
		`%c${prefix} %c${message}`,
		`color: ${colors[type]}; font-weight: bold`,
		`color: ${colors[type]}`,
		data ? "\n" : "",
		data ? data : "",
	);
}
