```ts
import EventBus from '../events/EventBus.js';

/**
 * Priority levels for backpressure handling.
 * 'high' - critical, serviced first, even when slots are low
 * 'normal' - typical requests
 * 'low' - can be deferred most easily
 */
export type Priority = 'high' | 'normal' | 'low';

/**
 * Release callback to be invoked when request processing is complete.
 */
export type Release = () => void;

/**
 * Runtime statistics for backpressure monitoring.
 */
export type BackpressureStats = {
    /** Number of currently active (processing) requests. */
    active: number;
    /** Number of requests waiting in queues. */
    queued: number;
    /** Total number of rejected requests (queue overflow or timeout). */
    rejected: number;
    /** Total number of requests that were successfully processed (release called). */
    totalProcessed: number;
    /** Average waiting time in milliseconds over the last 100 processed requests. */
    avgWaitMs: number;
    /** Current pressure level based on concurrency usage. */
    pressure: 'none' | 'low' | 'medium' | 'high' | 'critical';
};

/**
 * Configuration limits for backpressure control.
 */
export type Limits = {
    /** Maximum number of concurrent requests allowed. */
    maxConcurrent: number;
    /** Maximum number of requests that can be held in queue. */
    maxQueued: number;
    /** Minimum slots reserved exclusively for high-priority requests. */
    highPrioritySlots: number;
    /** Time in milliseconds after which a queued request is rejected. */
    timeoutMs: number;
};

/**
 * Handler callback invoked when the pressure level changes.
 */
export type PressureHandler = (stats: BackpressureStats) => void;

interface QueueEntry {
    resolve: () => void;
    reject: (err: Error) => void;
    priority: Priority;
    timeoutId: ReturnType<typeof setTimeout>;
    timestamp: number;
    queueRef: QueueEntry[]; // reference to the queue array this entry belongs to
}

const DEFAULT_LIMITS: Limits = {
    maxConcurrent: 50,
    maxQueued: 200,
    highPrioritySlots: 10,
    timeoutMs: 30_000,
};

const PRESSURE_LEVELS = ['none', 'low', 'medium', 'high', 'critical'] as const;
type PressureLevel = typeof PRESSURE_LEVELS[number];

function getPressureLevel(ratio: number): PressureLevel {
    if (ratio < 0.3) return 'none';
    if (ratio < 0.5) return 'low';
    if (ratio < 0.7) return 'medium';
    if (ratio < 0.