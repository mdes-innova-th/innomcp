import { normalizePlannerQuery } from "../../services/promptAdapter";

export type Intent = "general" | "evidence" | "weather" | "web-record";

export interface ToolStep {
  name: string;
  required: boolean;
  fallback: string;
  timeoutMs: number;
}

export interface Plan {
  intent: Intent;
  steps: ToolStep[];
  notes: string[];
  /** Normalized variant used for intent matching (Phase 6B). */
  normalizedQuery?: string;
  /** Original user query, preserved for logs and UI (Phase 6B). */
  originalQuery?: string;
}

function hasWeatherIntent(text: string): boolean {
  return /(อากาศ|ฝน|พยากรณ์|weather|อุณหภูมิ|NWP|nwp|อุตุ|แผ่นดินไหว|seismic|ริกเตอร์|earthquake|เตือนภัย|ประกาศเตือน|สถานีอุตุ)/i.test(text);
}

function hasEvidenceIntent(text: string): boolean {
  // Exclude data-source+chart combos (worldbank, govdata, nasa, archive + chart keywords)
  // to prevent "กราฟ" from falsely triggering evidence intent on data visualization queries.
  const isDataSourceChart = /worldbank|world\s*bank|\bgdp\b|ธนาคารโลก|govdata|data\.gov|nasa|apod|\barchive\b|archive\.org/i.test(text);
  if (isDataSourceChart) return false;
  // Phase 27: Definitional queries about NIP/evidence → knowledge/cold RAG, not evidence DB
  if (/\bNIP\b.*คืออะไร|คืออะไร.*\bNIP\b|\bNIP\b.*หมายความ|\bNIP\b.*แปลว่า|evidence.*คืออะไร/i.test(text)) return false;
  return /(หลักฐาน|พยาน|คดี|custody|chain\s+of\s+custody|forensic|evidence|สถิติ|กราฟ|\bISP\b|traffic|detect|\bnip\b)/i.test(text);
}

function hasWebRecordIntent(text: string): boolean {
  return /(อ้างอิง|แหล่งข้อมูล|เว็บ|record|เว็บไซต์|บันทึก)/i.test(text);
}

export function planAnswer(userText: string): Plan {
  const original = String(userText || "").trim();
  const notes: string[] = [];

  // Phase 6B: normalize query for intent classification only.
  // The original text is preserved for tool execution / logs / UI.
  const normResult = normalizePlannerQuery(original);
  const text = normResult.normalizedQuery || original;
  if (normResult.mode === "deterministic" && normResult.normalizedQuery !== original) {
    notes.push(`planner-normalized:${normResult.reasons.slice(0, 2).join("|")}`);
  }

  // Match against normalized text first; fall back to original to preserve
  // existing behavior in case normalization happened to remove a keyword.
  const matchAny = (fn: (s: string) => boolean) => fn(text) || fn(original);

  let intent: Intent = "general";
  if (matchAny(hasWeatherIntent)) {
    intent = "weather";
    notes.push("matched:weather-keywords");
  } else if (matchAny(hasEvidenceIntent)) {
    intent = "evidence";
    notes.push("matched:evidence-keywords");
  } else if (matchAny(hasWebRecordIntent)) {
    intent = "web-record";
    notes.push("matched:web-record-keywords");
  } else {
    notes.push("matched:default-general");
  }

  const meta = { normalizedQuery: text, originalQuery: original };

  if (intent === "general") {
    return { intent, steps: [], notes, ...meta };
  }

  if (intent === "evidence") {
    return {
      intent,
      steps: [
        {
          name: "evidenceTool/queryDetectDB",
          required: false,
          fallback: "placeholder structuredContent",
          timeoutMs: 6000,
        },
      ],
      notes,
      ...meta,
    };
  }

  if (intent === "weather") {
    return {
      intent,
      steps: [
        {
          name: "weather fusion tool/fixture",
          required: false,
          fallback: "safe weatherPayload with errTaxonomy",
          timeoutMs: 7000,
        },
      ],
      notes,
      ...meta,
    };
  }

  return {
    intent: "web-record",
    steps: [
      {
        name: "records adapter",
        required: false,
        fallback: "recordPayload hits=[] + source='local-index:none' + note",
        timeoutMs: 5000,
      },
    ],
    notes,
    ...meta,
  };
}
