'use client';

import React, { FC } from 'react';

interface WeatherData {
  location: string;
  temperature: number;
  feelsLike?: number;
  humidity?: number;
  condition: string;
  windSpeed?: number;
  uvIndex?: number;
  forecast?: Array<{ day: string; high: number; low: number; icon: string }>;
  warnings?: string[];
  source?: string;
  updatedAt?: string;
}

interface MDESWeatherCardProps {
  data: WeatherData;
  compact?: boolean;
  className?: string;
}

// Helper: map weather condition to emoji
const conditionToEmoji = (condition: string): string => {
  const lower = condition.toLowerCase();
  if (lower.includes('แดด') || lower.includes('แจ่ม')) return '☀️';
  if (lower.includes('ฝน') || lower.includes('rain')) return '🌧️';
  if (lower.includes('เมฆ') || lower.includes('cloud')) return '⛅';
  if (lower.includes('พายุ') || lower.includes('storm')) return '⛈️';
  if (lower.includes('หมอก') || lower.includes('fog')) return '🌫️';
  if (lower.includes('หิมะ') || lower.includes('snow')) return '❄️';
  return '🌤️';
};

const MDESWeatherCard: FC<MDESWeatherCardProps> = ({ data, compact, className }) => {
  const {
    location,
    temperature,
    feelsLike,
    humidity,
    condition,
    windSpeed,
    uvIndex,
    forecast,
    warnings,
    source,
    updatedAt
  } = data;

  return (
    <div
      className={`
        bg-white dark:bg-gray-800 
        rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 
        p-4 sm:p-6 
        ${compact ? 'max-w-xs' : 'max-w-sm w-full'} 
        ${className ?? ''}
      `}
    >
      {/* Location & Temperature */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
            {location}
          </h3>
          {source && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              ที่มา: {source}
            </p>
          )}
        </div>
        <div className="text-right">
          <span
            className={`font-bold text-gray-900 dark:text-white ${
              compact ? 'text-3xl' : 'text-4xl'
            }`}
          >
            {temperature}°<span className="text-xl font-medium">C</span>
          </span>
          {feelsLike !== undefined && (
            <p className="text-sm text-gray-600 dark:text-gray-300">
              รู้สึกเหมือน {feelsLike}°C
            </p>
          )}
        </div>
      </div>

      {/* Condition */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-3xl">{conditionToEmoji(condition)}</span>
        <span
          className={`font-medium text-gray-700 dark:text-gray-200 ${
            compact ? 'text-base' : 'text-lg'
          }`}
        >
          {condition}
        </span>
      </div>

      {/* Details Grid (hidden in compact) */}
      {!compact && (
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          {humidity !== undefined && (
            <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 rounded-lg p-2">
              <span className="text-blue-600 dark:text-blue-300">💧</span>
              <span className="text-gray-700 dark:text-gray-200">
                ความชื้น {humidity}%
              </span>
            </div>
          )}
          {windSpeed !== undefined && (
            <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 rounded-lg p-2">
              <span className="text-blue-600 dark:text-blue-300">💨</span>
              <span className="text-gray-700 dark:text-gray-200">
                ลม {windSpeed} กม./ชม.
              </span>
            </div>
          )}
          {uvIndex !== undefined && (
            <div
              className={`flex items-center gap-1 rounded-lg p-2 ${
                uvIndex < 3
                  ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : uvIndex < 6
                  ? 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                  : uvIndex < 8
                  ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                  : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
              }`}
            >
              <span>☀️</span>
              <span>ดัชนี UV {uvIndex}</span>
            </div>
          )}
        </div>
      )}

      {/* Warnings */}
      {warnings && warnings.length > 0 && (
        <div className="mt-4 bg-red-500 text-white rounded-xl p-3">
          <div className="flex items-center gap-2 font-semibold">
            <span>⚠️</span>
            <span>คำเตือน</span>
          </div>
          <ul className="mt-2 space-y-1 text-sm list-disc list-inside">
            {warnings.map((warn, idx) => (
              <li key={idx}>{warn}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 5-day Forecast (hidden in compact) */}
      {forecast && forecast.length > 0 && !compact && (
        <div className="mt-5">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            พยากรณ์ 5 วัน
          </h4>
          <div
            className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {forecast.map((day, idx) => (
              <div
                key={idx}
                className="flex flex-col items-center min-w-[55px] bg-gray-50 dark:bg-gray-700 rounded-lg p-2 text-xs"
              >
                <span className="text-gray-600 dark:text-gray-300">
                  {day.day}
                </span>
                <span className="text-lg">{day.icon}</span>
                <span className="font-medium text-red-500">{day.high}°</span>
                <span className="text-blue-500">{day.low}°</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Updated timestamp */}
      {updatedAt && (
        <p className="mt-4 text-xs text-gray-400 dark:text-gray-500 text-right">
          อัปเดต: {updatedAt}
        </p>
      )}
    </div>
  );
};

export default MDESWeatherCard;