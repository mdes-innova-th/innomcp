/**
 * routes/api/templates.ts — Saved Prompt Templates (Phase 5)
 *
 *   GET    /api/templates          → list all templates (built-in + custom)
 *   POST   /api/templates          → create custom template
 *   PATCH  /api/templates/:id/use  → increment usageCount
 *   DELETE /api/templates/:id      → delete custom template (built-in protected)
 */

import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

type TemplateCategory = "research" | "code" | "data" | "write" | "custom";

interface PromptTemplate {
  id: string;
  name: string;
  prompt: string;
  category: TemplateCategory;
  icon: string;
  usageCount: number;
  createdAt: string;
}

const VALID_CATEGORIES: TemplateCategory[] = [
  "research",
  "code",
  "data",
  "write",
  "custom",
];

// ─── Built-in templates (read-only seed data) ─────────────────────────────────

const BUILT_IN: PromptTemplate[] = [
  {
    id: "research-1",
    name: "วิจัยตลาด",
    prompt:
      "วิเคราะห์ตลาด [TOPIC] แล้วสรุปเป็นรายงาน พร้อมแหล่งข้อมูล",
    category: "research",
    icon: "🔍",
    usageCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: "code-1",
    name: "สร้าง API",
    prompt:
      "เขียน REST API endpoint สำหรับ [FUNCTION] ด้วย Node.js/Express",
    category: "code",
    icon: "💻",
    usageCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: "data-1",
    name: "วิเคราะห์ CSV",
    prompt:
      "วิเคราะห์ไฟล์ CSV นี้และสรุป insights หลัก พร้อมสร้างกราฟ",
    category: "data",
    icon: "📊",
    usageCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: "write-1",
    name: "เขียน Proposal",
    prompt:
      "เขียน proposal สำหรับ [PROJECT] รวม executive summary, timeline, และ budget",
    category: "write",
    icon: "📝",
    usageCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: "debug-1",
    name: "Debug Code",
    prompt:
      "ช่วย debug โค้ดนี้และอธิบายสาเหตุของ bug พร้อมวิธีแก้ไข",
    category: "code",
    icon: "🐛",
    usageCount: 0,
    createdAt: new Date().toISOString(),
  },
];

const BUILT_IN_IDS = new Set(BUILT_IN.map((t) => t.id));

// Mutable in-memory store for custom templates
const customTemplates: PromptTemplate[] = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Return all templates (built-in first, then custom), sorted by usageCount desc */
function getAllTemplates(): PromptTemplate[] {
  return [...BUILT_IN, ...customTemplates].sort(
    (a, b) => b.usageCount - a.usageCount
  );
}

/** Find a template across both stores */
function findTemplate(id: string): { template: PromptTemplate; isBuiltIn: boolean } | null {
  const builtIn = BUILT_IN.find((t) => t.id === id);
  if (builtIn) return { template: builtIn, isBuiltIn: true };
  const custom = customTemplates.find((t) => t.id === id);
  if (custom) return { template: custom, isBuiltIn: false };
  return null;
}

// ─── Router ───────────────────────────────────────────────────────────────────

const router = Router();

// ── GET /api/templates ────────────────────────────────────────────────────────
router.get("/", (_req: Request, res: Response) => {
  res.json({ templates: getAllTemplates() });
});

// ── POST /api/templates ───────────────────────────────────────────────────────
router.post("/", (req: Request, res: Response) => {
  const { name, prompt, category, icon } = req.body as {
    name?: unknown;
    prompt?: unknown;
    category?: unknown;
    icon?: unknown;
  };

  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "name is required" });
  }
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "prompt is required" });
  }
  if (!category || typeof category !== "string") {
    return res.status(400).json({ error: "category is required" });
  }
  if (!VALID_CATEGORIES.includes(category as TemplateCategory)) {
    return res.status(400).json({
      error: `category must be one of: ${VALID_CATEGORIES.join(", ")}`,
    });
  }

  const template: PromptTemplate = {
    id: randomUUID(),
    name: name.trim(),
    prompt: prompt.trim(),
    category: category as TemplateCategory,
    icon: (typeof icon === "string" && icon.trim()) ? icon.trim() : "✨",
    usageCount: 0,
    createdAt: new Date().toISOString(),
  };

  customTemplates.push(template);
  res.status(201).json({ template });
});

// ── PATCH /api/templates/:id/use ──────────────────────────────────────────────
router.patch("/:id/use", (req: Request, res: Response) => {
  const { id } = req.params;
  const found = findTemplate(id);

  if (!found) {
    return res.status(404).json({ error: "template not found" });
  }

  // Mutate in place — works for both BUILT_IN entries and customTemplates entries
  found.template.usageCount += 1;
  res.json({ template: found.template });
});

// ── DELETE /api/templates/:id ─────────────────────────────────────────────────
router.delete("/:id", (req: Request, res: Response) => {
  const { id } = req.params;

  if (BUILT_IN_IDS.has(id)) {
    return res.status(403).json({ error: "built-in templates cannot be deleted" });
  }

  const idx = customTemplates.findIndex((t) => t.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "template not found" });
  }

  customTemplates.splice(idx, 1);
  res.json({ ok: true });
});

export default router;
