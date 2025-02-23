import { signal } from "@preact/signals-react";
import type { ChangeEvent, FormEvent } from "react";

const buttonStyles =
	"px-3 py-2 text-sm rounded-md border border-gray-200/20 hover:bg-gray-700/50 transition-colors";
const inputStyles =
	"w-full px-3 py-2 text-sm bg-gray-800/50 rounded-md border border-gray-200/20 focus:outline-none focus:border-gray-200/40 transition-colors text-gray-100";

// State management with signals
const agentPrompt = signal("");
const firstMessage = signal("");
const phoneNumber = signal("");
const isCallActive = signal(false);
const callHistory = signal<
	Array<{ id: string; timestamp: Date; number: string }>
>([]);

export function Agent() {
	const handleStartCall = async () => {
		if (!phoneNumber.value) return;

		try {
			isCallActive.value = true;
			const response = await fetch("/api/twilio/outbound-call", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					number: phoneNumber.value,
					prompt: agentPrompt.value || "You are a helpful AI assistant.",
					first_message:
						firstMessage.value || "Hello! How can I help you today?",
				}),
			});

			const data = await response.json();
			if (data.success) {
				callHistory.value = [
					...callHistory.value,
					{
						id: data.callSid,
						timestamp: new Date(),
						number: phoneNumber.value,
					},
				];
			} else {
				throw new Error(data.error);
			}
		} catch (error) {
			console.error("Failed to initiate call:", error);
		} finally {
			isCallActive.value = false;
		}
	};

	return (
		<div className="flex flex-col h-screen bg-gray-900 text-gray-100">
			<div className="flex justify-between items-center p-2 bg-gray-800/50 backdrop-blur-sm border-b border-gray-700/50">
				<h1 className="text-sm font-medium text-gray-300">
					Agent Configuration
				</h1>
				<div className="text-xs text-gray-400 font-mono">
					{isCallActive.value ? "Call in Progress" : "Ready"}
				</div>
			</div>

			<div className="flex-1 overflow-auto p-4">
				<div className="max-w-2xl mx-auto space-y-6">
					<form
						className="space-y-4"
						onSubmit={(e: FormEvent<HTMLFormElement>) => {
							e.preventDefault();
							handleStartCall();
						}}
					>
						<div className="space-y-2">
							<label
								htmlFor="system-prompt"
								className="block text-sm text-gray-400"
							>
								System Prompt
							</label>
							<textarea
								id="system-prompt"
								value={agentPrompt.value}
								onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
									(agentPrompt.value = e.target.value)
								}
								placeholder="You are a helpful AI assistant..."
								className={`${inputStyles} h-32 resize-none`}
							/>
						</div>

						<div className="space-y-2">
							<label
								htmlFor="first-message"
								className="block text-sm text-gray-400"
							>
								First Message
							</label>
							<input
								id="first-message"
								value={firstMessage.value}
								onChange={(e: ChangeEvent<HTMLInputElement>) =>
									(firstMessage.value = e.target.value)
								}
								placeholder="Hello! How can I help you today?"
								className={inputStyles}
							/>
						</div>

						<div className="space-y-2">
							<label
								htmlFor="phone-number"
								className="block text-sm text-gray-400"
							>
								Phone Number
							</label>
							<input
								id="phone-number"
								value={phoneNumber.value}
								onChange={(e: ChangeEvent<HTMLInputElement>) =>
									(phoneNumber.value = e.target.value)
								}
								placeholder="+1234567890"
								type="tel"
								className={inputStyles}
							/>
						</div>

						<button
							type="submit"
							disabled={isCallActive.value || !phoneNumber.value}
							className={`${buttonStyles} w-full ${
								isCallActive.value
									? "opacity-50 cursor-not-allowed"
									: "text-blue-200/70 hover:text-blue-200"
							}`}
						>
							{isCallActive.value ? "Calling..." : "Start Call"}
						</button>
					</form>

					{callHistory.value.length > 0 && (
						<div className="space-y-3">
							<h2 className="text-sm font-medium text-gray-400">
								Call History
							</h2>
							<div className="space-y-2">
								{callHistory.value.map((call) => (
									<div
										key={call.id}
										className="p-3 bg-gray-800/50 rounded-md border border-gray-700/50"
									>
										<div className="flex justify-between items-center">
											<p className="text-sm text-gray-300">{call.number}</p>
											<p className="text-xs text-gray-500 font-mono">
												{call.timestamp.toLocaleString()}
											</p>
										</div>
										<p className="text-xs text-gray-500 font-mono mt-1">
											ID: {call.id}
										</p>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
