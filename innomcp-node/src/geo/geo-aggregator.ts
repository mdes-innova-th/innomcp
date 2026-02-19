import type { WeatherPacket } from "./interfaces";

// ── Format raw tool output into a compact Weather Packet ──

export class GeoAggregator {
	/**
	 * Take a raw WeatherPacket (from GeoGuard) and fill in
	 * summary / temp / humidity from the raw_data payload.
	 */
	public format(packet: WeatherPacket): WeatherPacket {
		if (packet.error || !packet.raw_data) return packet;

		const data = packet.raw_data as Record<string, unknown>;

		// Extract temp & humidity from various tool response shapes
		const temp = this.findNumber(data, ["temp", "temperature", "tc", "t"]);
		const humidity = this.findNumber(data, ["humidity", "rh", "relative_humidity"]);
		const summary = this.buildSummary(data, temp, humidity, packet.source);

		return {
			...packet,
			summary,
			temp,
			humidity,
		};
	}

	/**
	 * Merge multiple packets (e.g. primary + fallback results) into one.
	 * Prefers packets that have data; de-duplicates by source.
	 */
	public merge(packets: WeatherPacket[]): WeatherPacket {
		if (packets.length === 0) {
			return this.emptyPacket();
		}

		// Pick the best packet: first one with actual data (no error)
		const valid = packets.filter((p) => !p.error && p.raw_data);
		if (valid.length === 0) {
			// All errored – return the first error packet
			return packets[0];
		}

		const best = valid[0];

		// If there's only one good packet, return it directly
		if (valid.length === 1) return best;

		// Multiple good packets – merge evidence (keep best summary/temp)
		return best;
	}

	// ── Private helpers ──

	private findNumber(data: Record<string, unknown>, keys: string[]): number | undefined {
		// Check top-level
		for (const key of keys) {
			const val = data[key];
			if (typeof val === "number") return val;
			if (typeof val === "string" && !isNaN(Number(val))) return Number(val);
		}

		// Check one level deep (e.g. data.data[0].temp)
		const nested = data["data"];
		if (Array.isArray(nested) && nested.length > 0 && typeof nested[0] === "object" && nested[0] !== null) {
			const first = nested[0] as Record<string, unknown>;
			for (const key of keys) {
				const val = first[key];
				if (typeof val === "number") return val;
				if (typeof val === "string" && !isNaN(Number(val))) return Number(val);
			}
		}

		return undefined;
	}

	private buildSummary(
		data: Record<string, unknown>,
		temp: number | undefined,
		humidity: number | undefined,
		source: string,
	): string {
		const parts: string[] = [];

		if (temp !== undefined) parts.push(`อุณหภูมิ ${temp}°C`);
		if (humidity !== undefined) parts.push(`ความชื้น ${humidity}%`);

		// Try to pull a condition/description string
		const condition = this.findString(data, ["condition", "description", "weather", "summary"]);
		if (condition) parts.push(this.normalizeConditionThai(condition));

		if (parts.length === 0) {
			parts.push("ดึงข้อมูลสำเร็จ");
		}

		return `${parts.join(" | ")} (${source})`;
	}

	private normalizeConditionThai(input: string): string {
		const trimmed = input.trim();
		if (!trimmed) return trimmed;

		const lower = trimmed.toLowerCase();

		const map: Array<[RegExp, string]> = [
			[/^(clear|sunny)$/i, "ท้องฟ้าโปร่ง"],
			[/cloudy|overcast/i, "มีเมฆมาก"],
			[/partly\s*cloudy/i, "มีเมฆบางส่วน"],
			[/rain|shower/i, "ฝนตก"],
			[/thunder|storm/i, "พายุฝนฟ้าคะนอง"],
			[/fog|mist/i, "มีหมอก"],
			[/windy/i, "ลมแรง"],
		];

		for (const [re, thai] of map) {
			if (re.test(lower)) return thai;
		}

		return trimmed;
	}

	private findString(data: Record<string, unknown>, keys: string[]): string | undefined {
		for (const key of keys) {
			const val = data[key];
			if (typeof val === "string" && val.trim()) return val.trim();
		}

		const nested = data["data"];
		if (Array.isArray(nested) && nested.length > 0 && typeof nested[0] === "object" && nested[0] !== null) {
			const first = nested[0] as Record<string, unknown>;
			for (const key of keys) {
				const val = first[key];
				if (typeof val === "string" && val.trim()) return val.trim();
			}
		}

		return undefined;
	}

	private emptyPacket(): WeatherPacket {
		return {
			summary: "ไม่พบข้อมูลสภาพอากาศ",
			timestamp: new Date().toISOString(),
			source: "none",
			evidence: { tool: "none", latency_ms: 0, confidence: 0 },
		};
	}
}