<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-33 role=dev model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":77,"completion_tokens":1740,"total_tokens":1817,"prompt_tokens_details":{"cached_tokens":18,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1399,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 13s
 generated: 2026-06-13T05:26:43.489Z -->
interface ProgressBarProps {
  value: number;
  label?: string;
  color?: 'blue' | 'green' | 'red' | 'yellow';
  showPercent?: boolean;
}

const COLOR_MAP: Record<'blue' | 'green' | 'red' | 'yellow', string> = {
  blue: 'bg-blue-600',
  green: 'bg-green-600',
  red: 'bg-red-600',
  yellow: 'bg-yellow-500',
};

export default function ProgressBar({ value, label, color = 'blue', showPercent }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const bgClass = COLOR_MAP[color] ?? COLOR_MAP.blue;

  return (
    <div className="w-full">
      {(label || showPercent) && (
        <div className="flex justify-between items-center mb-1">
          {label && (
            <span className="text-sm font-medium text-gray-700">{label}</span>
          )}
          {showPercent && (
            <span className="text-sm font-medium text-gray-700">{clamped}%</span>
          )}
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full rounded-full ${bgClass} transition-all duration-300 ease-out`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
