<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: COMP-8 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":70,"completion_tokens":556,"total_tokens":626,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":213,"image_tokens":0},"cache_creation_input_tokens":0} | 12s
 generated: 2026-06-13T05:28:34.860Z -->
import React from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  children,
  footer,
  className = '',
  onClick,
}) => {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      className={`w-full rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 ${
        onClick
          ? 'cursor-pointer text-left hover:shadow-md hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
          : ''
      } ${className}`}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      {(title || subtitle) && (
        <div className="mb-4">
          {title && (
            <h3 className="text-lg font-semibold text-gray-900 leading-tight">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
          )}
        </div>
      )}
      <div className="text-gray-700">{children}</div>
      {footer && (
        <div className="mt-4 pt-4 border-t border-gray-100">{footer}</div>
      )}
    </Component>
  );
};

export default Card;
