"use client";

import { useEffect, useCallback, useRef, useState } from "react";

/**
 * การกระทำของปุ่มลัด (Shortcut Action)
 */
export interface ShortcutAction {
  /** ปุ่มที่กด เช่น "k", "/", "?" */
  key: string;
  /** ปุ่ม modifier ที่ต้องกดพร้อมกัน (ctrl, meta, shift, alt) */
  modifiers?: ("ctrl" | "meta" | "shift" | "alt")[];
  /** คำอธิบายภาษาไทย */
  description: string;
  /** ฟังก์ชันที่จะเรียกเมื่อกด */
  action: () => void;
  /** เปิดใช้งานอยู่หรือไม่ (ค่าเริ่มต้น true) */
  enabled?: boolean;
  /** ป้องกัน default event หรือไม่ (ค่าเริ่มต้น true) */
  preventDefault?: boolean;
}

/**
 * ตัวเลือกสำหรับ useKeyboardShortcuts
 */
export interface UseKeyboardShortcutsOptions {
  /** รายการ shortcut ทั้งหมด */
  shortcuts: ShortcutAction[];
  /** เปิด/ปิดการทำงานทั้งหมด (default: true) */
  enabled?: boolean;
}

/**
 * useKeyboardShortcuts — จัดการปุ่มลัดกลางของ INNOMCP
 * ลงทะเบียน/ยกเลิกเมื่อ mount/unmount
 * ไม่ทำงานเมื่อผู้ใช้กำลังพิมพ์ใน input/textarea
 *
 * @param options - ตัวเลือก shortcuts และการเปิดใช้งาน
 * @returns { shortcuts, isEnabled, toggleEnabled }
 */
export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions) {
  const { shortcuts, enabled = true } = options;
  const [isEnabled, setIsEnabled] = useState(enabled);
  const shortcutRef = useRef(shortcuts);
  shortcutRef.current = shortcuts; // ป้องกัน stale closure

  const toggleEnabled = useCallback(() => {
    setIsEnabled((prev) => !prev);
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!isEnabled) return;

      // ละเว้นเมื่อ focus อยู่ในช่องกรอกข้อมูล
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.tagName === "SELECT" ||
          (active as HTMLElement).isContentEditable)
      ) {
        return;
      }

      for (const shortcut of shortcutRef.current) {
        if (shortcut.enabled === false) continue;

        const { key, modifiers = [] } = shortcut;

        // ตรวจสอบ modifier แบบแม่นยำ (ต้องตรงตามที่ระบุเท่านั้น)
        const modsMatch =
          event.ctrlKey === modifiers.includes("ctrl") &&
          event.metaKey === modifiers.includes("meta") &&
          event.shiftKey === modifiers.includes("shift") &&
          event.altKey === modifiers.includes("alt");

        if (modsMatch && event.key.toLowerCase() === key.toLowerCase()) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }
          shortcut.action();
          break; // เรียกเฉพาะ shortcut แรกที่ตรง
        }
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isEnabled]); // ติดใหม่เมื่อ isEnabled เปลี่ยน; shortcut ใช้ ref

  return {
    shortcuts,
    isEnabled,
    toggleEnabled,
  };
}

/**
 * รายการ shortcut เริ่มต้นสำหรับ INNOMCP
 * (สามารถนำไป override action ได้ตามต้องการ)
 */
export const INNOMCP_SHORTCUTS: ShortcutAction[] = [
  {
    key: "k",
    modifiers: ["ctrl"],
    description: "เปิด Command Palette",
    action: () => {},
  },
  {
    key: "/",
    modifiers: ["ctrl"],
    description: "แสดงแผงปุ่มลัด",
    action: () => {},
  },
  {
    key: "n",
    modifiers: ["ctrl"],
    description: "สร้างแชทใหม่",
    action: () => {},
  },
  {
    key: "Escape",
    modifiers: [],
    description: "หยุด AI / ปิด Modal",
    action: () => {},
  },
  {
    key: "?",
    modifiers: [],
    description: "แสดงวิธีใช้ปุ่มลัด",
    action: () => {},
  },
];