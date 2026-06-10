"use client";

import React, { useCallback, useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface FocusManagerProps {
  /** เมื่อเป็น `true` จะดักจับโฟกัสภายใน children */
  active: boolean;
  /** callback เมื่อกดปุ่ม Escape (เฉพาะเมื่อ active = true) */
  onEscape?: () => void;
  /** CSS selector สำหรับ element ที่ต้องการให้ได้รับโฟกัสก่อน (ภายใน container) */
  initialFocus?: string;
  /** เนื้อหาที่จะถูกดักจับโฟกัส */
  children: React.ReactNode;
  className?: string;
}

// Selector สำหรับ elements ที่สามารถรับโฟกัสได้ด้วย Tab
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null // กรองเฉพาะที่ไม่ได้ซ่อนด้วย display:none
  );
}

function isFocusable(element: HTMLElement): boolean {
  return element.matches(FOCUSABLE_SELECTOR) && element.offsetParent !== null;
}

// ---------------------------------------------------------------------------
// FocusManager Component
// ---------------------------------------------------------------------------
export function FocusManager({
  active,
  onEscape,
  initialFocus,
  children,
  className,
}: FocusManagerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // ใช้สำหรับดักจับโฟกัสด้วย focusin (ครอบคลุมทุกกรณี)
  const lastFocusedInsideRef = useRef<HTMLElement | null>(null);

  // ------------------------------------------------------------------
  // เปิด/ปิด focus trap + initial focus + restore
  // ------------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (active) {
      // เก็บ element ที่มีโฟกัสอยู่ก่อนเปิด trap
      previousFocusRef.current = document.activeElement as HTMLElement | null;

      // defer การตั้งโฟกัสต้นทางหลังจาก render เสร็จ
      const raf = requestAnimationFrame(() => {
        if (!container) return;

        const targetElement = initialFocus
          ? container.querySelector<HTMLElement>(initialFocus)
          : null;

        if (targetElement && isFocusable(targetElement)) {
          targetElement.focus();
        } else {
          const firstFocusable = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
          if (firstFocusable) {
            firstFocusable.focus();
          } else {
            container.focus(); // ใช้ container เป็นตัว fallback
          }
        }
      });

      // listener สำหรับเหตุการณ์ focusin (ดักจับทุกการเปลี่ยนโฟกัส)
      const handleFocusIn = (e: FocusEvent) => {
        if (!containerRef.current || !active) return;
        const target = e.target as HTMLElement | null;
        if (!target) return;

        if (containerRef.current.contains(target)) {
          // เป็นการโฟกัสภายใน -> จำไว้ใช้กรณี focus หลุด
          lastFocusedInsideRef.current = target;
        } else {
          // โฟกัสหลุดออกนอก container -> ดึงกลับ
          e.preventDefault(); // ไม่ได้ผลกับ focusin แต่ช่วยกันบางพฤติกรรม
          // ใช้ requestAnimationFrame เพื่อเลี่ยง loop
          requestAnimationFrame(() => {
            if (!containerRef.current || !active) return;
            const last = lastFocusedInsideRef.current;
            if (last && containerRef.current.contains(last)) {
              last.focus();
            } else {
              // fallback ไปที่ first focusable
              const first = containerRef.current.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
              if (first && isFocusable(first)) {
                first.focus();
              } else {
                containerRef.current?.focus();
              }
            }
          });
        }
      };

      document.addEventListener("focusin", handleFocusIn);
      return () => {
        cancelAnimationFrame(raf);
        document.removeEventListener("focusin", handleFocusIn);
        // คืนโฟกัสเมื่อ deactivate
        if (previousFocusRef.current) {
          try {
            previousFocusRef.current.focus();
          } catch {
            // ละเลยหาก element ถูกลบออกจาก DOM
          }
          previousFocusRef.current = null;
        }
      };
    } else {
      // active เป็น false: รีเซ็ต lastFocusedInside
      lastFocusedInsideRef.current = null;
      // คืนโฟกัส
      if (previousFocusRef.current) {
        try {
          previousFocusRef.current.focus();
        } catch {}
        previousFocusRef.current = null;
      }
    }
  }, [active, initialFocus]);

  // ------------------------------------------------------------------
  // Keydown handler สำหรับ Esc + Tab/Shift+Tab จุดประสงค์การ UX
  // ------------------------------------------------------------------
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!active) return;

      if (e.key === "Escape") {
        onEscape?.();
        return;
      }

      if (e.key === "Tab") {
        const container = containerRef.current;
        if (!container) return;

        const focusableElements = getFocusableElements(container);
        if (focusableElements.length === 0) {
          e.preventDefault();
          container.focus();
          return;
        }

        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];
        const activeElement = document.activeElement;

        if (!container.contains(activeElement)) {
          e.preventDefault();
          first.focus();
          return;
        }

        if (e.shiftKey) {
          if (activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    },
    [active, onEscape]
  );

  return (
    <div
      ref={containerRef}
      className={className}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      // ช่วยป้องกันกรณีคลิกภายนอกแล้ว focus หลุด (ทำงานร่วมกับ focusin listener)
      onMouseDown={(e) => {
        if (!active) return;
        const container = containerRef.current;
        if (container && !container.contains(e.target as Node)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// useFocusTrap Hook
// ---------------------------------------------------------------------------
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement>,
  active: boolean
): void {
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const lastFocusedInsideRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (active) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;

      // ตั้งโฟกัสเริ่มต้น
      requestAnimationFrame(() => {
        const first = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        if (first && isFocusable(first)) {
          first.focus();
        } else {
          container.focus();
        }
      });

      // focusin trap
      const handleFocusIn = (e: FocusEvent) => {
        const target = e.target as HTMLElement | null;
        if (!target || !containerRef.current || !active) return;

        if (containerRef.current.contains(target)) {
          lastFocusedInsideRef.current = target;
        } else {
          requestAnimationFrame(() => {
            if (!containerRef.current || !active) return;
            const last = lastFocusedInsideRef.current;
            if (last && containerRef.current.contains(last)) {
              last.focus();
            } else {
              const first = containerRef.current.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
              if (first && isFocusable(first)) {
                first.focus();
              } else {
                containerRef.current?.focus();
              }
            }
          });
        }
      };

      document.addEventListener("focusin", handleFocusIn);
      return () => {
        document.removeEventListener("focusin", handleFocusIn);
        // คืนโฟกัส
        if (previousFocusRef.current) {
          try {
            previousFocusRef.current.focus();
          } catch {}
          previousFocusRef.current = null;
        }
      };
    } else {
      lastFocusedInsideRef.current = null;
      if (previousFocusRef.current) {
        try {
          previousFocusRef.current.focus();
        } catch {}
        previousFocusRef.current = null;
      }
    }
  }, [containerRef, active]);
}

// ---------------------------------------------------------------------------
// useFocusReturn Hook
// ---------------------------------------------------------------------------
export function useFocusReturn(active: boolean): void {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (active) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
    } else {
      if (previousFocusRef.current) {
        try {
          previousFocusRef.current.focus();
        } catch {
          // ignore
        }
      }
    }
  }, [active]);
}