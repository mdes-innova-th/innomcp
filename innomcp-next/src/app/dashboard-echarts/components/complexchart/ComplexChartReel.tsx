import React, { useState, useCallback, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faToggleOn, faToggleOff } from "@fortawesome/free-solid-svg-icons";
import { Swiper, SwiperSlide } from "swiper/react";
import { Mousewheel, Keyboard, Pagination } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import "swiper/css/pagination";

interface DashboardChartReelProps {
  slides: React.ReactNode[];
  initialSlide?: number;
  id?: string; // เพิ่ม id เพื่อแยกแต่ละ swiper
}

// Helper functions สำหรับ localStorage
const getStoredSlideIndex = (
  instanceId: string,
  defaultIndex: number = 0
): number => {
  if (typeof window === "undefined") return defaultIndex;
  try {
    const stored = localStorage.getItem(`swiper-${instanceId}`);
    return stored ? parseInt(stored, 10) : defaultIndex;
  } catch (error) {
    console.warn("Error reading from localStorage:", error);
    return defaultIndex;
  }
};

const setStoredSlideIndex = (instanceId: string, index: number): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`swiper-${instanceId}`, index.toString());
  } catch (error) {
    console.warn("Error writing to localStorage:", error);
  }
};

// Component หลักสำหรับแสดง chart reel
const DashboardChartReel: React.FC<DashboardChartReelProps> = ({
  slides,
  initialSlide = 0,
  id,
}) => {
  // สร้าง unique id สำหรับแต่ละ swiper instance
  const instanceId = useRef(
    id || `swiper-${Math.random().toString(36).substring(2, 11)}`
  ).current;

  // State สำหรับเก็บตำแหน่งปัจจุบัน
  const [currentSlide, setCurrentSlide] = useState(() =>
    getStoredSlideIndex(instanceId, initialSlide)
  );

  // State สำหรับ toggle โหมด
  const [isSwiperMode, setIsSwiperMode] = useState(true);

  const combinedSlides = slides;

  // Refs to detect tap vs swipe for touch/pointer devices
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const pointerStartPos = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches && e.touches[0];
    if (t) touchStartPos.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const t = e.changedTouches && e.changedTouches[0];
    if (!t || !touchStartPos.current) {
      touchStartPos.current = null;
      return;
    }
    const dx = t.clientX - touchStartPos.current.x;
    const dy = t.clientY - touchStartPos.current.y;
    touchStartPos.current = null;
    const distance = Math.hypot(dx, dy);
    // treat as tap when movement is very small
    if (distance < 10) {
      const target = e.target as Element | null;
      if (target && target instanceof Element) {
        // don't synthesize clicks for native interactive elements — let the browser handle them
        const interactive = (target as HTMLElement).closest(
          'button, a, input, label, select, textarea, [role="button"], [role="link"]'
        );
        if (!interactive) {
          target.dispatchEvent(
            new MouseEvent("click", {
              bubbles: true,
              cancelable: true,
              view: window,
            })
          );
        }
      }
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerStartPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!pointerStartPos.current) return;
    const dx = e.clientX - pointerStartPos.current.x;
    const dy = e.clientY - pointerStartPos.current.y;
    pointerStartPos.current = null;
    const distance = Math.hypot(dx, dy);
    if (distance < 6) {
      const target = e.target as Element | null;
      if (target && target instanceof Element) {
        const interactive = (target as HTMLElement).closest(
          'button, a, input, label, select, textarea, [role="button"], [role="link"]'
        );
        if (!interactive) {
          target.dispatchEvent(
            new MouseEvent("click", {
              bubbles: true,
              cancelable: true,
              view: window,
            })
          );
        }
      }
    }
  };

  const handleSlideChange = useCallback(
    (swiper: SwiperType) => {
      const newIndex = swiper.activeIndex;
      setCurrentSlide(newIndex);
      setStoredSlideIndex(instanceId, newIndex);
    },
    [instanceId]
  );

  // ปุ่ม toggle
  const handleToggleMode = () => setIsSwiperMode((prev) => !prev);

  return (
    <div className="w-full h-full">
      <div className="flex m-0 p-0 relative justify-end items-center">
        <div className="flex items-center">
          <button
            type="button"
            onClick={handleToggleMode}
            aria-pressed={!isSwiperMode}
            aria-label={isSwiperMode ? "สลับเป็นโหมดปกติ" : "สลับเป็นโหมดสไลด์"}
            title={isSwiperMode ? "แสดงโหมดปกติ" : "แสดงโหมดสไลด์"}
            className={`inline-flex justify-center items-center cursor-pointer text-[28px] p-0 transition-colors duration-200 focus:outline-none  z-50 ${
              isSwiperMode ? "text-blue-600" : "text-gray-600"
            }`}
          >
            <FontAwesomeIcon
              icon={isSwiperMode ? faToggleOn : faToggleOff}
              className="w-8 h-8"
            />
            <span className="text-gray-500 text-sm inline-flex ps-1">
              {isSwiperMode ? "โหมดสไลด์" : "โหมดปกติ"}
            </span>
          </button>
        </div>
      </div>
      {isSwiperMode ? (
        <Swiper
          modules={[Mousewheel, Keyboard, Pagination]}
          spaceBetween={32}
          slidesPerView={1}
          initialSlide={currentSlide}
          style={{ width: "100%", height: "100%", touchAction: "pan-y" }}
          direction="horizontal"
          mousewheel={{ forceToAxis: true, sensitivity: 1 }}
          keyboard={{ enabled: true }}
          allowTouchMove={true}
          simulateTouch={true}
          grabCursor={true}
          // allow child clicks/taps to propagate instead of being swallowed by swiper
          touchStartPreventDefault={false}
          preventClicks={false}
          preventClicksPropagation={false}
          pagination={{ type: "bullets", clickable: true }}
          onSlideChange={handleSlideChange}
        >
          {combinedSlides.map((slide, idx) => (
            <SwiperSlide key={idx}>
              <div
                className="w-full"
                style={{ touchAction: "manipulation" }}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
              >
                {slide}
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      ) : (
        <div className="flex flex-col gap-6 overflow-y-auto">
          {combinedSlides.map((slide, idx) => (
            <div
              key={idx}
              className="w-full"
              style={{ touchAction: "manipulation" }}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
            >
              {slide}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DashboardChartReel;
