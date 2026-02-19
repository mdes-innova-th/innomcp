
import { z } from "zod";

export interface FastPathResult {
    handled: boolean;
    response?: string;
    action?: "memory_pipeline" | "tool_execution";
    toolName?: string;
    toolArgs?: any;
}

const THAI_HISTORY_KB: Record<string, string> = {
    "รัชกาลที่ 1": "พระบาทสมเด็จพระพุทธยอดฟ้าจุฬาโลกมหาราช",
    "รัชกาลที่ 2": "พระบาทสมเด็จพระพุทธเลิศหล้านภาลัย",
    "รัชกาลที่ 3": "พระบาทสมเด็จพระนั่งเกล้าเจ้าอยู่หัว",
    "รัชกาลที่ 4": "พระบาทสมเด็จพระจอมเกล้าเจ้าอยู่หัว",
    "รัชกาลที่ 5": "พระบาทสมเด็จพระจุลจอมเกล้าเจ้าอยู่หัว",
    "รัชกาลที่ 6": "พระบาทสมเด็จพระมงกุฎเกล้าเจ้าอยู่หัว",
    "รัชกาลที่ 7": "พระบาทสมเด็จพระปกเกล้าเจ้าอยู่หัว",
    "รัชกาลที่ 8": "พระบาทสมเด็จพระปรเมนทรมหาอานันทมหิดล",
    "รัชกาลที่ 9": "พระบาทสมเด็จพระบรมชนกาธิเบศร มหาภูมิพลอดุลยเดชมหาราช บรมนาถบพิตร",
    "รัชกาลที่ 10": "พระบาทสมเด็จพระวชิรเกล้าเจ้าอยู่หัว",
    "ร.1": "พระบาทสมเด็จพระพุทธยอดฟ้าจุฬาโลกมหาราช",
    "ร.2": "พระบาทสมเด็จพระพุทธเลิศหล้านภาลัย",
    "ร.3": "พระบาทสมเด็จพระนั่งเกล้าเจ้าอยู่หัว",
    "ร.4": "พระบาทสมเด็จพระจอมเกล้าเจ้าอยู่หัว",
    "ร.5": "พระบาทสมเด็จพระจุลจอมเกล้าเจ้าอยู่หัว",
    "ร.6": "พระบาทสมเด็จพระมงกุฎเกล้าเจ้าอยู่หัว",
    "ร.7": "พระบาทสมเด็จพระปกเกล้าเจ้าอยู่หัว",
    "ร.8": "พระบาทสมเด็จพระปรเมนทรมหาอานันทมหิดล",
    "ร.9": "พระบาทสมเด็จพระบรมชนกาธิเบศร มหาภูมิพลอดุลยเดชมหาราช บรมนาถบพิตร",
    "ร.10": "พระบาทสมเด็จพระวชิรเกล้าเจ้าอยู่หัว"
};

// Safe Math Evaluator using Function constructor with strict sanitization
// OR use a library if available. Dependencies say 'mathjs' ^15.1.0 exists.
import { evaluate } from 'mathjs';

export class FastPathLayer {
    
    process(query: string): FastPathResult | null {
        const q = query.trim();
        const lowerQ = q.toLowerCase();

        // 1. Math (Strict)
        // Only allow numbers, operators, parentheses, and math functions
        if (/^[\d+\-*/().\s%^]+$|^(sin|cos|tan|sqrt|log|exp|pow|abs|pi|e)[\d\W]+$/i.test(q)) {
             // Exclude date-like patterns e.g. "12-12-2024" or phone "081-123-4567"
             // Heuristic: If it has more than 2 dashes or dots it might be date/IP?
             // Let's rely on mathjs failure or strict regex.
             // Actually "2024-12-01" is a valid math expression (subtraction).
             // We'll calculate it! "2011"
             
             try {
                 const result = evaluate(q);
                 if (typeof result === 'number' || result.type === 'Complex') {
                     return {
                         handled: true,
                         response: `${result}`
                     };
                 }
             } catch (e) {
                 // Not valid math
             }
        }

        // 2. Thai History (Static KB)
        // Check for "รัชกาลที่ X" or "ร.X"
        for (const [key, value] of Object.entries(THAI_HISTORY_KB)) {
             // Simple contains check? Or strict equal?
             // User might ask "รัชกาลที่ 3 คือใคร" -> contains "รัชกาลที่ 3"
             if (q.includes(key)) {
                 // Heuristic: If query is SHORT (< 30 chars), treat as fact lookup.
                 if (q.length < 50) {
                     return {
                         handled: true,
                         response: `${key} คือ ${value}`
                     };
                 }
             }
        }

        // 3. Memory Intent
        // "สรุป ... ที่เราเคยเก็บไว้"
        if (/(เก็บ|เคย|สรุป).*(ไว้|ที่)/.test(q) && (q.includes("context") || q.includes("memory") || q.includes("จำ") || q.includes("เดิม"))) {
             // Logic refinement: The regex in spec was `/(เก็บ|เคย|สรุป).*(ไว้|ที่)/`
             // Let's use the spec one.
        }
        
        if (/(เก็บ|เคย|สรุป).*(ไว้|ที่)/.test(q)) {
            return {
                handled: true,
                action: "memory_pipeline"
            }
        }

        return null;
    }
}
