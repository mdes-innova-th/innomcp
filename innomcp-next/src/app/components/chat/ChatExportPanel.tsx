// ChatExportPanel.tsx
"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";

interface Message {
  sender: "user" | "ai";
  text: string;
  timestamp?: number;
}

interface ChatExportPanelProps {
  messages: Message[];
  conversationTitle?: string;
  onClose: () => void;
}

type ExportFormat = "pdf" | "markdown" | "json" | "text";

interface FormatInfo {
  label: string;
  description: string;
  extension: string;
  estimate: string; // human readable size
  generate: () => string;
}

// Helper: format bytes
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Helper: estimate download size (generate content and measure)
const estimateSize = (content: string): string => {
  const bytes = new Blob([content]).size;
  return formatBytes(bytes);
};

// Helper: create download link and click
function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Helper: generate timestamp for filename
function getTimestamp(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  return `${y}${m}${d}-${h}${mi}`;
}

// Helper: format timestamp in messages for display
function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const MDES_HEADER = "INNOMCP — ศูนย์ MCP ภาครัฐ | ส่งออกการสนทนา";

const ChatExportPanel: React.FC<ChatExportPanelProps> = ({
  messages,
  conversationTitle = "การสนทนา",
  onClose,
}) => {
  const [formatContents, setFormatContents] = useState<
    Record<ExportFormat, string>
  >({} as Record<ExportFormat, string>);
  const [sizes, setSizes] = useState<Record<ExportFormat, string>>({} as Record<ExportFormat, string>);
  const [loading, setLoading] = useState(true);

  // Generate all formats at mount
  useEffect(() => {
    // Build common data
    const title = conversationTitle || "การสนทนา";
    const headerLine = `${MDES_HEADER}\nหัวข้อ: ${title}\nจำนวนข้อความ: ${messages.length}\n${"-".repeat(50)}`;

    // 1) PDF (HTML for printing)
    const pdfHtml = generatePDF(messages, title);

    // 2) Markdown
    const md = generateMarkdown(messages, title, headerLine);

    // 3) JSON
    const json = generateJSON(messages, title, headerLine);

    // 4) Text
    const text = generateText(messages, title, headerLine);

    const contents: Record<ExportFormat, string> = {
      pdf: pdfHtml,
      markdown: md,
      json: json,
      text: text,
    };

    setFormatContents(contents);

    // Estimate sizes
    const newSizes: Record<ExportFormat, string> = {
      pdf: estimateSize(pdfHtml),
      markdown: estimateSize(md),
      json: estimateSize(json),
      text: estimateSize(text),
    };
    setSizes(newSizes);
    setLoading(false);
  }, [messages, conversationTitle]);

  // Handle download per format
  const handleExport = useCallback(
    (format: ExportFormat) => {
      if (!formatContents[format]) return;
      const content = formatContents[format];
      const ts = getTimestamp();
      const ext = format === "pdf" ? "html" : (format === "markdown" ? "md" : format === "json" ? "json" : "txt");
      const filename = `innomcp-chat-${ts}.${ext}`;
      const mimeMap: Record<string, string> = {
        pdf: "text/html",
        markdown: "text/markdown",
        json: "application/json",
        text: "text/plain",
      };
      if (format === "pdf") {
        // Open new window with printable HTML and trigger print
        const printWindow = window.open("", "_blank", "width=800,height=600");
        if (!printWindow) {
          alert("กรุณาอนุญาตให้เปิดหน้าต่างใหม่เพื่อพิมพ์");
          return;
        }
        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.focus();
        // Delay print to let content render
        setTimeout(() => {
          printWindow.print();
          // Optionally close after print
          // printWindow.close();
        }, 500);
      } else {
        downloadBlob(content, filename, mimeMap[ext]);
      }
    },
    [formatContents]
  );

  // Format buttons configuration
  const formats: Array<{ key: ExportFormat; label: string; description: string; icon: string }> = [
    { key: "pdf", label: "PDF", description: "พิมพ์เป็น PDF ผ่านเบราว์เซอร์", icon: "📄" },
    { key: "markdown", label: "Markdown", description: "ดาวน์โหลดไฟล์ .md", icon: "📝" },
    { key: "json", label: "JSON", description: "ข้อมูลดิบในรูปแบบ JSON", icon: "📊" },
    { key: "text", label: "ข้อความธรรมดา", description: "สำเนาเป็นข้อความ (.txt)", icon: "📃" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">
            ส่งออกการสนทนา
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-2xl leading-none"
            aria-label="ปิด"
          >
            &times;
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">กำลังคำนวณขนาดไฟล์...</div>
        ) : (
          <div className="space-y-3">
            {formats.map((fmt) => (
              <button
                key={fmt.key}
                onClick={() => handleExport(fmt.key)}
                className="w-full flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left group"
              >
                <span className="text-2xl">{fmt.icon}</span>
                <div className="flex-1">
                  <div className="font-medium text-gray-800">{fmt.label}</div>
                  <div className="text-sm text-gray-500">{fmt.description}</div>
                </div>
                <div className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                  ~{sizes[fmt.key]}
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 text-xs text-gray-400 text-center">
          ไฟล์จะถูกดาวน์โหลดในรูปแบบที่เลือก
        </div>
      </div>
    </div>
  );
};

// ==================== Generate functions ====================

function generatePDF(messages: Message[], title: string): string {
  const header = `${MDES_HEADER} | หัวข้อ: ${title}`;
  let body = messages
    .map((msg) => {
      const senderLabel = msg.sender === "user" ? "คุณ" : "AI";
      const time = msg.timestamp ? ` - ${formatTimestamp(msg.timestamp)}` : "";
      return `<div class="message ${msg.sender}"><strong>${senderLabel}</strong><span class="time">${time}</span><p>${escapeHtml(msg.text)}</p></div>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)} - ส่งออกการสนทนา</title>
<style>
  body { font-family: 'Noto Sans Thai', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #333; }
  h1 { font-size: 1.5rem; border-bottom: 2px solid #1a73e8; padding-bottom: 8px; }
  .message { margin: 16px 0; padding: 12px; border-radius: 8px; line-height: 1.6; }
  .message.user { background: #e3f2fd; border-left: 4px solid #1a73e8; }
  .message.ai { background: #f5f5f5; border-left: 4px solid #34a853; }
  .message .time { font-size: 0.8rem; color: #666; }
  .message p { margin: 4px 0 0; }
  .footer { margin-top: 40px; font-size: 0.8rem; color: #999; text-align: center; border-top: 1px solid #ddd; padding-top: 10px; }
</style>
</head>
<body>
<h1>${header}</h1>
${body}
<div class="footer">INNOMCP — ศูนย์ MCP ภาครัฐ | ส่งออกเมื่อ ${new Date().toLocaleString("th-TH")}</div>
</body>
</html>`;
}

function generateMarkdown(messages: Message[], title: string, headerLine: string): string {
  let md = `${headerLine}\n\n## รายละเอียด\n`;
  md += `- หัวข้อ: ${title}\n- จำนวนข้อความ: ${messages.length}\n- ส่งออกเมื่อ: ${new Date().toLocaleString("th-TH")}\n\n---\n\n`;
  messages.forEach((msg, i) => {
    const sender = msg.sender === "user" ? "🧑 คุณ" : "🤖 AI";
    const time = msg.timestamp ? ` (${formatTimestamp(msg.timestamp)})` : "";
    md += `### ${sender}${time}\n\n${msg.text}\n\n`;
    if (i < messages.length - 1) md += "---\n\n";
  });
  return md;
}

function generateJSON(messages: Message[], title: string, headerLine: string): string {
  const exportObj = {
    header: headerLine,
    title: title,
    exportedAt: new Date().toISOString(),
    messageCount: messages.length,
    messages: messages.map((m) => ({
      sender: m.sender,
      text: m.text,
      timestamp: m.timestamp ? new Date(m.timestamp).toISOString() : null,
    })),
  };
  return JSON.stringify(exportObj, null, 2);
}

function generateText(messages: Message[], title: string, headerLine: string): string {
  let txt = `${headerLine}\n\nหัวข้อ: ${title}\nจำนวนข้อความ: ${messages.length}\nส่งออกเมื่อ: ${new Date().toLocaleString("th-TH")}\n${"=".repeat(60)}\n\n`;
  messages.forEach((msg) => {
    const sender = msg.sender === "user" ? "คุณ" : "AI";
    const time = msg.timestamp ? ` [${formatTimestamp(msg.timestamp)}]` : "";
    txt += `${sender}${time}:\n${msg.text}\n\n${"-".repeat(40)}\n\n`;
  });
  return txt;
}

// Helper: escape HTML entities
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default ChatExportPanel;