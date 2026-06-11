'use client'

// AgentAvatar.tsx — Avatar for MDES AI agents in INNOMCP chat
// Shows model family initial in a colored circle with optional active ring.

import { type FC } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentAvatarProps {
  /** Full model name (e.g. "gemma-2b-it", "qwen2.5-7b", "deepseek-r1") */
  model: string
  /** Avatar size */
  size?: 'xs' | 'sm' | 'md'
  /** Whether the agent is currently active (adds a colored ring) */
  active?: boolean
  /** Additional CSS classes */
  className?: string
}

// ---------------------------------------------------------------------------
// Family → display data
// ---------------------------------------------------------------------------

interface FamilyStyle {
  bg: string
  text: string
  ring: string
  initial: string
}

const familyStyles: Record<string, FamilyStyle> = {
  gemma: {
    bg: 'bg-indigo-500',
    text: 'text-white',
    ring: 'ring-indigo-300',
    initial: 'G',
  },
  qwen: {
    bg: 'bg-sky-500',
    text: 'text-white',
    ring: 'ring-sky-300',
    initial: 'Q',
  },
  deepseek: {
    bg: 'bg-violet-500',
    text: 'text-white',
    ring: 'ring-violet-300',
    initial: 'D',
  },
  llama: {
    bg: 'bg-amber-500',
    text: 'text-white',
    ring: 'ring-amber-300',
    initial: 'L',
  },
  mistral: {
    bg: 'bg-rose-500',
    text: 'text-white',
    ring: 'ring-rose-300',
    initial: 'M',
  },
}

const defaultStyle: FamilyStyle = {
  bg: 'bg-gray-400',
  text: 'text-white',
  ring: 'ring-gray-300',
  initial: '?',
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Extract the model family from a full model name.
 * Known families are checked as prefixes (case-insensitive).
 */
function getFamily(model: string): string {
  const lower = model.toLowerCase()
  const families = Object.keys(familyStyles)
  for (const family of families) {
    if (lower.startsWith(family)) {
      return family
    }
  }
  return 'default'
}

// ---------------------------------------------------------------------------
// Size mapping
// ---------------------------------------------------------------------------

const sizeClasses: Record<NonNullable<AgentAvatarProps['size']>, string> = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AgentAvatar: FC<AgentAvatarProps> = ({
  model,
  size = 'md',
  active = false,
  className = '',
}) => {
  const family = getFamily(model)
  const style = familyStyles[family] ?? defaultStyle

  return (
    <div
      className={[
        'inline-flex items-center justify-center rounded-full',
        'select-none shrink-0',
        style.bg,
        style.text,
        sizeClasses[size],
        active ? `ring-2 ring-offset-2 ${style.ring}` : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={`${family} agent`}
      role="img"
    >
      <span className="font-semibold leading-none">{style.initial}</span>
    </div>
  )
}

export default AgentAvatar