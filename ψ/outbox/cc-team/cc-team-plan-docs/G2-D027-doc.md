<!-- cc-team deliverable
 group: G2 (Doc generation)
 member: D027 role=doc model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":1052,"completion_tokens":3232,"total_tokens":4284,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2613,"image_tokens":0},"cache_creation_input_tokens":0} | 187s
 generated: 2026-06-13T11:26:02.418Z -->
- **`RoutingDecision`** (Interface)
  - **Purpose:** Defines the structure for intent routing outcomes, detailing the chosen model, reasoning, and confidence metadata.
  - **Caveat:** The `fallback` property is only populated when a non-preferred (fallback) model is selected.

- **`ThaiIntentRouter`** (Class)
  - **Purpose:** Routes Thai text inputs to the most appropriate Ollama model based on NLP-detected intent and domain mapping.
  - **Caveat:** Relies on a rule-based `ThaiNLPService` that currently hardcodes the base NLU confidence score to 0.7.
  - **`DOMAIN_MODEL_MAP`** (Static Property): Maps domain categories (e.g., 'code', 'legal', 'weather') to their preferred Ollama model identifiers.
  - **`selectModelForDomain(domain, models)`**
    - **Purpose:** Selects the optimal model for a specific domain from a list of available models.
    - **`@param`** `domain` (string): The detected intent domain.
    - **`@param`** `models` (string[]): Array of currently available model names.
    - **`@returns`** `string`: The selected model name, or an empty string if no models match.
    - **Caveat:** If no preferred model is available, falls back to a hardcoded priority list (`MDES_OLLAMA_MODELS`) before checking the remaining provided models.
  - **`route(text, availableModels)`**
    - **Purpose:** Detects the intent of the input text and generates a routing decision using the provided available models.
    - **`@param`** `text` (string): The Thai text input to analyze.
    - **`@param`** `availableModels` (string[]): Array of model names currently available for routing.
    - **`@returns`** `Promise<RoutingDecision>`: Object containing the selected model, Thai localized reason, and confidence score.
    - **Caveat:** Returns an empty model with 0 confidence if `availableModels` is empty. Confidence is penalized (multiplied by 0.8) if a fallback model is used instead of a preferred one.
  - **`routeToMDES(text)`**
    - **Purpose:** Convenience wrapper that routes text specifically using the predefined subset of MDES Ollama models.
    - **`@param`** `text` (string): The Thai text input to analyze.
    - **`@returns`** `Promise<RoutingDecision>`: Routing decision restricted to the internal `MDES_OLLAMA_MODELS` list.

- **`thaiIntentRouter`** (Constant)
  - **Purpose:** Pre-instantiated singleton instance of `ThaiIntentRouter` for direct module consumption without manual instantiation.
