<!-- cc-team deliverable
 group: G2 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-034 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1015,"completion_tokens":2265,"total_tokens":3280,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1987,"image_tokens":0},"cache_creation_input_tokens":0} | 128s
 generated: 2026-06-13T12:08:40.204Z -->
FILE: innomcp-server-node/src/memory/embedding.ts
<<<<<<< SEARCH
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

            const response = await fetch(this.endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: this.model,
                    prompt: text
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
=======
            const signal = AbortSignal.timeout(this.timeoutMs);

            const response = await fetch(this.endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: this.model,
                    prompt: text
                }),
                signal
            });

>>>>>>> REPLACE

FILE: innomcp-server-node/src/memory/embedding.ts
<<<<<<< SEARCH
            return data.embedding; // 768-dim vector
=======
            if (Array.isArray(data.embedding) && data.embedding.every(n => typeof n === 'number')) {
                return data.embedding; // 768-dim vector
            }
            return null;
>>>>>>> REPLACE
