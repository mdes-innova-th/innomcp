'use client';

import React, { useMemo, useCallback, useState } from 'react';

interface UserAvatarProps {
  name?: string;
  email?: string;
  imageUrl?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isGuest?: boolean;
  className?: string;
}

// Eight preset background colours for name-derived initials
const AVATAR_COLORS = [
  'bg-red-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-cyan-500',
  'bg-blue-500',
  'bg-violet-500',
  'bg-pink-500',
];

// Size mapping in pixels
const SIZE_MAP: Record<NonNullable<UserAvatarProps['size']>, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
};

// Tailwind classes for each size (width and height as pixels)
const SIZE_CLASSES: Record<NonNullable<UserAvatarProps['size']>, string> = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

// Text size classes for initials
const TEXT_SIZE_CLASSES: Record<NonNullable<UserAvatarProps['size']>, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

/**
 * Simple hash function to pick a deterministic colour index from a string.
 * Returns a number between 0 and 7.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash * 31 + char) % 7;
  }
  return Math.abs(hash);
}

const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  email,
  imageUrl,
  size = 'md',
  isGuest = false,
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);

  // Compute initials (first two characters of name, uppercase, or fallback)
  const initials = useMemo(() => {
    if (isGuest) return 'G';
    if (name && name.trim().length > 0) {
      const trimmed = name.trim();
      const chars = trimmed.split(/\s+/);
      if (chars.length === 1) {
        // Single word – take first two characters
        return chars[0].slice(0, 2).toUpperCase();
      }
      // Multiple words – take first letter of first and last words
      const first = chars[0][0] ?? '';
      const last = chars[chars.length - 1][0] ?? '';
      return (first + last).toUpperCase().slice(0, 2);
    }
    // Fallback if no name
    return email ? email[0].toUpperCase() : 'G';
  }, [name, email, isGuest]);

  // Determine background colour based on name (or email)
  const bgColor = useMemo(() => {
    if (isGuest) return 'bg-gray-400'; // distinct grey for guests
    const seed = name || email || '';
    return AVATAR_COLORS[hashString(seed)];
  }, [name, email, isGuest]);

  // Handle image load error – fallback to initials
  const handleImgError = useCallback(() => {
    setImgError(true);
  }, []);

  // Build accessible label
  const ariaLabel = isGuest
    ? 'ผู้ใช้ทั่วไป (Guest)'
    : name
    ? `รูปผู้ใช้: ${name}`
    : email
    ? `รูปผู้ใช้: ${email}`
    : 'รูปผู้ใช้';

  // Pixel size for the avatar (used for img dimensions)
  const pxSize = SIZE_MAP[size];
  const containerClass = `relative inline-flex items-center justify-center rounded-full overflow-hidden ${SIZE_CLASSES[size]} ${className}`;

  // Show image only if imageUrl is provided and no error occurred
  const showImage = imageUrl && !imgError;

  return (
    <div
      className={`${containerClass} ${showImage ? '' : bgColor} transition-transform duration-200 hover:scale-105 focus:outline-none`}
      role="img"
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      {showImage ? (
        <img
          src={imageUrl}
          alt={ariaLabel}
          width={pxSize}
          height={pxSize}
          className="object-cover w-full h-full"
          onError={handleImgError}
          loading="lazy"
        />
      ) : (
        <span
          className={`${
            isGuest ? 'text-white text-lg leading-none' : 'text-white font-medium'
          } ${TEXT_SIZE_CLASSES[size]} flex items-center justify-center w-full h-full`}
        >
          {isGuest ? (
            <span role="img" aria-label="ผู้ใช้ทั่วไป">👤</span>
          ) : (
            initials
          )}
        </span>
      )}
    </div>
  );
};

export default UserAvatar;