/** Probe Ollama auth — verify .env credentials work */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

console.log("URL:", process.env.OLLAMA_URL);
console.log("KEY:", JSON.stringify(process.env.OLLAMA_API_KEY));
console.log("KEY length:", (process.env.OLLAMA_API_KEY || "").length);

(async () => {
  const res = await fetch(`${process.env.OLLAMA_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OLLAMA_API_KEY}`,
    },
    body: JSON.stringify({
      model: "qwen3.5:9b",
      messages: [{ role: "user", content: "hi" }],
      stream: false,
    }),
  });
  console.log("HTTP", res.status);
  const text = await res.text();
  console.log(text.slice(0, 500));
})();
