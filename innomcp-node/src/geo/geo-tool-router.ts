import type { GeoIntentResult, ToolPlan, ToolStep } from "./interfaces";

// ── Registered tool names (must match MCP server registrations) ──

const NWP_HOURLY_BY_LOCATION = "nwp_hourly_by_location";
const NWP_HOURLY_BY_PLACE = "nwp_hourly_by_place";
const NWP_DAILY_BY_LOCATION = "nwp_daily_by_location";
const NWP_DAILY_BY_PLACE = "nwp_daily_by_place";
const TMD_FORECAST_7DAYS = "tmd_weather_forecast_7days_by_province";
const TMD_DAILY_4TIMES = "tmd_daily_forecast_4_times";

export class GeoRouter {
	/**
	 * Map a classified intent to an ordered tool execution plan.
	 * Returns null when the intent is not actionable.
	 */
	public route(intent: GeoIntentResult): ToolPlan | null {
		if (intent.domain !== "weather" || intent.confidence < 0.6) return null;

		const { features, subdomain } = intent;
		const hasCoords = features.has_coords && features.coords !== undefined;
		const hasPlace = features.location_terms.length > 0;
		const place = features.location_terms.join(" ");

		// No location info at all → cannot route
		if (!hasCoords && !hasPlace) return null;

		switch (subdomain) {
			case "nwp_hourly":
				return this.planHourly(hasCoords, features.coords, place);

			case "nwp_daily":
				return this.planDaily(hasCoords, features.coords, place);

			case "tmd_forecast":
				return this.planTmd(hasCoords, features.coords, place);

			case "other_weather":
			default:
				// Fallback: daily by place (most common)
				return this.planDaily(hasCoords, features.coords, place);
		}
	}

	// ── Private plan builders ──

	private planHourly(
		hasCoords: boolean,
		coords: { lat: number; lon: number } | undefined,
		place: string,
	): ToolPlan {
		if (hasCoords && coords) {
			return {
				primary: this.step(
					NWP_HOURLY_BY_LOCATION,
					{ lat: coords.lat, lon: coords.lon },
					"24h + coords → hourly by location",
				),
				fallbacks: [
					this.step(
						NWP_DAILY_BY_LOCATION,
						{ lat: coords.lat, lon: coords.lon },
						"fallback: daily by location",
					),
				],
			};
		}

		return {
			primary: this.step(NWP_HOURLY_BY_PLACE, { place }, "hourly + place name"),
			fallbacks: [
				this.step(NWP_DAILY_BY_PLACE, { place }, "fallback: daily by place"),
				this.step(TMD_FORECAST_7DAYS, { province: place }, "fallback: TMD 7-day"),
			],
		};
	}

	private planDaily(
		hasCoords: boolean,
		coords: { lat: number; lon: number } | undefined,
		place: string,
	): ToolPlan {
		if (hasCoords && coords) {
			return {
				primary: this.step(
					NWP_DAILY_BY_LOCATION,
					{ lat: coords.lat, lon: coords.lon },
					"daily + coords → daily by location",
				),
				fallbacks: [
					this.step(
						NWP_HOURLY_BY_LOCATION,
						{ lat: coords.lat, lon: coords.lon },
						"fallback: hourly by location",
					),
				],
			};
		}

		return {
			primary: this.step(NWP_DAILY_BY_PLACE, { place }, "daily + place name"),
			fallbacks: [
				this.step(TMD_FORECAST_7DAYS, { province: place }, "fallback: TMD 7-day"),
				this.step(TMD_DAILY_4TIMES, {}, "fallback: TMD daily 4-times"),
			],
		};
	}

	private planTmd(
		hasCoords: boolean,
		coords: { lat: number; lon: number } | undefined,
		place: string,
	): ToolPlan {
		const primary = this.step(TMD_FORECAST_7DAYS, { province: place }, "TMD keyword → 7-day forecast");

		const fallbacks: ToolStep[] = [];
		if (hasCoords && coords) {
			fallbacks.push(
				this.step(NWP_DAILY_BY_LOCATION, { lat: coords.lat, lon: coords.lon }, "fallback: NWP daily by location"),
			);
		} else if (place) {
			fallbacks.push(this.step(NWP_DAILY_BY_PLACE, { place }, "fallback: NWP daily by place"));
		}

		return { primary, fallbacks };
	}

	private step(tool_name: string, params: Record<string, unknown>, reason: string): ToolStep {
		return { tool_name, params, reason };
	}
}