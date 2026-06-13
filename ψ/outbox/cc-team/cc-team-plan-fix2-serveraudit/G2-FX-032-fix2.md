<!-- cc-team deliverable
 group: G2 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-032 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: length | tokens: {"prompt_tokens":3761,"completion_tokens":7000,"total_tokens":10761,"prompt_tokens_details":{"cached_tokens":3712,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":5727,"image_tokens":0},"cache_creation_input_tokens":0} | 77s
 generated: 2026-06-13T12:09:19.151Z -->
FILE: innomcp-server-node/src/mcp/tools/webdTools.ts
<<<<<<< SEARCH
        let setCookieHeaders: string[] = [];
        const cookiehdr =
          csrfRes.headers.get && csrfRes.headers.get("set-cookie");
        if (cookiehdr) {
          setCookieHeaders = [cookiehdr];
        } else {
          const cookies = csrfRes.headers.get("set-cookie");
          if (cookies) {
            setCookieHeaders = Array.isArray(cookies) ? cookies : [cookies];
          }
        }
=======
        const setCookieHeaders: string[] = (csrfRes.headers as any).getSetCookie?.() ?? [];
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/webdTools.ts
<<<<<<< SEARCH
        if (!csrfRes.ok) throw new Error(`csrf GET failed ${csrfRes.status}`);
=======
        if (!csrfRes.ok) {
          const errorText = await csrfRes.text();
          throw new Error(`csrf GET failed ${csrfRes.status}: ${errorText}`);
        }
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/webdTools.ts
<<<<<<< SEARCH
        if (!postRes.ok) {
          throw new Error(`API request failed with status ${postRes.status}`);
        }
=======
        if (!postRes.ok) {
          const errorText = await postRes.text();
          throw new Error(`API request failed with status ${postRes.status}: ${errorText}`);
        }
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/webdTools.ts
<<<<<<< SEARCH
      try {
        const csrfRes = await fetch(
=======
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        const csrfRes = await fetch(
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/webdTools.ts
<<<<<<< SEARCH
        const csrfRes = await fetch(
          `http://${webddsbHost}:${webddsbPort}/api-get/csrf`,
          {
            method: "GET",
            headers: { "x-api-key": webddsbApiKey },
          }
        );
=======
        const csrfRes = await fetch(
          `http://${webddsbHost}:${webddsbPort}/api-get/csrf`,
          {
            method: "GET",
            headers: { "x-api-key": webddsbApiKey },
            signal: controller.signal,
          }
        );
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/webdTools.ts
<<<<<<< SEARCH
        const postRes = await fetch(
          `http://${webddsbHost}:${webddsbPort}/api/urlstats/violation-groups-count`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": webddsbApiKey,
              "x-csrf-token": csrfToken,
              ...(cookieHeader ? { Cookie: cookieHeader } : {}),
            },
            body: JSON.stringify({ query }),
          }
        );
=======
        const postRes = await fetch(
          `http://${webddsbHost}:${webddsbPort}/api/urlstats/violation-groups-count`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": webddsbApiKey,
              "x-csrf-token": csrfToken,
              ...(cookieHeader ? { Cookie: cookieHeader } : {}),
            },
            body: JSON.stringify({ query }),
            signal: controller.signal,
          }
        );
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/webdTools.ts
<<<<<<< SEARCH
        return {
          content: [
            { type: "text", text: JSON.stringify(data) } as {
              type: "text";
              text: string;
            },
          ],
          structuredContent: data,
        };
      } catch (error: any) {
=======
        return {
          content: [
            { type: "text", text: JSON.stringify(data) } as {
              type: "text";
              text: string;
            },
          ],
          structuredContent: data,
        };
      } catch (error: any) {
>>>>>>> REPLACE
(Duplicate no-op, skip – we need to add finally. We'll do a dedicated edit for adding finally after the catch block.)

FILE: innomcp-server-node/src/mcp/tools/webdTools.ts
<<<<<<< SEARCH
        return {
          content: [{ type: "text" as const, text: errorMsg }]
        };
      }
    }
=======
        return {
          content: [{ type: "text" as const, text: errorMsg }]
        };
      } finally {
        clearTimeout(timeout);
      }
    }
>>>>>>> REPLACE

(Note: need to ensure the catch block ends with a return; above we see `return { content: ... }` and then a closing `}` for catch, then `}` for function. Yes.)

FILE: innomcp-server-node/src/mcp/tools/webdTools.ts
<<<<<<< SEARCH
            `Cannot connect to WEBDDSB backend at http://${webddsbHost}:${webddsbPort}\n\n` +
=======
            `Cannot connect to backend service.\n\n` +
>>>>>>> REPLACE

Now for the parameters schema addition. We'll modify the tool options object.

FILE: innomcp-server-node/src/mcp/tools/webdTools.ts
<<<<<<< SEARCH
      title:
        "
