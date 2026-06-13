<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: UTIL-1 role=dev model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":216,"completion_tokens":497,"total_tokens":713,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 8s
 generated: 2026-06-13T05:27:58.742Z -->
import * as https from "node:https";
import { URL } from "node:url";

export interface HttpResponse<T = unknown> {
  status: number;
  data: T;
}

type RequestBody = string | Buffer | Uint8Array;

function buildRequestOptions(
  url: string,
  method: string,
  headers?: Record<string, string>
): https.RequestOptions {
  const parsed = new URL(url);
  return {
    method,
    hostname: parsed.hostname,
    port: parsed.port || 443,
    path: `${parsed.pathname}${parsed.search}`,
    headers: {
      ...headers,
    },
  };
}

function performRequest(
  url: string,
  method: string,
  body?: RequestBody,
  headers?: Record<string, string>
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const options = buildRequestOptions(url, method, headers);

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];

      res.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });

      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        let data: unknown = raw;

        const contentType = res.headers["content-type"];
        if (contentType && contentType.includes("application/json")) {
          if (raw.length > 0) {
            try {
              data = JSON.parse(raw);
            } catch {
              data = raw;
            }
          } else {
            data = null;
          }
        }

        resolve({
          status: res.statusCode ?? 0,
          data,
        });
      });

      res.on("error", (err) => {
        reject(err);
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    if (body !== undefined) {
      req.write(body);
    }

    req.end();
  });
}

export async function get(
  url: string,
  headers?: Record<string, string>
): Promise<HttpResponse> {
  return performRequest(url, "GET", undefined, headers);
}

export async function post(
  url: string,
  body: RequestBody,
  headers?: Record<string, string>
): Promise<HttpResponse> {
  return performRequest(url, "POST", body, headers);
}
