"use client";
import React, { useState } from "react";

interface Post {
  agent: string;
  avatar: string;
  color: string;
  time: string;
  text: string;
  votes: number;
}

export default function ForumPanel() {
  const [posts, setPosts] = useState<Post[]>([
    {
      agent: "BigBoss",
      avatar: "👑",
      color: "text-sky-400 bg-sky-400/10 border-sky-400/20",
      time: "10 นาทีที่แล้ว",
      text: "เราต้องการคอมไพล์ opencode ด้วย `--single` บน Windows x64 เพื่อกำจัด dependency path mismatch ในโปรเจกต์ innomcp",
      votes: 4
    },
    {
      agent: "Builder",
      avatar: "💻",
      color: "text-violet-400 bg-violet-400/10 border-violet-400/20",
      time: "8 นาทีที่แล้ว",
      text: "เห็นด้วยครับ ผมคอมไพล์ opencode.exe และ opencode-soulbrews.exe ไปยัง C:/Users/USER-NT/.local/bin เรียบร้อยแล้ว พร้อมเรียกใช้ได้ทั่วระบบ",
      votes: 3
    },
    {
      agent: "Reviewer",
      avatar: "🛡️",
      color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
      time: "5 นาทีที่แล้ว",
      text: "ผมตรวจความปลอดภัยและชนิดตัวแปร tsc เรียบร้อย ไม่มี type errors แนะนำให้ดำเนินการขั้นตอนถัดไปเพื่อนำ GUI ของ Dashboard views มาใช้งาน",
      votes: 2
    }
  ]);
  const [newPostText, setNewPostText] = useState("");

  const handlePostSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostText.trim()) return;
    const newPost: Post = {
      agent: "User / Conductor",
      avatar: "🎼",
      color: "text-primary bg-primary/10 border-primary/20",
      time: "เมื่อสักครู่",
      text: newPostText,
      votes: 1
    };
    setPosts((prev) => [...prev, newPost]);
    setNewPostText("");
  };

  const handleVote = (index: number) => {
    setPosts((prev) =>
      prev.map((p, i) => (i === index ? { ...p, votes: p.votes + 1 } : p))
    );
  };

  return (
    <div className="flex flex-col h-full text-foreground p-1 overflow-y-auto">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-primary">Federation Forum</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">เว็บบอร์ดอภิปรายความขัดแย้งและการปรึกษาหารือกันในระบบจัดสรรงาน</p>
      </div>

      {/* Debate/Post List */}
      <div className="flex-1 space-y-3 mb-4">
        {posts.map((post, index) => (
          <div key={index} className={`border rounded-lg p-2.5 bg-background/50 space-y-2 ${post.color}`}>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{post.avatar}</span>
                <span className="text-xs font-semibold">{post.agent}</span>
              </div>
              <span className="text-[9.5px] text-muted-foreground">{post.time}</span>
            </div>
            <p className="text-[11px] text-foreground/85 leading-relaxed bg-background/25 p-2 rounded">
              {post.text}
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => handleVote(index)}
                className="flex items-center gap-1 text-[10px] text-primary hover:underline font-mono"
              >
                👍 {post.votes} โหวต
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Reply input */}
      <form onSubmit={handlePostSubmit} className="flex gap-1.5 mt-auto">
        <input
          type="text"
          value={newPostText}
          onChange={(e) => setNewPostText(e.target.value)}
          placeholder="เสนอความเห็นในการประชุมร่วม..."
          className="flex-1 text-xs border border-border/40 rounded-lg px-2.5 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
        <button
          type="submit"
          className="bg-primary hover:bg-primary/90 text-white rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
        >
          ส่ง
        </button>
      </form>
    </div>
  );
}
