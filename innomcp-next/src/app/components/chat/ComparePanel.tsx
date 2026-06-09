"use client";
import React, { useState } from "react";

interface ModelResponse {
  name: string;
  provider: string;
  time: string;
  tokens: number;
  cost: string;
  text: string;
}

export default function ComparePanel() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const responses: ModelResponse[] = [
    {
      name: "Claude 3.5 Sonnet",
      provider: "Anthropic",
      time: "1.4s",
      tokens: 420,
      cost: "$0.0031",
      text: "การเขียนสคริปต์คอมไพล์เดี่ยว (build --single) บน opencode จะยุบแพ็กเกจย่อยและ library ทั้งหมดลงในไฟล์ execute เดียว ช่วยลด overhead และความซับซ้อนขณะใช้งานข้าม OS."
    },
    {
      name: "Gemini 1.5 Pro",
      provider: "Google",
      time: "2.1s",
      tokens: 512,
      cost: "$0.0012",
      text: "คำสั่ง build --single รวมเอาตัวแปลภาษา ไฟล์แชร์ และสคริปต์เสริม เข้าเป็น binary เดี่ยว ซึ่งส่งผลดีต่อประสิทธิภาพ E2E และความเข้ากันได้กับ Windows x64."
    },
    {
      name: "Ollama (Qwen2.5-7B)",
      provider: "Local Engine",
      time: "0.8s",
      tokens: 380,
      cost: "$0.0000",
      text: "การประมวลผล build --single เป็นการผูก resource และ dependencies เข้ากับตัวรันหลัก ปลอดภัยและเหมาะสำหรับระบบออฟไลน์ภายในองค์กร."
    }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setTimeout(() => {
      setSearched(true);
      setLoading(false);
    }, 900);
  };

  return (
    <div className="flex flex-col h-full text-foreground p-1 overflow-y-auto">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-primary">Model Comparison</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">เปรียบเทียบผลลัพธ์ เวลาประมวลผล และค่าใช้จ่ายของแต่ละโมเดลเคียงข้างกัน</p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-1.5 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="พิมพ์คำสั่งหรือคำถามเพื่อเปรียบเทียบ..."
          className="flex-1 text-xs border border-border/40 rounded-lg px-2.5 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
        <button
          type="submit"
          className="bg-primary hover:bg-primary/90 text-white rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
        >
          {loading ? "..." : "เปรียบเทียบ"}
        </button>
      </form>

      {loading && (
        <div className="flex items-center justify-center py-16 text-xs text-muted-foreground animate-pulse">
          กำลังส่งคำขอไปยังผู้ให้บริการ AI ต่างๆ...
        </div>
      )}

      {!loading && searched && (
        <div className="space-y-3">
          {responses.map((r) => (
            <div key={r.name} className="border border-border/30 rounded-lg p-2.5 bg-background/50">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-semibold text-foreground">{r.name}</span>
                <span className="text-[9px] uppercase font-bold text-muted-foreground bg-muted/40 px-1.5 rounded">
                  {r.provider}
                </span>
              </div>
              <div className="flex gap-2 text-[9px] text-muted-foreground mb-2">
                <span>⏱ {r.time}</span>
                <span>⚡ {r.tokens} tokens</span>
                <span className="text-emerald-500 font-medium">💵 {r.cost}</span>
              </div>
              <p className="text-[11px] text-foreground/80 leading-relaxed bg-muted/10 p-2 rounded border border-border/10">
                {r.text}
              </p>
            </div>
          ))}
        </div>
      )}

      {!searched && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <span className="text-3xl">⚔️</span>
          <p className="text-[11.5px] mt-2 leading-relaxed">กรอกข้อความคำถามเพื่อดูความเร็วและคุณภาพคำตอบจาก 3 โมเดลแบบประชันหน้า</p>
        </div>
      )}
    </div>
  );
}
