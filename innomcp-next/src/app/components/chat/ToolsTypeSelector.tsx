"use client";

import React, { useState } from "react";

export type ToolType = 'auto' | 'weather' | 'calculation' | 'art' | 'data' | 'datetime';

interface ToolsTypeSelectorProps {
  onNewChat: () => void;
  onToolTypeChange?: (type: ToolType) => void;
  theme: string;
}

const ToolsTypeSelector: React.FC<ToolsTypeSelectorProps> = ({ 
  onNewChat, 
  onToolTypeChange,
  theme 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ToolType>('auto');

  const toolTypes = [
    {
      id: 'auto' as ToolType,
      name: 'Auto',
      description: 'AI เลือกเครื่องมือให้อัตโนมัติ',
      icon: '🤖',
      color: 'text-purple-600 dark:text-purple-400',
      borderColor: 'border-purple-500'
    },
    {
      id: 'weather' as ToolType,
      name: 'สภาพอากาศ',
      description: 'พยากรณ์อากาศและข้อมูลอุตุนิยมวิทยา',
      icon: '🌤️',
      color: 'text-blue-600 dark:text-blue-400',
      borderColor: 'border-blue-500'
    },
    {
      id: 'calculation' as ToolType,
      name: 'คำนวณ',
      description: 'เครื่องคิดเลข อนุพันธ์ ปริพันธ์',
      icon: '🔢',
      color: 'text-green-600 dark:text-green-400',
      borderColor: 'border-green-500'
    },
    {
      id: 'art' as ToolType,
      name: 'ศิลปะ',
      description: 'สร้างกราฟ แผนภูมิ และภาพ',
      icon: '🎨',
      color: 'text-pink-600 dark:text-pink-400',
      borderColor: 'border-pink-500'
    },
    {
      id: 'data' as ToolType,
      name: 'ข้อมูล',
      description: 'World Bank, Archive, NASA',
      icon: '📊',
      color: 'text-orange-600 dark:text-orange-400',
      borderColor: 'border-orange-500'
    },
    {
      id: 'datetime' as ToolType,
      name: 'วัน-เวลา',
      description: 'วันที่และเวลาปัจจุบัน',
      icon: '⏰',
      color: 'text-cyan-600 dark:text-cyan-400',
      borderColor: 'border-cyan-500'
    },
  ];

  const handleTypeSelect = (type: ToolType) => {
    setSelectedType(type);
    if (onToolTypeChange) {
      onToolTypeChange(type);
    }
    // Save to localStorage
    localStorage.setItem('selectedToolType', type);
    setIsOpen(false);
  };

  React.useEffect(() => {
    // Load from localStorage
    const savedType = localStorage.getItem('selectedToolType') as ToolType;
    if (savedType) {
      setSelectedType(savedType);
    }
  }, []);

  const getCurrentTypeColor = () => {
    return toolTypes.find(t => t.id === selectedType)?.color || 'text-purple-600';
  };

  return (
    <div className="relative group">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-secondary/90 hover:bg-secondary text-white rounded-full p-2 w-9 h-9 font-semibold shadow-sm flex items-center justify-center hover:scale-105 transition-all duration-200 cursor-pointer"
        title={`เครื่องมือ: ${toolTypes.find(t => t.id === selectedType)?.name || 'Auto'}`}
      >
        <span className="text-xl font-bold transition-transform duration-300 group-hover:rotate-90">+</span>
      </button>
      
      {/* Dropdown menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-[80]" 
            onClick={() => setIsOpen(false)}
          />
          
          <div className="absolute bottom-full left-0 mb-2 z-[90] animate-fadeIn">
            <div className={`rounded-lg shadow-xl border min-w-[320px] overflow-hidden ${
              theme === 'light' 
                ? 'bg-white border-gray-200' 
                : 'bg-gray-800 border-gray-700'
            }`}>
              {/* New Chat Section */}
              <div className={`p-2 border-b ${
                theme === 'light' ? 'border-gray-200' : 'border-gray-700'
              }`}>
                <button
                  onClick={() => {
                    onNewChat();
                    setIsOpen(false);
                  }}
                  className="w-full px-4 py-3 hover:bg-secondary/10 rounded-lg transition-colors flex items-center gap-3 text-left"
                >
                  <svg className="w-5 h-5 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    <path d="M12 8v8m-4-4h8"></path>
                  </svg>
                  <div>
                    <div className={`font-semibold ${theme === 'light' ? 'text-gray-800' : 'text-gray-200'}`}>
                      เริ่มการสนทนาใหม่
                    </div>
                    <div className="text-xs text-muted-foreground">
                      เคลียร์ข้อความและเริ่มต้นใหม่
                    </div>
                  </div>
                </button>
              </div>

              {/* Tools Type Selection */}
              <div className="p-2">
                <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  เลือกประเภท Tools
                </div>
                <div className="space-y-1">
                  {toolTypes.map((tool) => (
                    <button
                      key={tool.id}
                      onClick={() => handleTypeSelect(tool.id)}
                      className={`w-full px-4 py-2.5 rounded-lg transition-all flex items-center gap-3 text-left ${
                        selectedType === tool.id
                          ? theme === 'light'
                            ? 'bg-secondary/10 border-l-4'
                            : 'bg-secondary/20 border-l-4'
                          : 'hover:bg-accent/50'
                      }`}
                      style={selectedType === tool.id ? { borderLeftColor: tool.borderColor.replace('border-', '') } : {}}
                    >
                      <span className="text-2xl">{tool.icon}</span>
                      <div className="flex-1">
                        <div className={`font-semibold ${
                          selectedType === tool.id 
                            ? tool.color
                            : theme === 'light' ? 'text-gray-800' : 'text-gray-200'
                        }`}>
                          {tool.name}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {tool.description}
                        </div>
                      </div>
                      {selectedType === tool.id && (
                        <svg className={`w-5 h-5 ${tool.color}`} viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ToolsTypeSelector;
