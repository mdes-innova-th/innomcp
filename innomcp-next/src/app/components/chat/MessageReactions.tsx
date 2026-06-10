'use client'

import React, { useCallback, useRef, useState, useEffect } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Reaction {
  emoji: string
  count: number
  hasReacted: boolean
}

interface MessageReactionsProps {
  reactions: Reaction[]
  onReact: (emoji: string) => void
  onAddCustom?: () => void
  className?: string
}

// ---------------------------------------------------------------------------
// Helper – tooltip text in Thai
// ---------------------------------------------------------------------------
function getTooltipText(reaction: Reaction): string {
  const { count, hasReacted } = reaction
  if (!hasReacted) {
    return `${count} คน`
  }
  // user has reacted
  if (count === 1) {
    return 'คุณ'
  }
  return `คุณ และอีก ${count - 1} คน`
}

// ---------------------------------------------------------------------------
// AnimatedCount – wraps the count number with a bounce animation on change
// ---------------------------------------------------------------------------
function AnimatedCount({ count }: { count: number }) {
  const [bounce, setBounce] = useState(false)
  const prevCount = useRef(count)

  useEffect(() => {
    if (prevCount.current !== count) {
      setBounce(true)
      const timeout = setTimeout(() => setBounce(false), 400)
      prevCount.current = count
      return () => clearTimeout(timeout)
    }
  }, [count])

  return (
    <span
      className={`inline-block transition-transform duration-200 ${
        bounce ? 'scale-125' : 'scale-100'
      }`}
      aria-live="polite"
    >
      {count}
    </span>
  )
}

// ---------------------------------------------------------------------------
// MessageReactions component
// ---------------------------------------------------------------------------
const MessageReactions: React.FC<MessageReactionsProps> = ({
  reactions,
  onReact,
  onAddCustom,
  className = '',
}) => {
  // Handle click on a reaction pill
  const handleReactionClick = useCallback(
    (emoji: string) => {
      onReact(emoji)
    },
    [onReact]
  )

  // Handle + button click
  const handleAddCustomClick = useCallback(() => {
    if (onAddCustom) {
      onAddCustom()
    }
  }, [onAddCustom])

  return (
    <div
      className={`flex flex-wrap items-center gap-1 ${className}`}
      role="group"
      aria-label="ปุ่มโต้ตอบ"
    >
      {/* Reaction pills */}
      {reactions.map((reaction) => {
        const tooltipText = getTooltipText(reaction)

        return (
          <button
            key={reaction.emoji}
            type="button"
            onClick={() => handleReactionClick(reaction.emoji)}
            className={`
              group relative inline-flex items-center gap-1 rounded-full
              border border-gray-200 bg-white px-2.5 py-0.5
              text-sm leading-6 shadow-sm transition-all duration-150
              hover:bg-gray-50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
              ${
                reaction.hasReacted
                  ? 'ring-2 ring-blue-500 bg-blue-50 border-blue-200'
                  : ''
              }
            `}
            aria-pressed={reaction.hasReacted}
            aria-label={`${reaction.emoji} – ${reaction.count} คน`}
          >
            {/* Emoji */}
            <span className="text-base leading-none" aria-hidden="true">
              {reaction.emoji}
            </span>

            {/* Count with animation */}
            <span className="tabular-nums">
              <AnimatedCount count={reaction.count} />
            </span>

            {/* Tooltip */}
            <div
              className="
                pointer-events-none absolute -top-9 left-1/2 z-10
                -translate-x-1/2 whitespace-nowrap rounded-md
                bg-gray-800 px-2 py-1 text-xs text-white shadow-lg
                opacity-0 transition-opacity duration-150
                group-hover:opacity-100
              "
              role="tooltip"
            >
              {tooltipText}
              {/* Arrow */}
              <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
            </div>
          </button>
        )
      })}

      {/* Add custom reaction button */}
      {onAddCustom && (
        <button
          type="button"
          onClick={handleAddCustomClick}
          className="
            group relative inline-flex items-center justify-center
            h-8 w-8 rounded-full border border-dashed border-gray-300
            bg-gray-50 text-gray-400 transition-all duration-150
            hover:border-gray-400 hover:bg-white hover:text-gray-600
            focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
          "
          aria-label="เพิ่มอิโมจิแบบกำหนดเอง"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4v16m8-8H4"
            />
          </svg>

          {/* Tooltip for + button */}
          <div
            className="
              pointer-events-none absolute -top-9 left-1/2 z-10
              -translate-x-1/2 whitespace-nowrap rounded-md
              bg-gray-800 px-2 py-1 text-xs text-white shadow-lg
              opacity-0 transition-opacity duration-150
              group-hover:opacity-100
            "
            role="tooltip"
          >
            เพิ่มอิโมจิ
            <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
          </div>
        </button>
      )}
    </div>
  )
}

export default MessageReactions