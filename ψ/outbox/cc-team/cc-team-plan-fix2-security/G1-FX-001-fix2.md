<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from security)
 member: FX-001 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2098,"completion_tokens":5706,"total_tokens":7804,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":5213,"image_tokens":0},"cache_creation_input_tokens":0} | 56s
 generated: 2026-06-13T11:32:34.089Z -->
FILE: innomcp-node/src/services/agentLoop.ts
<<<<<<< SEARCH
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'LLM call failed';
      yield { type: 'error', error: `LLM error: ${message}` };
      return;
    }
=======
    } catch (err: unknown) {
      // Sanitize: do not expose raw error message to consumers.
      yield { type: 'error', error: 'LLM call failed' };
      return;
    }
>>>>>>> REPLACE

FILE: innomcp-node/src/services/agentLoop.ts
<<<<<<< SEARCH
        } catch (err: unknown) {
          const parseErr = `Failed to parse tool arguments: ${err instanceof Error ? err.message : String(err)}`;
          yield { type: 'error', error: parseErr };
          messages.push({
            role: 'tool',
            tool_call_id: id,
            name,
            content: parseErr,
          });
          continue;
        }
=======
        } catch (err: unknown) {
          // Sanitize: avoid leaking raw arguments or error details.
          yield { type: 'error', error: 'Failed to parse tool arguments' };
          messages.push({
            role: 'tool',
            tool_call_id: id,
            name,
            content: 'Failed to parse tool arguments',
          });
          continue;
        }
>>>>>>> REPLACE

FILE: innomcp-node/src/services/agentLoop.ts
<<<<<<< SEARCH
        } catch (err: unknown) {
          const errMsg =
            err instanceof Error ? err.message : 'Tool execution failed';
          yield { type: 'tool_result', id, name, output: errMsg };

          messages.push({
            role: 'tool',
            tool_call_id: id,
            name,
            content: errMsg,
          });
          continue;
        }
=======
        } catch (err: unknown) {
          // Sanitize: do not expose raw error details.
          yield { type: 'tool_result', id, name, output: 'Tool execution failed' };

          messages.push({
            role: 'tool',
            tool_call_id: id,
            name,
            content: 'Tool execution failed',
          });
          continue;
        }
>>>>>>> REPLACE
