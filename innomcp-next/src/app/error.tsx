'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faHome, faArrowLeft, faShieldAlt } from '@fortawesome/free-solid-svg-icons';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log error to console (in production, send to error reporting service)
    console.error('Application error:', error);
  }, [error]);

  // Security: Sanitize error message to prevent XSS
  const sanitizeMessage = (message: string): string => {
    // Remove any HTML tags and potential script injections
    return message
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .substring(0, 200); // Limit length
  };

  const safeErrorMessage = sanitizeMessage(error.message || 'เกิดข้อผิดพลาดที่ไม่คาดคิด');

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-2xl w-full text-center">
        {/* Error Icon */}
        <div className="mb-8 relative">
          <div className="inline-block">
            <div className="text-8xl text-red-500 dark:text-red-400 animate-pulse">
              <FontAwesomeIcon icon={faExclamationTriangle} />
            </div>
            <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full animate-ping"></div>
          </div>
        </div>

        {/* Title & Description */}
        <div className="mb-8 space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">
            Oops! Something went wrong
          </h1>
          <p className="text-lg text-gray-700 dark:text-gray-300">
            ขออภัย เกิดข้อผิดพลาดในระบบ
          </p>

          {/* Error Details (only show in development) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-left">
              <div className="flex items-start gap-3">
                <FontAwesomeIcon icon={faShieldAlt} className="text-red-500 mt-1" />
                <div className="flex-1">
                  <h3 className="font-semibold text-red-800 dark:text-red-300 mb-2">
                    Error Details (Development Only)
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-400 font-mono break-words">
                    {safeErrorMessage}
                  </p>
                  {error.digest && (
                    <p className="text-xs text-red-600 dark:text-red-500 mt-2">
                      Digest: {error.digest}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* User-friendly message for production */}
          {process.env.NODE_ENV !== 'development' && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                เราได้บันทึกข้อผิดพลาดนี้แล้วและกำลังดำเนินการแก้ไข
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
          <button
            onClick={reset}
            className="group flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
          >
            <span>ลองอีกครั้ง</span>
          </button>

          <Link
            href="/"
            className="group flex items-center gap-2 px-6 py-3 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold rounded-xl shadow-md hover:shadow-lg border border-gray-200 dark:border-gray-700 transform hover:scale-105 transition-all duration-200"
          >
            <FontAwesomeIcon icon={faHome} className="group-hover:scale-110 transition-transform" />
            <span>กลับสู่หน้าหลัก</span>
          </Link>

          <button
            onClick={() => window.history.back()}
            className="group flex items-center gap-2 px-6 py-3 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold rounded-xl shadow-md hover:shadow-lg border border-gray-200 dark:border-gray-700 transform hover:scale-105 transition-all duration-200"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="group-hover:-translate-x-1 transition-transform" />
            <span>ย้อนกลับ</span>
          </button>
        </div>

        {/* Additional Help */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            หากปัญหายังคงอยู่
          </h3>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p>• ลองรีเฟรชหน้าเว็บ (Ctrl + R หรือ Cmd + R)</p>
            <p>• ลองเคลียร์แคชเบราว์เซอร์</p>
            <p>• ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต</p>
            <p>• ติดต่อผู้ดูแลระบบหากปัญหายังไม่หาย</p>
          </div>
        </div>

        {/* Decorative dots */}
        <div className="mt-12 flex justify-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
        </div>
      </div>
    </div>
  );
}
