# Phase 10.1: Weather Fusion Test Cases

## TC_101_01: Complete Fusion Response

- **Description:** Ensure daily and hourly data merge correctly.
- **Steps:** Inject mock successful responses for both endpoints.
- **Expected:** Tool outputs unified `structuredContent` containing both arrays in `data.series`.

## TC_101_02: Hourly Degradation

- **Description:** Ensure partial failure doesn't crash the widget.
- **Steps:** Mock a 500 error for hourly API. Return 200 for daily API.
- **Expected:** Tool outputs `structuredContent` with daily data, carrying a non-fatal `ERR:WX_HOURLY_TIMEOUT` flag.

## TC_101_03: LLM Hallucination Sweep

- **Description:** Verify the LLM doesn't alter values.
- **Steps:** Force upstream temperature to `99°C`.
- **Expected:** The dashboard displays `99°C` untouched.
