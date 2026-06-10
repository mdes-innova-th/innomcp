'use client';

import React, { useState, useCallback } from 'react';

interface MessageFeedbackWidgetProps {
  messageId: string;
  onFeedback: (messageId: string, rating: 'good' | 'bad', comment?: string) => void;
  className?: string;
}

const MessageFeedbackWidget: React.FC<MessageFeedbackWidgetProps> = ({
  messageId,
  onFeedback,
  className = '',
}) => {
  const [voted, setVoted] = useState(false);
  const [rating, setRating] = useState<'good' | 'bad' | null>(null);
  const [showComment, setShowComment] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVote = useCallback(
    (selectedRating: 'good' | 'bad') => {
      if (voted) return;
      setRating(selectedRating);
      setShowComment(true);
    },
    [voted]
  );

  const handleSubmit = useCallback(async () => {
    if (!rating || voted) return;

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          rating,
          comment: commentText.length > 0 ? commentText : undefined,
        }),
      });

      if (!res.ok) {
        throw new Error('Feedback submission failed');
      }

      setSubmitted(true);
      setVoted(true);
      onFeedback(messageId, rating, commentText || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    }
  }, [messageId, rating, commentText, voted, onFeedback]);

  // Reset if user changes rating before submit? Not required, but we keep simple.

  if (submitted) {
    return (
      <div className={`flex items-center gap-1 text-xs text-green-600 mt-1 ${className}`}>
        <span>ขอบคุณสำหรับข้อเสนอแนะ 🙏</span>
      </div>
    );
  }

  return (
    <div
      className={`hidden group-hover:flex items-center gap-2 mt-1 transition-opacity ${className}`}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => handleVote('good')}
          disabled={voted}
          className={`px-2 py-1 rounded text-sm transition-colors ${
            rating === 'good'
              ? 'bg-green-100 text-green-600'
              : 'text-gray-400 hover:text-green-500'
          } ${voted ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label="ดี"
        >
          👍
        </button>
        <button
          type="button"
          onClick={() => handleVote('bad')}
          disabled={voted}
          className={`px-2 py-1 rounded text-sm transition-colors ${
            rating === 'bad'
              ? 'bg-red-100 text-red-600'
              : 'text-gray-400 hover:text-red-500'
          } ${voted ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label="ไม่ดี"
        >
          👎
        </button>
      </div>

      {showComment && !voted && (
        <div className="flex items-center gap-2">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value.slice(0, 200))}
            placeholder="ความคิดเห็น (ไม่บังคับ)"
            rows={1}
            maxLength={200}
            className="w-40 px-2 py-1 text-xs border border-gray-300 rounded resize-none focus:outline-none focus:border-blue-400"
          />
          <span className="text-[10px] text-gray-400">
            {commentText.length}/200
          </span>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            ส่ง
          </button>
        </div>
      )}

      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
};

export default MessageFeedbackWidget;