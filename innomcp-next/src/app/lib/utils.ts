import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const toYMD = (s?: string | null) =>
  //! normalize to yyyy-mm-dd
  s ? new Date(s).toISOString().slice(0, 10) : "";

const formatToLocalDatetimeString = (
  dateInput: string | Date | null
): string | null => {
  if (!dateInput) return null;

  const date = new Date(dateInput);

  if (isNaN(date.getTime())) {
    return null;
  }

  // Get local components
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

const sanitizeUserInput = (
  input: string
): { valid: boolean; result: string[] } => {
  const escapeForCharClass = (s: string) =>
    s.replace(/[\\\-\]\[]/g, (m) => `\\${m}`);

  const specialCharacter = escapeForCharClass(".,!?@#\\-_()[]");
  const allow = `A-Za-z\\u0E00-\\u0E7F0-9\\u0E50-\\u0E59${specialCharacter} `;
  const negated = new RegExp(`[^${allow}]`, "gu");
  const result = input.match(negated) ?? [];
  return { valid: result.length === 0, result: result };
};

const sanitizeEmail = (input: string): boolean => {
  const emailRegrex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegrex.test(input);
};

const sanitizePhone = (input: string, label: string): string => {
  const phoneRegrex = /^[0-9-]+$/;
  if (!phoneRegrex.test(input)) {
    return `"${label}" ต้องประกอบด้วยตัวเลขและเครื่องหมาย - เท่านั้น`;
  }
  const startWithNumber = /^[0-9]/;
  if (!startWithNumber.test(input)) {
    return `"${label}" ต้องขึ้นต้นด้วยตัวเลขเท่านั้น`;
  }
  return "";
};
const normalizeNumber = (num: unknown): number | null => {
  if (typeof num === "number" && Number.isFinite(num)) return num;
  if (typeof num === "string" && num.trim() !== "") {
    const n = Number(num);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

function splitGraphemes(input: string): string[] {
  // Use Intl.Segmenter when available (Node 16+/modern browsers)
  if (
    typeof Intl !== "undefined" &&
    (Intl as typeof Intl & { Segmenter?: unknown }).Segmenter
  ) {
    const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(
      seg.segment(input),
      (s: { segment: string }) => s.segment
    );
  }

  // Fallback: group base chars with following combining marks \p{M}
  // (handles Thai vowels/diacritics reasonably well)
  const clusters: string[] = [];
  for (const ch of input) {
    // Unicode property escapes require ES2018+
    if (/\p{M}/u.test(ch) && clusters.length) {
      clusters[clusters.length - 1] += ch; // attach mark to previous base
    } else {
      clusters.push(ch);
    }
  }
  return clusters;
}

function maskName(name: string): string {
  if (!name) return "";

  const chars = splitGraphemes(name);

  // Visible = non-whitespace graphemes (we don't mask spaces/tabs/newlines)
  const isSpace = (g: string) => /^\s$/u.test(g);
  const visibleCount = chars.filter((g) => !isSpace(g)).length;

  // If too short (≤ 3 visible), return as-is
  if (visibleCount <= 3) return name;

  const out: string[] = [];
  let seen = 0;

  for (const g of chars) {
    if (isSpace(g)) {
      out.push(g); // keep spaces intact
      continue;
    }

    seen += 1;
    if (seen <= 2) {
      // keep first two visible characters
      out.push(g);
    } else if (seen === visibleCount) {
      // keep last visible character
      out.push(g);
    } else {
      // mask middle visible characters
      out.push("x");
    }
  }

  return out.join("");
}
export {
  cn,
  toYMD,
  formatToLocalDatetimeString,
  sanitizeUserInput,
  sanitizeEmail,
  sanitizePhone,
  normalizeNumber,
  maskName,
};
