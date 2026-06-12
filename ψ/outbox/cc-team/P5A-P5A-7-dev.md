<!-- cc-team deliverable
 group: P5A (Phase 5.1 + 5.2 â€” Pre-commit hooks: fence detection + tsc gate)
 member: P5A-7 role=dev model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":69,"completion_tokens":1788,"total_tokens":1857,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1337,"image_tokens":0},"cache_creation_input_tokens":0} | 35s
 generated: 2026-06-12T03:46:43.608Z -->
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "CCTeamTask",
  "description": "Schema for cc-team task objects",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique identifier for the task"
    },
    "role": {
      "type": "string",
      "enum": [
        "product_manager",
        "architect",
        "developer",
        "reviewer",
        "tester"
      ],
      "description": "The team role assigned to execute the task"
    },
    "model": {
      "type": "string",
      "description": "The AI model designated for this task"
    },
    "status": {
      "type": "string",
      "enum": [
        "pending",
        "in_progress",
        "completed",
        "failed",
        "cancelled"
      ],
      "description": "Current execution status of the task"
    },
    "task": {
      "type": "string",
      "minLength": 100,
      "description": "Detailed description and instructions for the task"
    },
    "output": {
      "type": [
        "string",
        "null"
      ],
      "description": "The resulting output, code, or artifact from the task execution"
    },
    "finished_at": {
      "type": [
        "string",
        "null"
      ],
      "format": "date-time",
      "description": "ISO 8601 timestamp of when the task reached a terminal state"
    }
  },
  "required": [
    "id",
    "role",
    "model",
    "status",
    "task"
  ],
  "additionalProperties": false
}
