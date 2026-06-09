"use client";
import React, { useState } from "react";

interface DocumentResult {
  id: string;
  type: string;
  score: number;
  content: string;
}

export default function PlaygroundPanel() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [hoveredDocId, setHoveredDocId] = useState<string | null>(null);

  const mockFts: DocumentResult[] = [
    { id: "doc-1", type: "learning", score: 0.95, content: "การประมวลผลคำค้นหาและการจับคู่คำสำคัญ (Keyword Match) ด้วยเทคนิค FTS5" },
    { id: "doc-2", type: "principle", score: 0.88, content: "หลักการออกแบบ UI/UX ของระบบ Multi-Agent Orchestrator" },
    { id: "doc-4", type: "retro", score: 0.72, content: "รายงานผลการทดสอบระบบ innomcp ประจำไตรมาสแรก" }
  ];

  const mockVector: DocumentResult[] = [
    { id: "doc-1", type: "learning", score: 0.91, content: "การประมวลผลคำค้นหาและการจับคู่คำสำคัญ (Keyword Match) ด้วยเทคนิค FTS5" },
    { id: "doc-3", type: "principle", score: 0.85, content: "สถาปัตยกรรมระบบกระจายตัวและการส่งสารผ่าน WebSockets" },
    { id: "doc-5", type: "learning", score: 0.79, content: "แนวทางพัฒนาและขยายขีดความสามารถของ Ollama LLM" }
  ];

  const mockHybrid: DocumentResult[] = [
    { id: "doc-1", type: "learning", score: 0.98, content: "การประมวลผลคำค้นหาและการจับคู่คำสำคัญ (Keyword Match) ด้วยเทคนิค FTS5" },
    { id: "doc-3", type: "principle", score: 0.89, content: "สถาปัตยกรรมระบบกระจายตัวและการส่งสารผ่าน WebSockets" },
    { id: "doc-2", type: "principle", score: 0.84, content: "หลักการออกแบบ UI/UX ของระบบ Multi-Agent Orchestrator" }
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setTimeout(() => {
      setSearched(true);
      setLoading(false);
    }, 800);
  };

  return (
    <div className="flex flex-col h-full text-foreground p-1 overflow-y-auto">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-primary">Vector Playground</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">เปรียบเทียบโหมดการค้นหา FTS5, Vector และ Hybrid แบบเรียลไทม์</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-1.5 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="พิมพ์คำค้นหาเพื่อเปรียบเทียบ..."
          className="flex-1 text-xs border border-border/40 rounded-lg px-2.5 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
        <button
          type="submit"
          className="bg-primary hover:bg-primary/90 text-white rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
        >
          {loading ? "กำลังค้น..." : "เปรียบเทียบ"}
        </button>
      </form>

      {loading && (
        <div className="flex items-center justify-center py-12 text-xs text-muted-foreground animate-pulse">
          กำลังประมวลผลผลลัพธ์ของแต่ละ Search Engine...
        </div>
      )}

      {!loading && searched && (
        <div className="space-y-4">
          {/* Venn overlap banner */}
          <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg p-2 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-500">🟢</span>
              <span>พบ 1 เอกสารร่วมกัน (Shared Doc)</span>
            </div>
            <div className="flex gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </div>
          </div>

          {/* Engine Columns */}
          <div className="space-y-3">
            {/* Column 1: FTS5 */}
            <div className="border border-border/30 rounded-lg p-2.5 bg-background/50">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-sky-400">FTS5 Engine</span>
                <span className="text-[10px] text-muted-foreground">30ms · 3 ผลลัพธ์</span>
              </div>
              <div className="space-y-1.5">
                {mockFts.map((doc) => (
                  <div
                    key={doc.id}
                    className={`p-2 rounded text-[11px] border transition-colors cursor-pointer ${
                      hoveredDocId === doc.id
                        ? "border-emerald-500 bg-emerald-500/5"
                        : "border-border/30 bg-muted/20"
                    }`}
                    onMouseEnter={() => setHoveredDocId(doc.id)}
                    onMouseLeave={() => setHoveredDocId(null)}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[9px] uppercase font-bold text-sky-400">{doc.type}</span>
                      <span className="text-[10px] font-mono">{(doc.score * 100).toFixed(0)}%</span>
                    </div>
                    <p className="line-clamp-2 text-foreground/80 leading-relaxed">{doc.content}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Column 2: Vector */}
            <div className="border border-border/30 rounded-lg p-2.5 bg-background/50">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-violet-400">Vector Engine</span>
                <span className="text-[10px] text-muted-foreground">145ms · 3 ผลลัพธ์</span>
              </div>
              <div className="space-y-1.5">
                {mockVector.map((doc) => (
                  <div
                    key={doc.id}
                    className={`p-2 rounded text-[11px] border transition-colors cursor-pointer ${
                      hoveredDocId === doc.id
                        ? "border-emerald-500 bg-emerald-500/5"
                        : "border-border/30 bg-muted/20"
                    }`}
                    onMouseEnter={() => setHoveredDocId(doc.id)}
                    onMouseLeave={() => setHoveredDocId(null)}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[9px] uppercase font-bold text-violet-400">{doc.type}</span>
                      <span className="text-[10px] font-mono">{(doc.score * 100).toFixed(0)}%</span>
                    </div>
                    <p className="line-clamp-2 text-foreground/80 leading-relaxed">{doc.content}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Column 3: Hybrid */}
            <div className="border border-border/30 rounded-lg p-2.5 bg-background/50">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-emerald-400">Hybrid Search</span>
                <span className="text-[10px] text-muted-foreground">172ms · 3 ผลลัพธ์</span>
              </div>
              <div className="space-y-1.5">
                {mockHybrid.map((doc) => (
                  <div
                    key={doc.id}
                    className={`p-2 rounded text-[11px] border transition-colors cursor-pointer ${
                      hoveredDocId === doc.id
                        ? "border-emerald-500 bg-emerald-500/5"
                        : "border-border/30 bg-muted/20"
                    }`}
                    onMouseEnter={() => setHoveredDocId(doc.id)}
                    onMouseLeave={() => setHoveredDocId(null)}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[9px] uppercase font-bold text-emerald-400">{doc.type}</span>
                      <span className="text-[10px] font-mono">{(doc.score * 100).toFixed(0)}%</span>
                    </div>
                    <p className="line-clamp-2 text-foreground/80 leading-relaxed">{doc.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {!searched && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <span className="text-3xl">🎯</span>
          <p className="text-[11.5px] mt-2 leading-relaxed">กรอกคำสำคัญข้างบนเพื่อเปรียบเทียบผลลัพธ์ในโหมดต่างๆ แบบข้างเคียง</p>
        </div>
      )}
    </div>
  );
}
