"use client";

import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGear, faPalette, faQuestion, faSignOutAlt, faBriefcase, faUser, faHome, faKey } from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "@/app/context/AuthContext";
import { useRouter } from "next/navigation";

export interface ChatMessage {
  sender: "user" | "ai";
  text: string;
  fullText?: string;
  isAnimating?: boolean;
}

export interface ChatSummary {
  id: string;
  title: string;
  time: number;
  messages: ChatMessage[];
}

type Props = {
  summaries: ChatSummary[];
  activeId: string | null;
  isCollapsed: boolean;
  onToggle: () => void;
  onLoad: (s: ChatSummary) => void;
  onNewChat: () => void;
  onRename?: (id: string, newTitle: string) => void; // TODO #45
  theme: string;
};

const ChatSidebar: React.FC<Props> = ({
  summaries,
  activeId,
  isCollapsed,
  onToggle,
  onLoad,
  onNewChat,
  onRename,
  theme,
}) => {
  const [mounted, setMounted] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // TODO #45
  const [editTitle, setEditTitle] = useState(""); // TODO #45
  const { isLoggedIn, userDispName, userRoleId, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Use default light theme during SSR to prevent hydration mismatches
  const safeTheme = mounted ? theme : "light";

  return (
    <aside
      className="relative flex h-full w-full flex-col overflow-hidden border-r border-border/60 bg-[color-mix(in_oklab,var(--background)_88%,var(--card)_12%)] transition-all duration-300"
      data-testid="chat-sidebar"
    >
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-3">
        {!isCollapsed && (
          <div className="min-w-0 flex-1">
            <h2 className="font-display truncate text-base font-semibold leading-tight text-foreground">
              การสนทนา
            </h2>
            <div className="mt-0.5 truncate text-[12px] leading-snug text-muted-foreground">
              {summaries.length} เซสชัน · {isLoggedIn ? "เข้าสู่ระบบแล้ว" : "ผู้เยี่ยมชม"}
            </div>
          </div>
        )}

        <button
          title={isCollapsed ? "ขยาย Sidebar" : "ย่อ Sidebar"}
          onClick={onToggle}
          className="group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background/95 text-foreground shadow-sm transition-colors hover:border-primary/25 hover:bg-primary/8"
          data-testid="toggle-sidebar-btn"
        >
          <svg
            className={`h-4 w-4 transition-transform duration-200 ${isCollapsed ? "" : "rotate-180"}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* Collapsed icon strip — keeps essential actions reachable when narrow */}
      {isCollapsed && (
        <>
          <div className="flex flex-col items-center gap-2 px-2 pt-3">
            <button
              onClick={onNewChat}
              title="เริ่มการสนทนาใหม่"
              className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </button>
            {summaries.length > 0 && (
              <div className="relative flex h-9 w-9 items-center justify-center rounded-md border border-border/60 bg-background/95 text-muted-foreground" title={`${summaries.length} การสนทนา`}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                  {summaries.length}
                </span>
              </div>
            )}
          </div>

          <div className="mt-auto px-2 pb-3">
            {isLoggedIn ? (
              <button
                title="ไปที่การตั้งค่า"
                onClick={() => router.push("/settings")}
                className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border/60 bg-background/95 text-foreground transition-colors hover:bg-primary/8"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-[13px] font-semibold text-primary-foreground">
                  {userDispName?.charAt(0) || "U"}
                </span>
                <FontAwesomeIcon icon={faGear} className="w-4 text-muted-foreground" />
              </button>
            ) : (
              <button
                title="เข้าสู่ระบบ"
                onClick={() => router.push("/login")}
                className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border/60 bg-background/95 text-foreground transition-colors hover:bg-primary/8"
              >
                <FontAwesomeIcon icon={faKey} className="w-4" />
                <span className="text-sm font-medium">เข้าสู่ระบบ</span>
              </button>
            )}
          </div>
        </>
      )}

      {/* Content: hidden when collapsed */}
      {!isCollapsed && (
        <div
          className="flex flex-1 flex-col overflow-hidden"
        >
          {/* New Chat Button — primary action, prominent but not theatrical */}
          <div className="border-b border-border/60 p-3">
            <button
              onClick={onNewChat}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/92"
              title="เริ่มการสนทนาใหม่"
              data-testid="new-chat-btn"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span>เริ่มการสนทนาใหม่</span>
            </button>
          </div>

          {/* Chat History Header */}
          <div className="flex items-center justify-between px-3 pt-3 pb-1.5">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              ประวัติการสนทนา
            </h3>
            {summaries.length > 0 && (
              <span className="text-[11px] font-medium text-muted-foreground/80">
                {summaries.length}
              </span>
            )}
          </div>

          {/* Chat History List */}
          <div className="flex-1 overflow-y-auto px-2 pb-4">
            {summaries.length === 0 ? (
              <div className="mx-1 mt-2 rounded-md border border-dashed border-border/70 bg-background/60 px-3 py-6 text-center">
                <div className="text-[13px] font-semibold text-foreground">ยังไม่มีประวัติ</div>
                <div className="mt-1 text-[12px] leading-snug text-muted-foreground">
                  เริ่มบทสนทนาแรกเพื่อให้ระบบจดจำงานและสลับกลับมาได้
                </div>
              </div>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {summaries.map((s) => {
                  const isActive = s.id === activeId;
                  const dateLabel = (() => {
                    const date = new Date(s.time);
                    return date.toLocaleString("th-TH", {
                      timeZone: "Asia/Bangkok",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    });
                  })();

                  return (
                    <li
                      key={s.id}
                      className={`group relative rounded-md transition-colors ${
                        isActive
                          ? "bg-primary/10 ring-1 ring-primary/20"
                          : "hover:bg-muted/60"
                      }`}
                    >
                      {editingId === s.id ? (
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onBlur={() => {
                            if (editTitle.trim() && onRename) {
                              onRename(s.id, editTitle.trim());
                            }
                            setEditingId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              if (editTitle.trim() && onRename) {
                                onRename(s.id, editTitle.trim());
                              }
                              setEditingId(null);
                            } else if (e.key === "Escape") {
                              setEditingId(null);
                            }
                          }}
                          autoFocus
                          className={`w-full rounded-md border px-2 py-1.5 text-sm ${
                            safeTheme === "light"
                              ? "border-border bg-white text-foreground"
                              : "border-white/15 bg-white/5 text-foreground"
                          }`}
                        />
                      ) : (
                        <div className="flex items-center gap-1.5 px-2 py-2">
                          <button
                            onClick={() => onLoad(s)}
                            className="flex min-w-0 flex-1 flex-col items-start text-left"
                            title={s.title}
                            data-testid="chat-history-item"
                          >
                            <span
                              className={`block w-full truncate text-[13.5px] font-medium leading-tight ${
                                isActive ? "text-primary" : "text-foreground"
                              }`}
                            >
                              {s.title}
                            </span>
                            <span className="mt-1 block truncate font-mono text-[11px] text-muted-foreground/85">
                              {dateLabel}
                            </span>
                          </button>

                          {onRename && (
                            <button
                              onClick={() => {
                                setEditingId(s.id);
                                setEditTitle(s.title);
                              }}
                              className="shrink-0 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-primary/10 hover:text-primary group-hover:opacity-100 focus:opacity-100"
                              title="เปลี่ยนชื่อ"
                              aria-label="เปลี่ยนชื่อการสนทนา"
                            >
                              <svg
                                className="h-3.5 w-3.5"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          
          {/* User Menu at Bottom */}
          {isLoggedIn ? (
            <div className="mt-auto border-t border-border/60">
              <div className="p-2">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-foreground transition-colors hover:bg-primary/8"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-[13px] font-semibold text-primary-foreground">
                    {userDispName?.charAt(0) || "U"}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="truncate text-[13.5px] font-medium leading-tight text-foreground">
                      {userDispName || "ผู้ใช้"}
                    </div>
                    <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                      เมนูและการตั้งค่า
                    </div>
                  </div>
                  <FontAwesomeIcon
                    icon={faGear}
                    className={`text-xs text-muted-foreground transition-transform ${
                      showUserMenu ? "rotate-90" : ""
                    }`}
                  />
                </button>

                {/* User Menu Popup */}
                {showUserMenu && (
                  <div className={`mt-1 overflow-hidden rounded-md border ${
                    safeTheme === "light"
                      ? "border-border bg-card shadow-md"
                      : "border-white/10 bg-card shadow-lg"
                  }`}>
                    {/* Home Button */}
                    <button
                      onClick={() => {
                        router.push("/");
                        setShowUserMenu(false);
                      }}
                      className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13.5px] transition-colors ${
                        safeTheme === "light"
                          ? "text-foreground hover:bg-muted/60"
                          : "text-foreground hover:bg-white/5"
                      }`}
                      aria-label="หน้าแรก"
                    >
                      <FontAwesomeIcon icon={faHome} className="w-4" />
                      <span>หน้าแรก</span>
                    </button>
                    
                    {/* Admin-only buttons */}
                    {userRoleId === 0 && (
                      <>
                        <button
                          onClick={() => {
                            router.push("/apikey");
                            setShowUserMenu(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                            safeTheme === "light"
                              ? "hover:bg-gray-50 text-gray-700"
                              : "hover:bg-gray-700 text-gray-300"
                          }`}
                        >
                          <FontAwesomeIcon icon={faKey} className="w-4" />
                          <span>API Key</span>
                        </button>
                        
                        <button
                          onClick={() => {
                            router.push("/user");
                            setShowUserMenu(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                            safeTheme === "light"
                              ? "hover:bg-gray-50 text-gray-700"
                              : "hover:bg-gray-700 text-gray-300"
                          }`}
                        >
                          <FontAwesomeIcon icon={faUser} className="w-4" />
                          <span>จัดการผู้ใช้</span>
                        </button>

                        <button
                          onClick={() => {
                            router.push("/admin");
                            setShowUserMenu(false);
                          }}
                          className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13.5px] transition-colors ${
                            safeTheme === "light"
                              ? "text-amber-700 hover:bg-amber-50"
                              : "text-amber-300 hover:bg-amber-900/25"
                          }`}
                        >
                          <span className="w-4 text-center text-xs">👑</span>
                          <span>แผงผู้ดูแล</span>
                        </button>
                        
                        <div className="my-1 border-t border-border/60" />
                      </>
                    )}
                    
                    <button
                      onClick={() => {
                        router.push("/workspace-settings");
                        setShowUserMenu(false);
                      }}
                      className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13.5px] transition-colors ${
                        safeTheme === "light"
                          ? "text-foreground hover:bg-muted/60"
                          : "text-foreground hover:bg-white/5"
                      }`}
                    >
                      <FontAwesomeIcon icon={faBriefcase} className="w-4" />
                      <span>ตั้งค่า workspace</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        router.push("/personalization");
                        setShowUserMenu(false);
                      }}
                      className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13.5px] transition-colors ${
                        safeTheme === "light"
                          ? "text-foreground hover:bg-muted/60"
                          : "text-foreground hover:bg-white/5"
                      }`}
                    >
                      <FontAwesomeIcon icon={faPalette} className="w-4" />
                      <span>ปรับแต่งส่วนตัว</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        router.push("/settings");
                        setShowUserMenu(false);
                      }}
                      className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13.5px] transition-colors ${
                        safeTheme === "light"
                          ? "text-foreground hover:bg-muted/60"
                          : "text-foreground hover:bg-white/5"
                      }`}
                    >
                      <FontAwesomeIcon icon={faGear} className="w-4" />
                      <span>การตั้งค่า</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        router.push("/help");
                        setShowUserMenu(false);
                      }}
                      className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13.5px] transition-colors ${
                        safeTheme === "light"
                          ? "text-foreground hover:bg-muted/60"
                          : "text-foreground hover:bg-white/5"
                      }`}
                    >
                      <FontAwesomeIcon icon={faQuestion} className="w-4" />
                      <span>ช่วยเหลือ</span>
                    </button>
                    
                    <div className="my-1 border-t border-border/60" />
                    
                    <button
                      onClick={async () => {
                        await logout();
                        router.push("/login");
                        setShowUserMenu(false);
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13.5px] text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-900/20"
                    >
                      <FontAwesomeIcon icon={faSignOutAlt} className="w-4" />
                      <span>ออกจากระบบ</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-auto border-t border-border/60 p-3">
              <button
                onClick={() => router.push("/login")}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/60"
              >
                <FontAwesomeIcon icon={faKey} className="w-4" />
                <span>เข้าสู่ระบบ</span>
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};

export default ChatSidebar;
