/** Probe Ollama streaming mode */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

(async () => {
  const start = Date.now();
  const res = await fetch(`${process.env.OLLAMA_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OLLAMA_API_KEY}`,
    },
    body: JSON.stringify({
      model: "qwen3.5:9b",
      messages: [{ role: "user", content: "ตอบสั้นๆ: ภาคที่เชียงใหม่อยู่" }],
      stream: false,
    }),
  });
  console.log("HTTP", res.status, "first headers at", Date.now() - start, "ms");
  if (!res.body) { console.log("no body"); return; }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let chunks = 0;
  let bytes = 0;
  let accumulated = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks++;
    const text = decoder.decode(value, { stream: true });
    bytes += text.length;
    // Look for delta content
    for (const line of text.split("\n")) {
      if (line.startsWith("data: ") && !line.includes("[DONE]")) {
        try {
          const json = JSON.parse(line.slice(6));
          const piece = json.choices?.[0]?.delta?.content;
          if (piece) accumulated += piece;
        } catch {}
      }
    }
    if (chunks === 1) console.log("first chunk at", Date.now() - start, "ms");
  }
  console.log("DONE chunks=" + chunks, "bytes=" + bytes, "elapsed=" + (Date.now() - start) + "ms");
  console.log("CONTENT:", accumulated.slice(0, 400));
})();
