'use client';
import React from 'react';

type Status = 'online' | 'offline' | 'degraded' | 'unknown';

interface StatusBadgeProps {
  status: Status;
  label?: string;
}

const colors: Record<Status, string> = {
  online:   'bg-green-100 text-green-800',
  offline:  'bg-red-100 text-red-800',
  degraded: 'bg-yellow-100 text-yellow-800',
  unknown:  'bg-gray-100 text-gray-600',
};

const dots: Record<Status, string> = {
  online:   'bg-green-500',
  offline:  'bg-red-500',
  degraded: 'bg-yellow-500',
  unknown:  'bg-gray-400',
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => (
  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${colors[status]}`}>
    <span className={`h-1.5 w-1.5 rounded-full ${dots[status]}`} />
    {label ?? status}
  </span>
);

export default StatusBadge;
