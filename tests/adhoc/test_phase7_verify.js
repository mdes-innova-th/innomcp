// Phase 7 UX fix verification — check YESTERDAY/MONTHLY unsupported responses have no date header
const http = require("http");

function chatQuery(message, sessionId) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ message, sessionId });
    const req = http.request(
      { hostname: "localhost", port: 3011, path: "/api/chat", method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body), "X-Smoke-Run": "1" } },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error("Bad JSON: " + data.slice(0, 200))); }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const queries = [
    { id: "W10", msg: "\u0e40\u0e21\u0e37\u0e48\u0e2d\u0e27\u0e32\u0e19\u0e1d\u0e19\u0e15\u0e01\u0e17\u0e35\u0e48\u0e44\u0e2b\u0e19\u0e1a\u0e49\u0e32\u0e07", label: "yesterday rain where" },
    { id: "W11", msg: "\u0e1b\u0e17\u0e38\u0e21\u0e18\u0e32\u0e19\u0e35\u0e1d\u0e19\u0e15\u0e01\u0e44\u0e2b\u0e21 \u0e40\u0e14\u0e37\u0e2d\u0e19\u0e19\u0e35\u0e49", label: "Pathumthani monthly" },
    { id: "W12", msg: "\u0e2a\u0e23\u0e38\u0e1b\u0e2d\u0e32\u0e01\u0e32\u0e28\u0e40\u0e14\u0e37\u0e2d\u0e19\u0e17\u0e35\u0e48\u0e41\u0e25\u0e49\u0e27", label: "last month weather summary" },
  ];

  let pass = 0;
  for (const q of queries) {
    try {
      const resp = await chatQuery(q.msg, "p7-" + q.id);
      const answer = resp.answer || "";
      const hasDateHeader = answer.includes("\u0e0a\u0e48\u0e27\u0e07\u0e40\u0e27\u0e25\u0e32:"); // ช่วงเวลา:
      if (hasDateHeader) {
        console.log(`FAIL ${q.id} (${q.label}): still has date header`);
        console.log("  answer:", answer.slice(0, 200));
      } else {
        console.log(`PASS ${q.id} (${q.label}): no date header`);
        console.log("  answer:", answer.slice(0, 200));
        pass++;
      }
    } catch (e) {
      console.log(`ERROR ${q.id}: ${e.message}`);
    }
  }
  console.log(`\nPhase 7: ${pass}/${queries.length} PASS`);
}

main();
