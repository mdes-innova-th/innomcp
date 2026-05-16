const http = require("http");
const opts = { hostname: "localhost", port: 3012, path: "/mcp", method: "POST",
  headers: { "Content-Type": "application/json", "Accept": "application/json, text/event-stream" } };
const req = http.request(opts, (res) => {
  let b = ""; res.on("data", c => b += c);
  res.on("end", () => {
    const d = JSON.parse(b);
    (d.result?.tools || []).forEach(t => console.log(t.name));
  });
});
req.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }));
req.end();
