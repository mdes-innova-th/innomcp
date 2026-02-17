import type { GeoIntentResult, GeoIntentFeatures, WeatherSubdomain } from "./interfaces";

// ── Deterministic regex / keyword classifier for weather domain ──

/** Coordinate pattern: "14.97,102.09" or "14.97 102.09" or "lat 14.97 lon 102.09" */
const COORD_RE = /(\d{1,3}\.\d{2,})[,\s]+(\d{1,3}\.\d{2,})/;

/** 24-hour / hourly indicators */
const HOURLY_RE = /24\s*ชม|24\s*hours?|รายชั่วโมง|hourly|ชั่วโมง|hour/i;

/** Daily / multi-day indicators */
const DAILY_RE = /รายวัน|daily|7\s*วัน|7\s*days?|พรุ่งนี้|มะรืน|สัปดาห์|weekly|วันนี้/i;

/** TMD-specific keywords */
const TMD_RE = /กรมอุตุ|tmd|อุตุนิยมวิทยา/i;

/** Core weather keywords (Thai + English) */
const WEATHER_KEYWORDS: readonly string[] = [
	"พยากรณ์", "อากาศ", "ฝน", "ฝนตก", "ร้อน", "หนาว", "อุณหภูมิ",
	"ความชื้น", "ลม", "พายุ", "สภาพอากาศ", "แดด", "เมฆ",
	"weather", "forecast", "rain", "temperature", "humidity", "storm",
];

/** Location-stripping noise words */
const NOISE_WORDS: readonly string[] = [
	"ของ", "ที่", "ใน", "จังหวัด", "อำเภอ", "ตำบล",
	"บริเวณ", "แถว", "พื้นที่", "เขต", "อ.", "จ.", "ต.",
	"พิกัด",
	"ไหม", "มั้ย", "หรือไม่",
	"ตกไหม", "ฝนตกไหม",
	"ตก",
	"หน่อย", "ที", "ครับ", "ค่ะ", "คะ",
	"at", "in", "near", "around",
];

export class GeoIntent {
	/**
	 * Analyse a user message and classify it.
	 * Returns domain="weather" only when weather keywords are detected.
	 */
	public analyze(msg: string): GeoIntentResult {
		const text = msg.trim();
		const lower = text.toLowerCase();

		// ── 1. Feature extraction ──
		const features = this.extractFeatures(text, lower);

		// ── 2. Domain gate ──
		const isWeather =
			this.hasWeatherKeyword(lower) ||
			TMD_RE.test(lower) ||
			((HOURLY_RE.test(lower) || DAILY_RE.test(lower)) && features.location_terms.length > 0);
		if (!isWeather) {
			return {
				domain: "unknown",
				subdomain: null,
				features,
				confidence: 0,
				raw_input: text,
			};
		}

		// ── 3. Subdomain classification ──
		const subdomain = this.classifySubdomain(lower, features);

		// ── 4. Confidence scoring ──
		let confidence = 0.7; // base when weather keyword matched
		if (features.has_coords) confidence += 0.1;
		if (features.location_terms.length > 0) confidence += 0.05;
		if (features.wants_hourly || features.wants_daily) confidence += 0.1;
		if (confidence > 1) confidence = 1;

		return {
			domain: "weather",
			subdomain,
			features,
			confidence: Math.round(confidence * 100) / 100,
			raw_input: text,
		};
	}

	// ── Private helpers ──

	private extractFeatures(raw: string, lower: string): GeoIntentFeatures {
		// Coordinates
		const coordMatch = COORD_RE.exec(raw);
		const has_coords = coordMatch !== null;
		const coords = coordMatch
			? { lat: parseFloat(coordMatch[1]), lon: parseFloat(coordMatch[2]) }
			: undefined;

		// Time signals
		const has_time_range_24h = HOURLY_RE.test(lower);
		const wants_hourly = HOURLY_RE.test(lower);
		const wants_daily = DAILY_RE.test(lower);

		// Location terms – strip known keywords/noise and take leftovers
		const location_terms = this.extractLocationTerms(lower);

		return { has_coords, has_time_range_24h, wants_hourly, wants_daily, location_terms, coords };
	}

	private extractLocationTerms(lower: string): string[] {
		let cleaned = lower;

		// Remove coordinate numbers
		cleaned = cleaned.replace(COORD_RE, " ");

		// Remove weather keywords
		for (const kw of WEATHER_KEYWORDS) {
			cleaned = cleaned.split(kw.toLowerCase()).join(" ");
		}

		// Remove time keywords (hourly/daily patterns)
		cleaned = cleaned.replace(HOURLY_RE, " ");
		cleaned = cleaned.replace(DAILY_RE, " ");
		cleaned = cleaned.replace(TMD_RE, " ");

		// Remove noise words
		for (const nw of NOISE_WORDS) {
			// word-boundary–safe replacement for Thai (split/join)
			cleaned = cleaned.split(nw.toLowerCase()).join(" ");
		}

		// Remove punctuation and extra spaces
		cleaned = cleaned.replace(/[,.\-?!:;'"()\[\]{}]/g, " ");
		cleaned = cleaned.replace(/\s+/g, " ").trim();

		if (!cleaned) return [];

		// Split remaining tokens and keep meaningful ones (>1 char)
		return cleaned
			.split(" ")
			.map((t) => t.trim())
			.filter((t) => t.length > 1);
	}

	private hasWeatherKeyword(lower: string): boolean {
		return WEATHER_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
	}

	private classifySubdomain(lower: string, features: GeoIntentFeatures): WeatherSubdomain {
		// TMD explicit mention
		if (TMD_RE.test(lower)) return "tmd_forecast";

		// Hourly signals
		if (features.wants_hourly && !features.wants_daily) return "nwp_hourly";

		// Daily signals
		if (features.wants_daily && !features.wants_hourly) return "nwp_daily";

		// Both or neither → use context clues
		if (features.has_coords && features.has_time_range_24h) return "nwp_hourly";

		// Default weather → daily forecast (most common intent)
		return "nwp_daily";
	}
}