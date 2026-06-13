<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-47 role=dev model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":82,"completion_tokens":2756,"total_tokens":2838,"prompt_tokens_details":{"cached_tokens":81,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2158,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 29s
 generated: 2026-06-13T05:27:36.924Z -->
import React from 'react';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-16 h-16 text-xl',
};

const colorPalette = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-orange-500',
  'bg-red-500',
  'bg-cyan-500',
  'bg-rose-500',
];

function getInitials(name: string): string {
  const clean = name.trim();
  if (!clean) return '?';
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getColorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colorPalette[Math.abs(hash) % colorPalette.length];
}

export default function Avatar({ src, name, size = 'md', className = '' }: AvatarProps) {
  const sizeClasses = sizeMap[size];
  const initials = getInitials(name);

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`inline-block rounded-full object-cover ${sizeClasses} ${className}`}
      />
    );
  }

  const bgColor = getColorFromName(name);

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full font-medium text-white ${bgColor} ${sizeClasses} ${className}`}
      aria-label={name}
      role="img"
    >
      {initials}
    </div>
  );
}
