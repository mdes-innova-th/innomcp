<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: COMP-10 role=dev model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":70,"completion_tokens":2969,"total_tokens":3039,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2101,"image_tokens":0},"cache_creation_input_tokens":0} | 55s
 generated: 2026-06-13T05:29:24.970Z -->
import React from 'react';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  showFirst?: boolean;
  showLast?: boolean;
}

const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  onPageChange,
  showFirst = false,
  showLast = false,
}) => {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('ellipsis-start');
      
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      
      for (let i = start; i <= end; i++) pages.push(i);
      
      if (page < totalPages - 2) pages.push('ellipsis-end');
      pages.push(totalPages);
    }
    return pages;
  };

  const baseBtnClass = "px-3 py-1.5 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1";
  const activeBtnClass = "bg-blue-600 text-white shadow-sm";
  const inactiveBtnClass = "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300";
  const disabledBtnClass = "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200";

  return (
    <nav className="flex items-center justify-center space-x-1" aria-label="Pagination">
      {showFirst && (
        <button
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className={`${baseBtnClass} ${page === 1 ? disabledBtnClass : inactiveBtnClass}`}
        >
          First
        </button>
      )}
      
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        className={`${baseBtnClass} ${page === 1 ? disabledBtnClass : inactiveBtnClass}`}
        aria-label="Previous page"
      >
        Prev
      </button>

      {getPageNumbers().map((p, index) => {
        if (typeof p === 'string') {
          return (
            <span key={p} className="px-2 py-1.5 text-sm text-gray-500 select-none">
              ...
            </span>
          );
        }
        return (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`${baseBtnClass} ${p === page ? activeBtnClass : inactiveBtnClass}`}
            aria-current={p === page ? 'page' : undefined}
          >
            {p}
          </button>
        );
      })}

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        className={`${baseBtnClass} ${page === totalPages ? disabledBtnClass : inactiveBtnClass}`}
        aria-label="Next page"
      >
        Next
      </button>

      {showLast && (
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          className={`${baseBtnClass} ${page === totalPages ? disabledBtnClass : inactiveBtnClass}`}
        >
          Last
        </button>
      )}
    </nav>
  );
};

export default Pagination;
