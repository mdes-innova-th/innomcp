"use client";
import React, { useState } from "react";

interface FileItem {
  path: string;
  confidence: string;
  reason: string;
}

interface CommitItem {
  hash: string;
  message: string;
  author: string;
}

interface IssueItem {
  number: number;
  title: string;
  state: "open" | "closed";
}

interface Trace {
  id: string;
  query: string;
  project: string;
  timestamp: string;
  depth: number;
  files: FileItem[];
  commits: CommitItem[];
  issues: IssueItem[];
  retro: string;
  awakening: string | null;
}

export default function TracesPanel() {
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);

  const mockTraces: Trace[] = [
    {
      id: "trace-4021",
      query: "สืบค้นหาวิธีการแปลงและรัน script build --single",
      project: "opencode-archived",
      timestamp: "2026-06-08 23:30",
      depth: 2,
      files: [
        { path: "packages/opencode/script/build.ts", confidence: "high", reason: "ประกอบด้วยคำสั่งคอมไพล์หลัก" },
        { path: "packages/opencode/package.json", confidence: "medium", reason: "มี config สำหรับ script build" }
      ],
      commits: [
        { hash: "8f7ab2c", message: "build: optimize single bundle script", author: "soul-brews" }
      ],
      issues: [
        { number: 124, title: "Bundle binary size exceeds 150MB on Windows x64", state: "open" }
      ],
      retro: "ตรวจสอบการใช้ bundler และ bundle splitting เพื่อลดขนาด binary ในอนาคต",
      awakening: "การเปลี่ยนมาใช้ `--single` แฟล็ก ช่วยแก้ปัญหาขอบเขตแพ็กเกจหายไปบน Windows x64"
    },
    {
      id: "trace-3982",
      query: "สืบค้นการลงทะเบียน dynamic route สำหรับ dashboard",
      project: "innomcp-next",
      timestamp: "2026-06-08 21:15",
      depth: 1,
      files: [
        { path: "src/app/components/chat/ChatSidebar.tsx", confidence: "high", reason: "จุดประมวลผล sidebar navigation" },
        { path: "src/app/components/chat/ChatPage.tsx", confidence: "high", reason: "จุดแสดงผล slideover views" }
      ],
      commits: [
        { hash: "2ba19cc", message: "feat: refactor composer to ChatSidebar", author: "gravy" }
      ],
      issues: [],
      retro: "ปรับเปลี่ยนการจัดวางโหมด Selector ให้แยกออกจาก input composer หลัก",
      awakening: null
    }
  ];

  const currentTrace = mockTraces.find((t) => t.id === selectedTraceId);

  return (
    <div className="flex flex-col h-full text-foreground p-1 overflow-y-auto">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-primary">Discovery Traces</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">เส้นทางการวิเคราะห์และสืบค้นความรู้ของฝูงเอเจนต์</p>
      </div>

      {!selectedTraceId ? (
        <div className="space-y-2">
          {mockTraces.map((t) => (
            <div
              key={t.id}
              onClick={() => setSelectedTraceId(t.id)}
              className="border border-border/30 rounded-lg p-2.5 bg-background/50 hover:border-primary/30 transition-colors cursor-pointer"
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                  {t.project}
                </span>
                <span className="text-[10px] text-muted-foreground">{t.timestamp}</span>
              </div>
              <h4 className="text-[11.5px] font-medium leading-normal text-foreground/90">"{t.query}"</h4>
              <div className="flex gap-2 text-[10px] text-muted-foreground mt-2">
                <span>📁 {t.files.length} ไฟล์</span>
                <span>🔨 {t.commits.length} commits</span>
                {t.awakening && <span className="text-amber-500 font-medium">✦ ตระหนักรู้ (Awakening)</span>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <button
            onClick={() => {
              setSelectedTraceId(null);
              setExpandedFile(null);
            }}
            className="text-[10.5px] text-primary hover:underline font-medium mb-2 flex items-center gap-1"
          >
            ← ย้อนกลับไปรายการ
          </button>

          {currentTrace && (
            <div className="space-y-3.5">
              <div className="pb-3 border-b border-border/20">
                <h4 className="text-xs font-semibold text-foreground leading-normal">
                  "{currentTrace.query}"
                </h4>
                <div className="flex gap-2.5 text-[10px] text-muted-foreground mt-1.5 flex-wrap">
                  <span className="bg-muted/40 px-1.5 py-0.5 rounded">โปรเจกต์: {currentTrace.project}</span>
                  <span>ความลึก: {currentTrace.depth}</span>
                  <span>{currentTrace.timestamp}</span>
                </div>
              </div>

              {currentTrace.awakening && (
                <div className="rounded-lg p-2.5 bg-amber-500/10 border border-amber-500/20 text-[11px]">
                  <h5 className="font-semibold text-amber-600 dark:text-amber-400 mb-0.5">✦ Awakening (การค้นพบสำคัญ)</h5>
                  <p className="text-foreground/80 leading-relaxed">{currentTrace.awakening}</p>
                </div>
              )}

              {/* Files */}
              {currentTrace.files.length > 0 && (
                <div>
                  <h5 className="text-[10.5px] font-semibold text-primary mb-1.5">ไฟล์ที่เกี่ยวข้อง</h5>
                  <div className="space-y-1.5">
                    {currentTrace.files.map((f) => (
                      <div key={f.path} className="border border-border/30 rounded-lg overflow-hidden bg-background/35">
                        <div
                          onClick={() => setExpandedFile(expandedFile === f.path ? null : f.path)}
                          className="flex justify-between items-center p-2 cursor-pointer hover:bg-muted/15 transition-colors"
                        >
                          <span className="font-mono text-[10.5px] text-primary truncate max-w-[180px]">{f.path}</span>
                          <span className="text-[9px] uppercase font-bold text-emerald-500 px-1.5 bg-emerald-500/10 rounded">
                            {f.confidence}
                          </span>
                        </div>
                        {expandedFile === f.path && (
                          <div className="p-2 bg-muted/10 border-t border-border/20 text-[10.5px]">
                            <p className="text-muted-foreground italic mb-1.5">เหตุผล: {f.reason}</p>
                            <pre className="p-1.5 rounded font-mono text-[9px] bg-black/40 text-muted-foreground overflow-x-auto whitespace-pre-wrap">
                              {`// จำลองเนื้อหาไฟล์\nexport function run() {\n  console.log("Running from ${f.path}");\n}`}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Commits */}
              {currentTrace.commits.length > 0 && (
                <div>
                  <h5 className="text-[10.5px] font-semibold text-primary mb-1.5">Git Commits</h5>
                  <div className="space-y-1">
                    {currentTrace.commits.map((c) => (
                      <div key={c.hash} className="flex gap-2 items-start text-[11px] p-1.5 border border-border/20 rounded bg-background/10">
                        <code className="text-[9.5px] font-bold text-violet-400 bg-violet-400/10 px-1 rounded">
                          {c.hash}
                        </code>
                        <span className="text-foreground/80 flex-1 leading-snug">{c.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Issues */}
              {currentTrace.issues.length > 0 && (
                <div>
                  <h5 className="text-[10.5px] font-semibold text-primary mb-1.5">ประเด็นปัญหา (Issues)</h5>
                  <div className="space-y-1">
                    {currentTrace.issues.map((issue) => (
                      <div key={issue.number} className="flex gap-2 items-center text-[11px]">
                        <span className="font-mono text-[9.5px] text-rose-500 bg-rose-500/10 px-1 rounded">
                          #{issue.number}
                        </span>
                        <span className="text-foreground/80">{issue.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Retrospective */}
              <div className="p-2.5 rounded-lg border border-border/30 bg-muted/15 text-[11px]">
                <h5 className="font-semibold text-muted-foreground mb-1">ความเห็นเชิงประวัติ (Retrospective)</h5>
                <p className="text-foreground/75 leading-relaxed">{currentTrace.retro}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
