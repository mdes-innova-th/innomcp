'use client';

import React, { type FC, type ReactNode } from 'react';

// ──────────────────────────────────────────────
// Brand colors & styling (MDES / INNOMCP)
// ──────────────────────────────────────────────
const BRAND = {
  primary: '#1557B8',       // MDES blue
  primaryLight: '#E8F0FE',
  text: '#1F2937',
  muted: '#6B7280',
  border: '#E5E7EB',
} as const;

// Reusable wrapper for all empty states
const EmptyStateWrapper: FC<{
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}> = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
    <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#E8F0FE]">
      {icon}
    </div>
    <h3 className="mb-2 text-xl font-semibold text-[#1F2937]">{title}</h3>
    {description && (
      <p className="mb-6 max-w-sm text-sm text-[#6B7280] leading-relaxed">
        {description}
      </p>
    )}
    {action && <div className="mt-2">{action}</div>}
  </div>
);

// ──────────────────────────────────────────────
// Generic EmptyState
// ──────────────────────────────────────────────
export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export const EmptyState: FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => (
  <EmptyStateWrapper
    icon={icon ?? <DefaultIcon />}
    title={title}
    description={description}
    action={action}
  />
);

// ──────────────────────────────────────────────
// NoConversations
// ──────────────────────────────────────────────
export interface NoConversationsProps {
  onNewChat: () => void;
}

export const NoConversations: FC<NoConversationsProps> = ({ onNewChat }) => (
  <EmptyStateWrapper
    icon={<ChatBubbleIcon />}
    title="ไม่มีประวัติการสนทนา"
    description="คุณยังไม่มีบทสนทนาใด ๆ เริ่มแชทใหม่เพื่อพูดคุยกับผู้ช่วย AI"
    action={
      <button
        onClick={onNewChat}
        className="rounded-lg bg-[#1557B8] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
      >
        เริ่มแชทใหม่
      </button>
    }
  />
);

// ──────────────────────────────────────────────
// NoSearchResults
// ──────────────────────────────────────────────
export interface NoSearchResultsProps {
  query: string;
}

export const NoSearchResults: FC<NoSearchResultsProps> = ({ query }) => (
  <EmptyStateWrapper
    icon={<SearchIcon />}
    title={`ไม่พบผลลัพธ์สำหรับ "${query}"`}
    description="ลองใช้คำค้นอื่นหรือตรวจสอบการสะกดคำให้ถูกต้อง"
  />
);

// ──────────────────────────────────────────────
// NoArtifacts
// ──────────────────────────────────────────────
export const NoArtifacts: FC = () => (
  <EmptyStateWrapper
    icon={<FileIcon />}
    title="ยังไม่มีไฟล์ผลลัพธ์"
    description="ไฟล์ผลลัพธ์จากโมเดล AI จะปรากฏที่นี่หลังจากสร้าง"
  />
);

// ──────────────────────────────────────────────
// OfflineState
// ──────────────────────────────────────────────
export interface OfflineStateProps {
  onRetry: () => void;
}

export const OfflineState: FC<OfflineStateProps> = ({ onRetry }) => (
  <EmptyStateWrapper
    icon={<OfflineIcon />}
    title="ไม่มีการเชื่อมต่ออินเทอร์เน็ต"
    description="กรุณาตรวจสอบการเชื่อมต่อเครือข่ายของคุณแล้วลองอีกครั้ง"
    action={
      <button
        onClick={onRetry}
        className="rounded-lg border border-[#1557B8] bg-white px-5 py-2.5 text-sm font-medium text-[#1557B8] shadow-sm transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
      >
        ลองอีกครั้ง
      </button>
    }
  />
);

// ──────────────────────────────────────────────
// NoProviders
// ──────────────────────────────────────────────
export interface NoProvidersProps {
  onAddProvider: () => void;
}

export const NoProviders: FC<NoProvidersProps> = ({ onAddProvider }) => (
  <EmptyStateWrapper
    icon={<ProviderIcon />}
    title="ยังไม่มีผู้ให้บริการ AI"
    description="เพิ่มผู้ให้บริการเพื่อเริ่มใช้งานโมเดลภาษาและเครื่องมือ AI"
    action={
      <button
        onClick={onAddProvider}
        className="rounded-lg bg-[#1557B8] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
      >
        เพิ่มผู้ให้บริการ
      </button>
    }
  />
);

// ──────────────────────────────────────────────
// Inline SVG icons (simple, no external deps)
// ──────────────────────────────────────────────

function DefaultIcon() {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#1557B8"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function ChatBubbleIcon() {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#1557B8"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#1557B8"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#1557B8"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function OfflineIcon() {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#1557B8"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
      <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  );
}

function ProviderIcon() {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#1557B8"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}