const fs = require("fs");
const txt = fs.readFileSync(process.argv[2], "utf-8");
for (const line of txt.split("\n")) {
  if (!line.startsWith("data:")) continue;
  try {
    const ev = JSON.parse(line.slice(5).trim());
    if (ev.type === "final_answer" && ev.finalText) {
      console.log(ev.finalText.slice(0, 600));
      process.exit(0);
    }
  } catch {}
}
console.log("(no final_answer with text)");
