import { signal } from "@preact/signals-react";
import type { AudioChunk } from "./types";

// Base signals
export const audioChunks = signal<AudioChunk[]>([]);

// Constants for playback optimization
const BUFFER_THRESHOLD = 2; // Start playback when we have this many chunks
const BUFFER_AHEAD_TIME = 0.1; // Schedule chunks 100ms ahead
const CROSSFADE_DURATION = 0.015; // 15ms for smooth transitions
const SCHEDULING_INTERVAL = 0.01; // 10ms scheduling interval
const MIN_GAIN = 0.0001; // Minimum gain value for exponential ramps

export class AudioQueueManager {
	private ctx: AudioContext;
	private onPlaybackComplete?: () => void;
	private gainNode: GainNode;
	private pendingChunks: AudioChunk[] = [];
	private isProcessingQueue = false;
	private lastChunkEndTime = 0;
	private activeNodes: Set<AudioNode> = new Set();
	private chunkSequence = 0; // Track chunk sequence
	private lastProcessedSequence = -1; // Track last processed sequence

	constructor(ctx: AudioContext) {
		this.ctx = ctx;
		this.gainNode = ctx.createGain();
		this.gainNode.connect(ctx.destination);
		this.lastChunkEndTime = this.ctx.currentTime;
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
			const sequence = this.chunkSequence++;
			const chunk = {
				buffer: audioBuffer,
				alignment,
				sequence, // Add sequence number to chunk
			};

			// Add to pending chunks in sequence order
			const insertIndex = this.pendingChunks.findIndex(
				(c) => c.sequence > sequence,
			);
			if (insertIndex === -1) {
				this.pendingChunks.push(chunk);
			} else {
				this.pendingChunks.splice(insertIndex, 0, chunk);
			}

			audioChunks.value = audioChunks.value.concat(chunk);

			// Process queue if we have enough chunks or this is a completion chunk
			if (this.pendingChunks.length >= BUFFER_THRESHOLD || onComplete) {
				await this.processQueue();
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

				// Ensure chunks are processed in sequence
				if (chunk.sequence !== this.lastProcessedSequence + 1) {
					console.warn(
						`Out of sequence chunk detected. Expected ${this.lastProcessedSequence + 1}, got ${chunk.sequence}`,
					);
					// Wait for the correct chunk
					await new Promise((resolve) =>
						setTimeout(resolve, SCHEDULING_INTERVAL * 1000),
					);
					continue;
				}

				// Ensure we have a valid buffer
				if (!chunk.buffer || chunk.buffer.length === 0) {
					console.warn("Skipping invalid audio chunk");
					this.pendingChunks.shift();
					this.lastProcessedSequence = chunk.sequence;
					continue;
				}

				// Calculate start time with extra padding for crossfade
				const startTime = Math.max(
					this.ctx.currentTime + BUFFER_AHEAD_TIME,
					this.lastChunkEndTime - CROSSFADE_DURATION,
				);

				// Create and configure source
				const source = this.ctx.createBufferSource();
				source.buffer = chunk.buffer;

				// Create a dedicated gain node for this chunk
				const chunkGain = this.ctx.createGain();
				chunkGain.connect(this.gainNode);

				// Track these nodes
				this.activeNodes.add(source);
				this.activeNodes.add(chunkGain);

				// Calculate precise timing points
				const fadeInEnd = startTime + CROSSFADE_DURATION;
				const fadeOutStart =
					startTime + chunk.buffer.duration - CROSSFADE_DURATION;
				const chunkEndTime = startTime + chunk.buffer.duration;

				// More gradual fade curves
				chunkGain.gain.setValueAtTime(MIN_GAIN, startTime);
				chunkGain.gain.exponentialRampToValueAtTime(1, fadeInEnd);
				chunkGain.gain.setValueAtTime(1, fadeOutStart);
				chunkGain.gain.exponentialRampToValueAtTime(MIN_GAIN, chunkEndTime);

				source.connect(chunkGain);

				// Schedule the start and include a small offset to ensure full playback
				source.start(startTime, 0, chunk.buffer.duration + CROSSFADE_DURATION);

				// Update timing tracking
				this.lastChunkEndTime = chunkEndTime;
				this.lastProcessedSequence = chunk.sequence;

				// Set up completion handling
				source.onended = () => {
					// Clean up nodes
					if (this.activeNodes.has(source)) {
						source.disconnect();
						this.activeNodes.delete(source);
					}
					if (this.activeNodes.has(chunkGain)) {
						chunkGain.disconnect();
						this.activeNodes.delete(chunkGain);
					}

					// Remove from queue
					audioChunks.value = audioChunks.value.slice(1);

					// Handle completion
					if (
						audioChunks.value.length === 0 &&
						this.onPlaybackComplete &&
						this.pendingChunks.length === 0
					) {
						this.onPlaybackComplete();
						this.onPlaybackComplete = undefined;
					}
				};

				// Remove from pending chunks
				this.pendingChunks.shift();

				// Use precise scheduling interval
				await new Promise((resolve) =>
					setTimeout(resolve, SCHEDULING_INTERVAL * 1000),
				);
			}
		} finally {
			this.isProcessingQueue = false;
		}
	}

	clear() {
		// Stop and disconnect all active nodes
		for (const node of this.activeNodes) {
			try {
				if (node instanceof AudioBufferSourceNode) {
					node.stop();
				}
				node.disconnect();
			} catch (error) {
				console.warn("Error cleaning up audio node:", error);
			}
		}
		this.activeNodes.clear();

		// Reset sequence tracking
		this.chunkSequence = 0;
		this.lastProcessedSequence = -1;

		// Clear all queues and batch signal updates
		this.pendingChunks = [];
		audioChunks.value = [];

		this.lastChunkEndTime = this.ctx.currentTime;
		this.onPlaybackComplete = undefined;

		// Reset gain
		this.gainNode.gain.cancelScheduledValues(0);
		this.gainNode.gain.setValueAtTime(1, 0);
	}
}
