import type { WeatherPacket } from "./interfaces";

// ── Resilience wrapper: timeout, retry, fallback ──

const DEFAULT_TIMEOUT_MS = 10_000; // 10s per spec

export class GeoGuard {
	private readonly timeoutMs: number;

	constructor(timeoutMs: number = DEFAULT_TIMEOUT_MS) {
		this.timeoutMs = timeoutMs;
	}

	/**
	 * Execute a tool promise with timeout, single retry, and graceful fallback.
	 * Always returns a WeatherPacket – never throws.
	 */
	public async executeWithGuard(
		toolFn: () => Promise<unknown>,
		toolName: string,
	): Promise<WeatherPacket> {
		const start = Date.now();

		// Attempt 1
		const first = await this.attempt(toolFn, toolName, start);
		if (!first.error) return first;

		// Retry once
		console.warn(`[GeoGuard] Retrying ${toolName} (reason: ${first.error})`);
		const retryStart = Date.now();
		const second = await this.attempt(toolFn, toolName, retryStart);
		if (!second.error) {
			second.fallback_used = true; // mark that first attempt failed
			return second;
		}

		// Both failed → produce degraded fallback packet
		console.error(`[GeoGuard] ${toolName} failed after retry: ${second.error}`);
		return this.degradedPacket(toolName, Date.now() - start, second.error);
	}

	// ── Internals ──

	private async attempt(
		toolFn: () => Promise<unknown>,
		toolName: string,
		start: number,
	): Promise<WeatherPacket> {
		try {
			const raw = await this.withTimeout(toolFn(), this.timeoutMs);
			const latency = Date.now() - start;

			return {
				summary: "",
				timestamp: new Date().toISOString(),
				source: toolName,
				raw_data: raw,
				evidence: { tool: toolName, latency_ms: latency, confidence: 1.0 },
			};
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			const latency = Date.now() - start;

			return {
				summary: "",
				timestamp: new Date().toISOString(),
				source: toolName,
				evidence: { tool: toolName, latency_ms: latency, confidence: 0 },
				error: message,
			};
		}
	}

	private degradedPacket(toolName: string, latencyMs: number, errorMsg: string): WeatherPacket {
		return {
			summary: "ขออภัย ไม่สามารถดึงข้อมูลสภาพอากาศได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง",
			timestamp: new Date().toISOString(),
			source: toolName,
			evidence: { tool: toolName, latency_ms: latencyMs, confidence: 0 },
			error: errorMsg,
			fallback_used: true,
		};
	}

	private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);

			promise.then(
				(val) => { clearTimeout(timer); resolve(val); },
				(err) => { clearTimeout(timer); reject(err); },
			);
		});
	}
}