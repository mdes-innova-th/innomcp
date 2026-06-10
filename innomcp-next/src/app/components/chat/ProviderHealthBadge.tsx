'use client';

import React, { useState, useEffect, useCallback } from 'react';

type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

interface Provider {
  name: string;
  status: HealthStatus;
  latency: number; // milliseconds
}

interface ProviderHealthBadgeProps {
  className?: string;
  compact?: boolean;
}

const STATUS_COLORS: Record<HealthStatus, string> = {
  healthy: 'bg-green-500',
  degraded: 'bg-amber-500',
  down: 'bg-red-500',
  unknown: 'bg-gray-400',
};

const POLL_INTERVAL = 60_000; // 60 seconds

const ProviderHealthBadge: React.FC<ProviderHealthBadgeProps> = ({ className = '', compact = false }) => {
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const response = await fetch('/api/providers/health-check', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to fetch health');
      const data: Provider[] = await response.json();
      setProviders(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setProviders(null);
    }
  }, []);

  useEffect(() => {
    fetchHealth(); // initial fetch
    const intervalId = setInterval(fetchHealth, POLL_INTERVAL);
    return () => clearInterval(intervalId);
  }, [fetchHealth]);

  // Calculate counts
  const totalProviders = providers?.length ?? 0;
  const healthyCount = providers?.filter((p) => p.status === 'healthy').length ?? 0;
  const displayText = `${healthyCount}/${totalProviders} ผู้ให้บริการออนไลน์`;

  // Find the MDES provider (case-insensitive)
  const mdesProvider = providers?.find((p) => p.name.toLowerCase() === 'mdes');
  const otherProviders = providers?.filter((p) => p.name.toLowerCase() !== 'mdes') ?? [];

  // Generate dot for each provider
  const renderDot = (provider: Provider, isMDES: boolean) => {
    const dotColor = isMDES
      ? 'bg-indigo-500 animate-pulse'  // MDES always indigo + pulse
      : STATUS_COLORS[provider.status] ?? 'bg-gray-400';
    const latencyText = provider.latency != null ? ` ${provider.latency}ms` : '';
    const label = isMDES ? '🇹🇭 MDES' : provider.name;

    return (
      <div key={provider.name} className="group relative inline-flex items-center cursor-default">
        {/* The dot */}
        <span
          className={`inline-block w-2.5 h-2.5 rounded-full ${dotColor} ${isMDES ? 'ring-2 ring-indigo-300' : ''}`}
          title={undefined} // we will use custom tooltip, but keep accessibility
        />

        {/* Tooltip */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 whitespace-nowrap pointer-events-none">
          <div className="bg-gray-800 text-white text-xs rounded-md px-2 py-1 shadow-md">
            {label}
            {latencyText && <span className="ml-1 text-gray-300">({latencyText})</span>}
          </div>
          {/* Arrow */}
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800" />
        </div>
      </div>
    );
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {!compact && (
        <span className="text-sm text-gray-600 dark:text-gray-300">
          {error ? '⚠️ ไม่สามารถตรวจสอบสถานะ' : displayText}
        </span>
      )}

      <div className="flex items-center gap-1.5">
        {/* Always show MDES dot first */}
        {mdesProvider && renderDot(mdesProvider, true)}

        {/* Show other providers */}
        {otherProviders.map((provider) => renderDot(provider, false))}
      </div>
    </div>
  );
};

export default ProviderHealthBadge;