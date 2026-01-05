"use client";

import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRobot, faChevronDown } from "@fortawesome/free-solid-svg-icons";

type AIMode = 'local' | 'remote' | 'hybrid';

interface AIModelSelectorProps {
  theme: string;
  onModeChange?: (mode: AIMode) => void;
}

const AIModelSelector: React.FC<AIModelSelectorProps> = ({ theme, onModeChange }) => {
  const [currentMode, setCurrentMode] = useState<AIMode>('local');
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Fetch current AI mode from backend
    fetchCurrentMode();
  }, []);

  const fetchCurrentMode = async () => {
    try {
      const backendHost = process.env.NEXT_PUBLIC_NODE_HOST || 'http://localhost:3011';
      const response = await fetch(`${backendHost}/api/ai-mode`);
      if (response.ok) {
        const data = await response.json();
        setCurrentMode(data.mode);
      }
    } catch (error) {
      console.error('Failed to fetch AI mode:', error);
    }
  };

  const handleModeChange = async (mode: AIMode) => {
    try {
      const backendHost = process.env.NEXT_PUBLIC_NODE_HOST || 'http://localhost:3011';
      const response = await fetch(`${backendHost}/api/ai-mode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode }),
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentMode(mode);
        setIsOpen(false);
        
        if (onModeChange) {
          onModeChange(mode);
        }
        
        // Show success message
        console.log(`AI Mode changed to: ${mode}`);
      } else {
        console.error('Failed to change AI mode');
      }
    } catch (error) {
      console.error('Error changing AI mode:', error);
    }
  };

  const getModeLabel = (mode: AIMode) => {
    switch (mode) {
      case 'local':
        return 'Local GPU';
      case 'remote':
        return 'Remote AI';
      case 'hybrid':
        return 'Hybrid';
      default:
        return 'Local';
    }
  };

  const getModeColor = (mode: AIMode) => {
    switch (mode) {
      case 'local':
        return 'text-green-600 dark:text-green-400';
      case 'remote':
        return 'text-blue-600 dark:text-blue-400';
      case 'hybrid':
        return 'text-purple-600 dark:text-purple-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const safeTheme = mounted ? theme : "light";

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
          safeTheme === "light"
            ? "bg-gray-100 hover:bg-gray-200 text-gray-700"
            : "bg-gray-800 hover:bg-gray-700 text-gray-300"
        }`}
        title="เปลี่ยน AI Model"
      >
        <FontAwesomeIcon icon={faRobot} className={getModeColor(currentMode)} />
        <span className="text-sm font-medium">{getModeLabel(currentMode)}</span>
        <FontAwesomeIcon 
          icon={faChevronDown} 
          className={`text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-[100]" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown Menu */}
          <div
            className={`absolute bottom-full left-0 mb-2 w-48 rounded-lg shadow-lg z-[101] ${
              safeTheme === "light"
                ? "bg-white border border-gray-200"
                : "bg-gray-800 border border-gray-700"
            }`}
          >
            <div className="py-1">
              <button
                onClick={() => handleModeChange('local')}
                className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${
                  currentMode === 'local'
                    ? safeTheme === "light"
                      ? "bg-green-50 text-green-700"
                      : "bg-green-900/30 text-green-400"
                    : safeTheme === "light"
                    ? "hover:bg-gray-50"
                    : "hover:bg-gray-700"
                }`}
              >
                <FontAwesomeIcon icon={faRobot} className="text-green-600 dark:text-green-400" />
                <div>
                  <div className="font-medium">Local GPU</div>
                  <div className="text-xs text-gray-500">Fast & Private</div>
                </div>
              </button>

              <button
                onClick={() => handleModeChange('remote')}
                className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${
                  currentMode === 'remote'
                    ? safeTheme === "light"
                      ? "bg-blue-50 text-blue-700"
                      : "bg-blue-900/30 text-blue-400"
                    : safeTheme === "light"
                    ? "hover:bg-gray-50"
                    : "hover:bg-gray-700"
                }`}
              >
                <FontAwesomeIcon icon={faRobot} className="text-blue-600 dark:text-blue-400" />
                <div>
                  <div className="font-medium">Remote AI</div>
                  <div className="text-xs text-gray-500">Cloud Power</div>
                </div>
              </button>

              <button
                onClick={() => handleModeChange('hybrid')}
                className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${
                  currentMode === 'hybrid'
                    ? safeTheme === "light"
                      ? "bg-purple-50 text-purple-700"
                      : "bg-purple-900/30 text-purple-400"
                    : safeTheme === "light"
                    ? "hover:bg-gray-50"
                    : "hover:bg-gray-700"
                }`}
              >
                <FontAwesomeIcon icon={faRobot} className="text-purple-600 dark:text-purple-400" />
                <div>
                  <div className="font-medium">Hybrid</div>
                  <div className="text-xs text-gray-500">Best of Both</div>
                </div>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AIModelSelector;
