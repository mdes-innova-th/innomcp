'use client'

import React, { useState, useCallback } from 'react'
import { FiCopy, FiCheck, FiDownload, FiMaximize2 } from 'react-icons/fi'

interface MDESQRCodeProps {
  value: string
  size?: number
  label?: string
  downloadable?: boolean
  className?: string
}

const MDESQRCode: React.FC<MDESQRCodeProps> = ({
  value,
  size = 200,
  label,
  downloadable = true,
  className = '',
}) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = value
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [value])

  return (
    <div
      className={`bg-white border border-gray-200 rounded-xl p-4 shadow-sm ${className}`}
    >
      {/* QR Code Placeholder */}
      <div
        className="flex items-center justify-center mx-auto bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg"
        style={{ width: size, height: size }}
      >
        <span className="text-6xl text-gray-300">📱</span>
      </div>

      {/* Encoded Value - Copyable */}
      <div className="mt-4 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500 mb-1">ค่าที่เข้ารหัส</p>
          <p className="text-sm font-mono text-gray-700 truncate" title={value}>
            {value}
          </p>
        </div>
        <button
          onClick={handleCopy}
          className="flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-md border border-gray-200 hover:bg-gray-50 transition-colors"
          aria-label={copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
          title={copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
        >
          {copied ? (
            <FiCheck className="w-4 h-4 text-green-600" />
          ) : (
            <FiCopy className="w-4 h-4 text-gray-500" />
          )}
        </button>
      </div>

      {/* Label */}
      {label && (
        <p className="mt-2 text-sm text-gray-600 text-center">{label}</p>
      )}

      {/* Download Button (Placeholder) */}
      {downloadable && (
        <div className="mt-4 flex justify-center">
          <button
            disabled
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-indigo-50 text-indigo-500 rounded-lg border border-indigo-200 cursor-not-allowed opacity-60"
            title="ฟังก์ชันนี้ต้องใช้ library qrcode เพิ่มเติม"
          >
            <FiDownload className="w-4 h-4" />
            ดาวน์โหลด QR
          </button>
        </div>
      )}

      {/* Note */}
      <p className="mt-3 text-xs text-gray-400 text-center">
        ต้องการ library qrcode เพิ่มเติม
      </p>
    </div>
  )
}

export default MDESQRCode