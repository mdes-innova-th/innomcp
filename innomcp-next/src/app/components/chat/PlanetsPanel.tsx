"use client";
import React from "react";

export default function PlanetsPanel() {
  const planets = [
    { name: "BigBoss (Core)", size: "w-8 h-8", color: "bg-sky-500", orbit: "animate-[spin_6s_linear_infinite]" },
    { name: "Builder Planet", size: "w-5 h-5", color: "bg-violet-500", orbit: "animate-[spin_9s_linear_infinite]" },
    { name: "Reviewer Moon", size: "w-4 h-4", color: "bg-emerald-500", orbit: "animate-[spin_12s_linear_infinite]" },
    { name: "Debugger Asteroid", size: "w-3 h-3", color: "bg-amber-500", orbit: "animate-[spin_16s_linear_infinite]" }
  ];

  return (
    <div className="flex flex-col h-full text-foreground p-1 overflow-y-auto">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-primary">Nebula Planets</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">ภาพรวมระบบเอเจนต์ที่แสดงในรูปแบบโครงสร้างวงโคจรจักรวาลความรู้</p>
      </div>

      <div className="flex-1 min-h-[350px] relative border border-border/40 rounded-xl bg-black/90 p-4 overflow-hidden flex flex-col justify-between shadow-2xl">
        {/* Stellar Orbit Map */}
        <div className="flex-1 relative flex items-center justify-center py-12">
          {/* Sun/Center */}
          <div className="absolute w-12 h-12 rounded-full bg-amber-400 blur-[2px] flex items-center justify-center text-[10px] text-black font-extrabold shadow-[0_0_20px_rgba(251,191,36,0.6)]">
            Jit Core
          </div>

          {/* Orbits */}
          <div className="absolute w-28 h-28 border border-white/5 rounded-full" />
          <div className="absolute w-44 h-44 border border-white/5 rounded-full" />
          <div className="absolute w-60 h-60 border border-white/5 rounded-full" />

          {/* Orbital Planets */}
          {planets.map((p, idx) => (
            <div key={p.name} className={`absolute w-full h-full flex items-center justify-center ${p.orbit}`}>
              <div
                className={`rounded-full ${p.size} ${p.color} absolute`}
                style={{ transform: `translateY(${(idx + 1) * 32}px)` }}
              />
            </div>
          ))}
        </div>

        {/* Legend / Status */}
        <div className="border-t border-border/20 pt-3">
          <h5 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">ข้อมูลวงโคจรความรู้</h5>
          <div className="grid grid-cols-2 gap-2 text-[10.5px]">
            {planets.map((p) => (
              <div key={p.name} className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${p.color}`} />
                <span className="text-foreground/80 truncate">{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
