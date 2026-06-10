"use client";

import { useState } from "react";

interface MessageTemplate {
  id: string;
  category: string;
  title: string;
  template: string;
  variables?: string[];
}

interface QuickComposePanelProps {
  onCompose: (text: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

// Built-in templates for Thai government
const templates: MessageTemplate[] = [
  {
    id: "summary",
    category: "สรุปเอกสาร",
    title: "สรุปเอกสาร",
    template: "กรุณาสรุปเอกสารนี้เป็น 5 ประเด็นหลัก ภาษาที่เข้าใจง่ายสำหรับผู้บริหาร",
  },
  {
    id: "draft-official",
    category: "ร่างหนังสือราชการ",
    title: "ร่างหนังสือราชการ",
    template: "ช่วยร่างหนังสือราชการเรื่อง [หัวข้อ] ถึง [หน่วยงาน] โดยมีเนื้อหาดังนี้...",
    variables: ["หัวข้อ", "หน่วยงาน"],
  },
  {
    id: "analyze-data",
    category: "วิเคราะห์ข้อมูล",
    title: "วิเคราะห์ข้อมูล",
    template: "วิเคราะห์ข้อมูลนี้และสรุป 3 insight หลัก พร้อม recommendation",
  },
  {
    id: "law-search",
    category: "ค้นหาข้อมูลกฎหมาย",
    title: "ค้นหาข้อมูลกฎหมาย",
    template: "ค้นหาและอธิบายกฎหมาย/ระเบียบที่เกี่ยวข้องกับ [หัวข้อ]",
    variables: ["หัวข้อ"],
  },
  {
    id: "weather-report",
    category: "รายงานสภาพอากาศ",
    title: "รายงานสภาพอากาศ",
    template: "รายงานสภาพอากาศและการเตือนภัยธรรมชาติ จังหวัด [จังหวัด] วันที่ [วันที่]",
    variables: ["จังหวัด", "วันที่"],
  },
];

const categories = Array.from(new Set(templates.map((t) => t.category)));

export default function QuickComposePanel({
  onCompose,
  isOpen,
  onClose,
}: QuickComposePanelProps) {
  const [activeCategory, setActiveCategory] = useState<string>(
    categories[0] || ""
  );
  const [selectedTemplate, setSelectedTemplate] =
    useState<MessageTemplate | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>(
    {}
  );

  // Reset when panel opens
  if (!isOpen && (selectedTemplate || Object.keys(variableValues).length)) {
    // This runs in render but is harmless; effect not needed because state resets on close
    // We'll handle clean up in useEffect if we want but here it's fine.
  }

  const handleTemplateClick = (template: MessageTemplate) => {
    if (template.variables && template.variables.length > 0) {
      setSelectedTemplate(template);
      // Initialize variable values as empty
      const initial: Record<string, string> = {};
      template.variables.forEach((v) => (initial[v] = ""));
      setVariableValues(initial);
    } else {
      // No variables – compose directly
      onCompose(template.template);
      onClose();
    }
  };

  const handleVariableChange = (variable: string, value: string) => {
    setVariableValues((prev) => ({ ...prev, [variable]: value }));
  };

  const handleVariableSubmit = () => {
    if (!selectedTemplate) return;
    let finalText = selectedTemplate.template;
    selectedTemplate.variables?.forEach((variable) => {
      finalText = finalText.replace(
        `[${variable}]`,
        variableValues[variable] || `[${variable}]`
      );
    });
    onCompose(finalText);
    setSelectedTemplate(null);
    setVariableValues({});
    onClose();
  };

  const handleCancelVariableForm = () => {
    setSelectedTemplate(null);
    setVariableValues({});
  };

  if (!isOpen) return null;

  // Filter templates by active category
  const filteredTemplates = templates.filter(
    (t) => t.category === activeCategory
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            ตัวช่วยเขียนข้อความ
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="ปิด"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex overflow-x-auto px-4 py-3 gap-2 bg-gray-50 border-b border-gray-100">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeCategory === cat
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Template list (visible when no variable form is active) */}
        {!selectedTemplate && (
          <div className="px-4 py-4 max-h-60 overflow-y-auto space-y-3">
            {filteredTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => handleTemplateClick(template)}
                className="w-full text-left p-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors group"
              >
                <div className="font-medium text-gray-900 group-hover:text-blue-700">
                  {template.title}
                </div>
                <div className="text-sm text-gray-500 mt-1 line-clamp-2">
                  {template.template}
                </div>
                {template.variables && template.variables.length > 0 && (
                  <span className="inline-block mt-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                    ต้องกรอกข้อมูล
                  </span>
                )}
              </button>
            ))}
            {filteredTemplates.length === 0 && (
              <p className="text-center text-gray-500 text-sm">
                ไม่มีเทมเพลตในหมวดนี้
              </p>
            )}
          </div>
        )}

        {/* Variable input form */}
        {selectedTemplate && (
          <div className="px-5 py-5 space-y-4">
            <div className="text-sm font-medium text-gray-700">
              กรอกข้อมูลสำหรับเทมเพลต: {selectedTemplate.title}
            </div>
            {selectedTemplate.variables?.map((variable) => (
              <div key={variable} className="space-y-1">
                <label className="block text-sm text-gray-600">
                  {variable}
                </label>
                <input
                  type="text"
                  value={variableValues[variable] || ""}
                  onChange={(e) =>
                    handleVariableChange(variable, e.target.value)
                  }
                  placeholder={`ระบุ ${variable}`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleVariableSubmit}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                ใช้งาน
              </button>
              <button
                onClick={handleCancelVariableForm}
                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}