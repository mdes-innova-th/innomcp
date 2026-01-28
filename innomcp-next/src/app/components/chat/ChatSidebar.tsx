"use client";

import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faColumns, faPlus, faGear, faPalette, faQuestion, faSignOutAlt, faBriefcase, faUser, faHome, faKey } from "@fortawesome/free-solid-svg-icons";
import Image from "next/image";
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
      // className="fixed left-0 top-24 z-[50] flex flex-col transition-all duration-300"
      className="fixed left-0 top-16 z-40 flex flex-col transition-all duration-300"
      style={{ width: isCollapsed ? 56 : 288, height: "calc(100vh - 4rem)" }}
      data-testid="chat-sidebar"
    >
      {/* Toggle Button - Modern 2025-2026 Design */}
      <div className="absolute -right-12 top-4 z-[37]">
        <button
          title={isCollapsed ? "ขยาย Sidebar" : "ย่อ Sidebar"}
          onClick={onToggle}
          className="group relative w-10 h-10 rounded-xl transition-all duration-300 bg-gradient-to-br from-primary/90 to-primary hover:from-primary hover:to-primary/80 text-primary-foreground shadow-lg hover:shadow-xl hover:scale-110 backdrop-blur-sm border border-primary/20"
          data-testid="toggle-sidebar-btn"
        >
          {/* Animated Hamburger Icon */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-2">
            <span 
              className={`block h-0.5 bg-current transition-all duration-300 ${
                !isCollapsed 
                  ? 'w-4 rotate-0 translate-y-0' 
                  : 'w-3 rotate-45 translate-y-1.5'
              }`}
            />
            <span 
              className={`block h-0.5 bg-current transition-all duration-300 ${
                !isCollapsed ? 'w-4 opacity-100' : 'w-0 opacity-0'
              }`}
            />
            <span 
              className={`block h-0.5 bg-current transition-all duration-300 ${
                !isCollapsed 
                  ? 'w-4 rotate-0 translate-y-0' 
                  : 'w-3 -rotate-45 -translate-y-1.5'
              }`}
            />
          </div>
          
          {/* Glow effect on hover */}
          <div className="absolute inset-0 rounded-xl bg-primary/20 opacity-0 group-hover:opacity-100 blur-md transition-opacity duration-300 -z-10" />
        </button>
      </div>

      {/* Content: hidden when collapsed */}
      {!isCollapsed && (
        <div
          className="flex-1 flex flex-col overflow-hidden bg-muted rounded-br-lg"
        >
          {/* New Chat Button - Simple button without dropdown */}
          <div className={`p-3 border-b ${
            safeTheme === "light" ? "border-gray-200" : "border-gray-700"
          }`}>
            <button
              onClick={onNewChat}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl font-semibold transition-all duration-200 group bg-[#C35F5C] hover:bg-[#B35150] text-white shadow-md hover:shadow-lg"
              title="เริ่มการสนทนาใหม่"
              data-testid="new-chat-btn"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                <path d="M12 8v8m-4-4h8"></path>
              </svg>
              <span>เริ่มการสนทนาใหม่</span>
            </button>
          </div>

          {/* Chat History Header */}
          <div className="px-3 pt-3 pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              ประวัติการสนทนา
            </h3>
          </div>

          {/* Chat History List */}
          <div className="flex-1 overflow-y-auto px-2 pb-3">
            {summaries.length === 0 ? (
              <div className={`text-xs text-center py-8 ${
                safeTheme === "light" ? "text-gray-400" : "text-gray-500"
              }`}>
                ยังไม่มีประวัติการสนทนา
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {summaries.map((s) => (
                  <div
                    key={s.id}
                    className={`w-full relative group text-left px-3 py-1.5 rounded-lg transition-all duration-200 ${
                      s.id === activeId
                        ? "bg-accent border-l-4 border-primary"
                        : "hover:bg-accent/50"
                    }`}
                  >
                    {/* TODO #45: Editable title or clickable history item */}
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
                        className={`w-full px-2 py-1 rounded border ${
                          safeTheme === "light"
                            ? "bg-white text-gray-800 border-gray-300"
                            : "bg-gray-700 text-gray-200 border-gray-600"
                        }`}
                      />
                    ) : (
                      <button
                        onClick={() => onLoad(s)}
                        className="w-full text-left"
                        title={s.title}
                        data-testid="chat-history-item"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium truncate ${
                              s.id === activeId
                                ? safeTheme === "light" ? "text-primary" : "text-secondary"
                                : safeTheme === "light" ? "text-gray-800" : "text-gray-200"
                            }`}>
                              {s.title}
                            </div>
                            <div className={`text-xs mt-1 ${
                              safeTheme === "light" ? "text-gray-500" : "text-gray-400"
                            }`}>
                              {(() => {
                                const date = new Date(s.time);
                                return date.toLocaleString("th-TH", {
                                  timeZone: "Asia/Bangkok",
                                  year: "numeric",
                                  month: "2-digit",
                                  day: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: false,
                                });
                              })()}
                            </div>
                          </div>
                          {/* Rename icon on hover */}
                          {onRename && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingId(s.id);
                                setEditTitle(s.title);
                              }}
                              className={`ml-2 opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity ${
                                safeTheme === "light"
                                  ? "hover:bg-gray-200"
                                  : "hover:bg-gray-700"
                              }`}
                              title="เปลี่ยนชื่อ"
                            >
                              <svg
                                className="w-4 h-4"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                              </svg>
                            </button>
                          )}
                        </div>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* User Menu at Bottom */}
          {isLoggedIn && (
            <div className={`mt-auto border-t ${
              safeTheme === "light" ? "border-gray-200" : "border-gray-700"
            }`}>
              <div className="p-3">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 hover:bg-accent text-foreground"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-semibold">
                    {userDispName?.charAt(0) || "U"}
                  </div>
                  <div className="flex-1 text-left">
                    <div className={`text-sm font-medium ${
                      safeTheme === "light" ? "text-gray-800" : "text-gray-200"
                    }`}>
                      {userDispName || "User"}
                    </div>
                  </div>
                  <FontAwesomeIcon 
                    icon={faGear} 
                    className={`text-sm transition-transform duration-200 ${
                      showUserMenu ? 'rotate-90' : ''
                    }`}
                  />
                </button>
                
                {/* User Menu Popup */}
                {showUserMenu && (
                  <div className={`mt-2 rounded-lg overflow-hidden border ${
                    safeTheme === "light" 
                      ? "bg-white border-gray-200 shadow-lg" 
                      : "bg-gray-800 border-gray-700 shadow-xl"
                  }`}>
                    {/* Home Button */}
                    <button
                      onClick={() => {
                        router.push("/");
                        setShowUserMenu(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                        safeTheme === "light"
                          ? "hover:bg-gray-50 text-gray-700"
                          : "hover:bg-gray-700 text-gray-300"
                      }`}
                      aria-label="หน้าแรก"
                    >
                      <FontAwesomeIcon icon={faHome} className="w-4" />
                      <span className="text-sm">หน้าแรก</span>
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
                          <span className="text-sm">API Key</span>
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
                          <span className="text-sm">จัดการผู้ใช้</span>
                        </button>
                        
                        <div className={`border-t ${
                          safeTheme === "light" ? "border-gray-200" : "border-gray-700"
                        }`} />
                      </>
                    )}
                    
                    <button
                      onClick={() => {
                        router.push("/workspace-settings");
                        setShowUserMenu(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                        safeTheme === "light"
                          ? "hover:bg-gray-50 text-gray-700"
                          : "hover:bg-gray-700 text-gray-300"
                      }`}
                    >
                      <FontAwesomeIcon icon={faBriefcase} className="w-4" />
                      <span className="text-sm">Workspace Settings</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        router.push("/personalization");
                        setShowUserMenu(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                        safeTheme === "light"
                          ? "hover:bg-gray-50 text-gray-700"
                          : "hover:bg-gray-700 text-gray-300"
                      }`}
                    >
                      <FontAwesomeIcon icon={faPalette} className="w-4" />
                      <span className="text-sm">Personalization</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        router.push("/settings");
                        setShowUserMenu(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                        safeTheme === "light"
                          ? "hover:bg-gray-50 text-gray-700"
                          : "hover:bg-gray-700 text-gray-300"
                      }`}
                    >
                      <FontAwesomeIcon icon={faGear} className="w-4" />
                      <span className="text-sm">Settings</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        router.push("/help");
                        setShowUserMenu(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                        safeTheme === "light"
                          ? "hover:bg-gray-50 text-gray-700"
                          : "hover:bg-gray-700 text-gray-300"
                      }`}
                    >
                      <FontAwesomeIcon icon={faQuestion} className="w-4" />
                      <span className="text-sm">Help</span>
                    </button>
                    
                    <div className={`border-t ${
                      safeTheme === "light" ? "border-gray-200" : "border-gray-700"
                    }`} />
                    
                    <button
                      onClick={async () => {
                        await logout();
                        router.push("/login");
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      <FontAwesomeIcon icon={faSignOutAlt} className="w-4" />
                      <span className="text-sm">Log out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};

export default ChatSidebar;
