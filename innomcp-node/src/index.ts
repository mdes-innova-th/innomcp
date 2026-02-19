const TRACE_QA_ENABLED = process.env.CHAT_TRACE_QA === "1";
const LOG_DEBUG_ENABLED = process.env.LOG_DEBUG === "1";

// Phase 7.2.5 Log hygiene: keep stdout clean during evidence runs.
// When CHAT_TRACE_QA=1 (and LOG_DEBUG!=1) suppress ALL console output
// except the strict one-line [ChatTrace] records.
if (TRACE_QA_ENABLED && !LOG_DEBUG_ENABLED) {
	const shouldAllow = (args: any[]) => args.some((a) => String(a ?? "").includes("[ChatTrace]"));
	const wrap = (orig: (...args: any[]) => void) => (...args: any[]) => {
		if (shouldAllow(args)) orig(...args);
	};

	console.log = wrap(console.log.bind(console));
	console.warn = wrap(console.warn.bind(console));
	console.error = wrap(console.error.bind(console));
	(console as any).info = wrap(((console as any).info || console.log).bind(console));
	(console as any).debug = wrap(((console as any).debug || console.log).bind(console));
}

// Start the server (module side-effect)
import("./server");
