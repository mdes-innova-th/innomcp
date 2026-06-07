# Phase 10.1: Weather Fusion Integration Spec

## 1. Overview

This specification bridges `get_weather_forecast` and `get_hourly_forecast`, fusing upstream node data into a single, cohesive `structuredContent` response for the UI.

## 2. Requirements

- **Renderer-Only:** LLM must NOT rephrase weather data (e.g., converting "34°C" to "Very hot today"). The tool returns `structuredContent.weatherPayload`.
- **Fusion Logic:** The resolver must intelligently merge daily summaries with the next 24-hours forecast timeline.
- **Fail-safe:** If hourly forecasting times out or fails (e.g. 429 Too Many Requests), the daily payload must still succeed and display gracefully without a cascading crash.
