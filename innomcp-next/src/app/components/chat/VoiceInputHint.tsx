'use client'

import { FC, memo } from 'react'
function cn(...c: (string | undefined | false | null)[]) { return c.filter(Boolean).join(' '); }

// ---------- Types ---------- //

interface VoiceInputHintProps {
  isAudioAttached?: boolean
  isWhisperProcessing?: boolean
  className?: string
}

interface VoiceStatusBadgeProps {
  isProcessing?: boolean
  isDone?: boolean
  className?: string
}

// ---------- SVG Mic Icon (animated) ---------- //

const MicIcon: FC<{ className?: string; pulse?: boolean }> = ({
  className,
  pulse = false,
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn(
      'h-4 w-4 shrink-0',
      pulse && 'animate-pulse',
      className
    )}
  >
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="22" />
  </svg>
)

// ---------- Spinner ---------- //

const Spinner: FC<{ className?: string }> = ({ className }) => (
  <svg
    className={cn('h-4 w-4 animate-spin', className)}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
)

// ---------- Main VoiceInputHint ---------- //

const VoiceInputHint: FC<VoiceInputHintProps> = ({
  isAudioAttached = false,
  isWhisperProcessing = false,
  className,
}) => {
  // Determine state
  const isActive = isAudioAttached || isWhisperProcessing

  if (!isActive) return null

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs leading-tight',
        // base style: small, compact
        isWhisperProcessing
          ? 'bg-green-50 text-green-700 ring-1 ring-green-200'
          : 'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
        className
      )}
    >
      {isWhisperProcessing ? (
        <>
          <Spinner className="text-green-600" />
          <span>กำลังถอดเสียง...</span>
        </>
      ) : (
        <>
          <MicIcon className="text-gray-500" />
          <span>ถอดเสียงด้วย Whisper AI</span>
        </>
      )}
    </div>
  )
}

VoiceInputHint.displayName = 'VoiceInputHint'

// ---------- VoiceStatusBadge (for toolbar) ---------- //

const VoiceStatusBadge: FC<VoiceStatusBadgeProps> = ({
  isProcessing = false,
  isDone = false,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex h-6 w-6 items-center justify-center rounded-full',
        isDone && 'bg-green-100 text-green-600',
        isProcessing && 'bg-yellow-100 text-yellow-600',
        !isProcessing && !isDone && 'bg-gray-100 text-gray-400',
        className
      )}
      title={
        isDone
          ? 'แปลงเสียงสำเร็จ'
          : isProcessing
          ? 'กำลังแปลงเสียง'
          : 'พร้อมใช้งาน'
      }
    >
      {isProcessing ? (
        <Spinner />
      ) : isDone ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <MicIcon />
      )}
    </div>
  )
}

VoiceStatusBadge.displayName = 'VoiceStatusBadge'

// ---------- Exports ---------- //

export { VoiceInputHint, VoiceStatusBadge }
export type { VoiceInputHintProps, VoiceStatusBadgeProps }