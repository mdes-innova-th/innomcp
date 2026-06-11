'use client';

import React from 'react';

interface MDESVerifiedBadgeProps {
  /** Badge style variant */
  variant: 'gov' | 'mdes' | 'verified';
  /** Badge size – defaults to 'xs' */
  size?: 'xs' | 'sm';
  /** Additional Tailwind classes to merge */
  className?: string;
}

const variantLabel: Record<MDESVerifiedBadgeProps['variant'], string> = {
  gov: '🏛️ ราชการ',
  mdes: '✓ MDES',
  verified: '✓ รับรอง',
};

const sizeClasses: Record<NonNullable<MDESVerifiedBadgeProps['size']>, string> = {
  xs: 'text-[10px] px-1.5 py-0.5',
  sm: 'text-xs px-2 py-1',
};

const baseClasses = 'inline-flex items-center font-medium leading-none bg-blue-600 text-white rounded-full';

const MDESVerifiedBadge: React.FC<MDESVerifiedBadgeProps> = ({
  variant,
  size = 'xs',
  className = '',
}) => {
  const label = variantLabel[variant];
  const sizeClass = sizeClasses[size];

  return (
    <span
      className={`${baseClasses} ${sizeClass} ${className}`}
      aria-label={label}
    >
      {label}
    </span>
  );
};

export default MDESVerifiedBadge;