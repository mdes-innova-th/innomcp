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
}

function hasWeatherIntent(text: string): boolean {
  return /(อากาศ|ฝน|พยากรณ์|weather|อุณหภูมิ|NWP|nwp|อุตุ|แผ่นดินไหว|seismic|ริกเตอร์|earthquake|เตือนภัย|ประกาศเตือน|สถานีอุตุ)/i.test(text);
}

function hasEvidenceIntent(text: string): boolean {
  return /(หลักฐาน|พยาน|คดี|custody|chain\s+of\s+custody|forensic|evidence|สถิติ|กราฟ|\bISP\b|traffic|detect)/i.test(text);
}

function hasWebRecordIntent(text: string): boolean {
  return /(อ้างอิง|แหล่งข้อมูล|เว็บ|record|เว็บไซต์|บันทึก)/i.test(text);
}

export function planAnswer(userText: string): Plan {
  const text = String(userText || "").trim();
  const notes: string[] = [];

  let intent: Intent = "general";
  if (hasWeatherIntent(text)) {
    intent = "weather";
    notes.push("matched:weather-keywords");
  } else if (hasEvidenceIntent(text)) {
    intent = "evidence";
    notes.push("matched:evidence-keywords");
  } else if (hasWebRecordIntent(text)) {
    intent = "web-record";
    notes.push("matched:web-record-keywords");
  } else {
    notes.push("matched:default-general");
  }

  if (intent === "general") {
    return { intent, steps: [], notes };
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
  };
}
