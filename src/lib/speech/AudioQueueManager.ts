import { signal } from "@preact/signals-react";
import type { AudioChunk, AudioQueueState } from "./types";

export const audioQueue = signal<AudioQueueState>({
	chunks: [],
	isPlaying: false,
});

// Constants for playback optimization
const BUFFER_THRESHOLD = 2; // Start playback when we have this many chunks
const BUFFER_AHEAD_TIME = 0.1; // Schedule chunks 100ms ahead
const CROSSFADE_DURATION = 0.005; // 5ms crossfade to smooth transitions

export class AudioQueueManager {
	private ctx: AudioContext;
	private currentSource: AudioBufferSourceNode | null = null;
	private nextStartTime = 0;
	private onPlaybackComplete?: () => void;
	private gainNode: GainNode;
	private pendingChunks: AudioChunk[] = [];
	private isProcessingQueue = false;

	constructor(ctx: AudioContext) {
		this.ctx = ctx;
		this.gainNode = ctx.createGain();
		this.gainNode.connect(ctx.destination);
	}

	async addToQueue(
		arrayBuffer: ArrayBuffer,
		alignment?: AudioChunk["alignment"],
		onComplete?: () => void,
	) {
		if (onComplete) {
			this.onPlaybackComplete = onComplete;
		}

		try {
			const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
			const chunk = { buffer: audioBuffer, alignment };

			// Add to pending chunks
			this.pendingChunks.push(chunk);

			// Update signal state
			audioQueue.value = {
				...audioQueue.value,
				chunks: [...audioQueue.value.chunks, chunk],
			};

			// If we have enough chunks buffered or this is a completion chunk, process queue
			if (this.pendingChunks.length >= BUFFER_THRESHOLD || onComplete) {
				this.processQueue();
			}
		} catch (error) {
			console.error("Error decoding audio for queue:", error);
		}
	}

	private async processQueue() {
		if (this.isProcessingQueue) return;
		this.isProcessingQueue = true;

		try {
			while (this.pendingChunks.length > 0) {
				const chunk = this.pendingChunks[0];

				// Calculate precise start time
				const startTime = Math.max(
					this.ctx.currentTime + BUFFER_AHEAD_TIME,
					this.nextStartTime,
				);

				// Create and configure source
				const source = this.ctx.createBufferSource();
				source.buffer = chunk.buffer;

				// Create a dedicated gain node for this chunk
				const chunkGain = this.ctx.createGain();
				chunkGain.connect(this.gainNode);

				// Apply slight fade in/out for smooth transitions
				chunkGain.gain.setValueAtTime(0, startTime);
				chunkGain.gain.linearRampToValueAtTime(
					1,
					startTime + CROSSFADE_DURATION,
				);
				chunkGain.gain.setValueAtTime(
					1,
					startTime + chunk.buffer.duration - CROSSFADE_DURATION,
				);
				chunkGain.gain.linearRampToValueAtTime(
					0,
					startTime + chunk.buffer.duration,
				);

				source.connect(chunkGain);
				source.start(startTime);

				// Update timing
				this.nextStartTime =
					startTime + chunk.buffer.duration - CROSSFADE_DURATION;

				// Set up completion handling
				source.onended = () => {
					source.disconnect();
					chunkGain.disconnect();

					// Remove from queue
					audioQueue.value = {
						...audioQueue.value,
						chunks: audioQueue.value.chunks.slice(1),
					};

					// If this was the last chunk and we have a completion callback
					if (
						audioQueue.value.chunks.length === 0 &&
						this.onPlaybackComplete &&
						this.pendingChunks.length === 0
					) {
						this.onPlaybackComplete();
						this.onPlaybackComplete = undefined;
						audioQueue.value = { ...audioQueue.value, isPlaying: false };
					}
				};

				// Remove from pending chunks
				this.pendingChunks.shift();

				// Update state
				if (!audioQueue.value.isPlaying) {
					audioQueue.value = { ...audioQueue.value, isPlaying: true };
				}

				// Small delay to allow for smooth scheduling
				await new Promise((resolve) => setTimeout(resolve, 10));
			}
		} finally {
			this.isProcessingQueue = false;
		}
	}

	clear() {
		// Stop all current playback
		if (this.currentSource) {
			this.currentSource.stop();
			this.currentSource.disconnect();
			this.currentSource = null;
		}

		// Clear all queues
		this.pendingChunks = [];
		audioQueue.value = { chunks: [], isPlaying: false };
		this.nextStartTime = 0;
		this.onPlaybackComplete = undefined;

		// Reset gain
		this.gainNode.gain.cancelScheduledValues(0);
		this.gainNode.gain.setValueAtTime(1, 0);
	}
}
