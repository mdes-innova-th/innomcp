"use client";
import React, { useState } from "react";

interface ActivityItem {
  time: string;
  agent: string;
  action: string;
  target: string;
  status: "success" | "error" | "pending";
}

export default function ActivityPanel() {
  const [search, setSearch] = useState("");

  const items: ActivityItem[] = [
    { time: "23:54:19", agent: "builder", action: "compile", target: "packages/opencode build --single", status: "success" },
    { time: "23:54:14", agent: "debugger", action: "verify", target: ".agents/agents.yaml", status: "success" },
    { time: "23:54:10", agent: "bigboss", action: "spawn", target: "debugger, reviewer, builder", status: "success" },
    { time: "23:54:02", agent: "reviewer", action: "typecheck", target: "innomcp-next type safety", status: "success" },
    { time: "23:53:50", agent: "builder", action: "copy", target: "opencode.exe -> C:/.local/bin", status: "success" }
  ];

  const filteredItems = items.filter(
    (item) =>
      item.action.toLowerCase().includes(search.toLowerCase()) ||
      item.target.toLowerCase().includes(search.toLowerCase()) ||
      item.agent.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full text-foreground p-1 overflow-y-auto">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-primary">System Activity</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">ตารางบันทึกการทำงาน คำสั่งเชลล์ และประวัติการเปลี่ยนแปลงทั้งหมด</p>
      </div>

      {/* Search Bar */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="ค้นหากิจกรรม..."
        className="text-xs border border-border/40 rounded-lg px-2.5 py-1.5 w-full bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 mb-3"
      />

      <div className="space-y-2">
        {filteredItems.map((item, idx) => (
          <div key={idx} className="border border-border/20 rounded-lg p-2 bg-background/55 text-[11px] space-y-1.5 shadow-sm">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase font-bold text-sky-400">
                <span>🤖 {item.agent}</span>
                <span className="text-muted-foreground">·</span>
                <span>{item.action}</span>
              </div>
              <span className="text-[9.5px] text-muted-foreground font-mono">{item.time}</span>
            </div>
            <div className="flex justify-between items-start gap-3">
              <code className="text-[10px] bg-muted/40 px-1.5 py-0.5 rounded break-all leading-normal text-foreground/80 flex-1">
                {item.target}
              </code>
              <span className="text-[9.5px] font-bold text-emerald-500 uppercase shrink-0">
                {item.status}
              </span>
            </div>
          </div>
        ))}

        {filteredItems.length === 0 && (
          <div className="text-center py-10 text-xs text-muted-foreground">ไม่พบรายการที่สอดคล้อง</div>
        )}
      </div>
    </div>
  );
}
