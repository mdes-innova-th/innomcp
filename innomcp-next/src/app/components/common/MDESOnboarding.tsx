"use client";

import { useState, useEffect } from "react";

interface MDESOnboardingProps {
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

export default function MDESOnboarding({
  isOpen,
  onComplete,
  onSkip,
}: MDESOnboardingProps) {
  const [current, setCurrent] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [showResponse, setShowResponse] = useState(false);

  const totalScreens = 5;

  // Reset demo state when onboarding opens/closes
  useEffect(() => {
    if (isOpen) {
      setCurrent(0);
      setUserInput("");
      setShowResponse(false);
    }
  }, [isOpen]);

  const handleNext = () => {
    if (current < totalScreens - 1) {
      setCurrent((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (current > 0) {
      setCurrent((prev) => prev - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem("innomcp.onboarding.done", "true");
    onComplete();
  };

  const handleSkip = () => {
    localStorage.setItem("innomcp.onboarding.done", "true");
    onSkip();
  };

  const handleTrySubmit = () => {
    if (userInput.trim()) {
      setShowResponse(true);
    }
  };

  if (!isOpen) return null;

  // Render each screen content based on index
  const renderScreen = (index: number) => {
    switch (index) {
      case 0:
        return (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center mb-6">
              <span className="text-5xl">🤖</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              ยินดีต้อนรับ
            </h1>
            <p className="text-xl text-gray-600 mb-4">
              สู่แพลตฟอร์ม INNOMCP
            </p>
            <p className="text-base text-gray-500">
              ระบบปัญญาประดิษฐ์เพื่อภาครัฐ โดยกระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม (MDES)
            </p>
          </div>
        );
      case 1:
        return (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center mb-6">
              <span className="text-5xl">🧠</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              INNOMCP คืออะไร
            </h2>
            <p className="text-gray-600 mb-3">
              INNOMCP เป็นแพลตฟอร์ม AI ที่พัฒนาเพื่อสนับสนุนการทำงานของหน่วยงานภาครัฐ
            </p>
            <ul className="text-left text-gray-600 space-y-2 max-w-sm mx-auto">
              <li>✅ ถาม-ตอบความรู้ทั่วไป</li>
              <li>✅ วิเคราะห์เอกสาร</li>
              <li>✅ สรุปเนื้อหา</li>
              <li>✅ ให้คำแนะนำเชิงนโยบาย</li>
            </ul>
            <p className="text-gray-500 mt-4 text-sm">
              ปลอดภัย ใช้งานฟรี ตลอด 24 ชั่วโมง
            </p>
          </div>
        );
      case 2:
        return (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center mb-6">
              <span className="text-5xl">💬</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              วิธีใช้งาน
            </h2>
            <ol className="text-left text-gray-600 space-y-3 max-w-sm mx-auto">
              <li>
                <span className="font-semibold">1.</span> พิมพ์คำถามหรืออัปโหลดไฟล์ที่ต้องการ
              </li>
              <li>
                <span className="font-semibold">2.</span> ระบบจะประมวลผลและตอบกลับทันที
              </li>
              <li>
                <span className="font-semibold">3.</span> อ่านผลลัพธ์หรือถามต่อเนื่องได้
              </li>
            </ol>
            <p className="text-gray-500 mt-4 text-sm">
              ไม่มีข้อจำกัดในการถาม คุณสามารถใช้งานได้ตลอดเวลา
            </p>
          </div>
        );
      case 3:
        return (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-full max-w-md">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">
                  ลองพิมพ์คำถาม
                </h2>
                <p className="text-gray-500">
                  ทดลองถามอะไรก็ได้ แล้วดูตัวอย่างการตอบ
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="ถามอะไรก็ได้เกี่ยวกับภาครัฐ..."
                    className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                    onKeyDown={(e) => e.key === "Enter" && handleTrySubmit()}
                  />
                  <button
                    onClick={handleTrySubmit}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    ส่ง
                  </button>
                </div>
                {showResponse && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-left">
                    <p className="text-gray-700 text-sm font-medium mb-1">
                      🤖 INNOMCP ตอบ:
                    </p>
                    <p className="text-gray-600 text-sm">
                      นี่คือตัวอย่างการตอบกลับจากระบบ AI
                      คุณสามารถถามคำถามจริงได้หลังเริ่มใช้งาน
                      ระบบพร้อมให้บริการเกี่ยวกับข้อมูลภาครัฐ
                      กฎหมาย นโยบาย และอื่น ๆ
                    </p>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400 text-center">
                * ตัวอย่างการตอบกลับ ไม่มีการเชื่อมต่อกับระบบจริงในขณะนี้
              </p>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mb-6">
              <span className="text-5xl">🚀</span>
            </div>
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              พร้อมแล้ว!
            </h2>
            <p className="text-gray-600 mb-8 max-w-sm">
              คุณพร้อมที่จะเริ่มต้นใช้งาน INNOMCP
              แพลตฟอร์ม AI เพื่อภาครัฐแล้ว
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-lg mx-4 rounded-2xl bg-white shadow-2xl overflow-hidden animate-fade-in">
        {/* Skip button */}
        <div className="flex justify-end p-4">
          <button
            onClick={handleSkip}
            className="text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors"
          >
            ข้าม
          </button>
        </div>

        {/* Screen slider */}
        <div className="overflow-hidden">
          <div
            className="flex transition-transform duration-300 ease-in-out"
            style={{ transform: `translateX(-${current * 100}%)` }}
          >
            {Array.from({ length: totalScreens }).map((_, index) => (
              <div
                key={index}
                className="w-full flex-shrink-0 px-8 pb-8 min-h-[400px] flex items-center"
              >
                {renderScreen(index)}
              </div>
            ))}
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center space-x-2 pb-4">
          {Array.from({ length: totalScreens }).map((_, idx) => (
            <div
              key={idx}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                idx === current ? "bg-blue-600" : "bg-gray-300"
              }`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex justify-between px-8 pb-6">
          {current > 0 ? (
            <button
              onClick={handlePrev}
              className="text-blue-600 font-medium hover:text-blue-800 transition-colors"
            >
              ย้อนกลับ
            </button>
          ) : (
            <div />
          )}
          {current < totalScreens - 1 ? (
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-all font-medium"
            >
              ถัดไป
            </button>
          ) : (
            <button
              onClick={handleComplete}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 active:scale-95 transition-all font-semibold"
            >
              เริ่มต้นใช้งาน
            </button>
          )}
        </div>
      </div>
    </div>
  );
}