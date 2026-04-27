'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import Link from 'next/link';

interface UserRow {
  user_id: number;
  user_dispname: string;
  user_email: string;
  userrole_id: number;
  user_active: number;
  created_at: string;
}

interface MetricsData {
  timestamp: string;
  tools: Record<string, { count: number; p50?: number; p95?: number }>;
  endpoints: Record<string, { count: number; p50?: number; p95?: number }>;
}

interface FeedbackStats {
  total: number;
  up: number;
  down: number;
  last7Days: { date: string; rating: 'up' | 'down'; count: number }[];
  error?: string;
}

const ROLE_LABELS: Record<number, string> = { 0: 'Admin', 1: 'Moderator', 2: 'User' };

export default function AdminPage() {
  const router = useRouter();
  const { isLoggedIn, isAuthLoading, userRoleId } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats | null>(null);

  // Redirect if not admin
  useEffect(() => {
    if (!isAuthLoading) {
      if (!isLoggedIn || userRoleId !== 0) {
        router.push('/');
      }
    }
  }, [isAuthLoading, isLoggedIn, userRoleId, router]);

  // Fetch user list
  useEffect(() => {
    if (!isLoggedIn || userRoleId !== 0) return;
    fetch('/api/admin/users', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success) setUsers(d.data);
        else setError(d.error || 'Failed to load users');
      })
      .catch(() => setError('Network error'))
      .finally(() => setLoading(false));
  }, [isLoggedIn, userRoleId]);

  // Fetch metrics
  useEffect(() => {
    if (!isLoggedIn || userRoleId !== 0) return;
    fetch('/api/admin/metrics', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setMetrics(d.data); })
      .catch(() => null);
  }, [isLoggedIn, userRoleId]);

  // Fetch feedback stats
  useEffect(() => {
    if (!isLoggedIn || userRoleId !== 0) return;
    fetch('/api/admin/feedback/stats', { credentials: 'include', cache: 'no-store' })
      .then(r => r.json())
      .then((d: FeedbackStats) => setFeedbackStats(d))
      .catch(() => null);
  }, [isLoggedIn, userRoleId]);

  async function changeRole(userId: number, roleId: number) {
    setSuccessMsg('');
    setError('');
    try {
      const r = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId }),
      });
      const d = await r.json();
      if (d.success) {
        setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, userrole_id: roleId } : u));
        setSuccessMsg(`Role updated for user ${userId}`);
      } else {
        setError(d.error || 'Update failed');
      }
    } catch {
      setError('Network error');
    }
  }

  async function toggleActive(userId: number, active: boolean) {
    setSuccessMsg('');
    setError('');
    try {
      const r = await fetch(`/api/admin/users/${userId}/active`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      });
      const d = await r.json();
      if (d.success) {
        setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, user_active: active ? 1 : 0 } : u));
        setSuccessMsg(`User ${userId} ${active ? 'activated' : 'deactivated'}`);
      } else {
        setError(d.error || 'Update failed');
      }
    } catch {
      setError('Network error');
    }
  }

  if (isAuthLoading || !isLoggedIn || userRoleId !== 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">👑 Admin Panel</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage users and roles</p>
          </div>
          <Link href="/" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">← Back to chat</Link>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mb-4 rounded-lg bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 p-3 text-sm text-green-700 dark:text-green-300">
            {successMsg}
          </div>
        )}

        {/* Users Table */}
        <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-800 dark:text-gray-100">Users ({users.length})</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading users…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Joined</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {users.map((u) => (
                    <tr key={u.user_id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-4 py-3 text-gray-400 dark:text-gray-500 font-mono">{u.user_id}</td>
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{u.user_dispname}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{u.user_email}</td>
                      <td className="px-4 py-3">
                        <select
                          value={u.userrole_id}
                          onChange={(e) => changeRole(u.user_id, parseInt(e.target.value, 10))}
                          className="rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        >
                          {Object.entries(ROLE_LABELS).map(([id, label]) => (
                            <option key={id} value={id}>{label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.user_active
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {u.user_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 dark:text-gray-500 text-xs">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => toggleActive(u.user_id, !u.user_active)}
                          className={`text-xs px-3 py-1 rounded font-medium transition-colors ${
                            u.user_active
                              ? 'bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-300'
                              : 'bg-green-100 hover:bg-green-200 text-green-700 dark:bg-green-900/30 dark:hover:bg-green-900/50 dark:text-green-300'
                          }`}
                        >
                          {u.user_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Feedback Insights */}
        {feedbackStats && (
          <div className="mt-6 rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="font-semibold text-gray-800 dark:text-gray-100">💬 Feedback Insights</h2>
            </div>
            <div className="p-4">
              {feedbackStats.error ? (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Stats unavailable ({feedbackStats.error})
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3 border border-gray-100 dark:border-gray-600">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Total</p>
                      <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{feedbackStats.total}</p>
                    </div>
                    <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-3 border border-green-100 dark:border-green-800">
                      <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">👍 Up</p>
                      <p className="text-2xl font-bold text-green-700 dark:text-green-300">{feedbackStats.up}</p>
                    </div>
                    <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3 border border-red-100 dark:border-red-800">
                      <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">👎 Down</p>
                      <p className="text-2xl font-bold text-red-700 dark:text-red-300">{feedbackStats.down}</p>
                    </div>
                  </div>
                  {feedbackStats.last7Days.length > 0 && (
                    <div>
                      <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                        Last 7 Days
                      </h3>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                            <th className="px-2 py-2">Date</th>
                            <th className="px-2 py-2">Rating</th>
                            <th className="px-2 py-2 text-right">Count</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {feedbackStats.last7Days.map((row, i) => (
                            <tr key={`${row.date}-${row.rating}-${i}`}>
                              <td className="px-2 py-2 text-gray-600 dark:text-gray-300 font-mono text-xs">{row.date}</td>
                              <td className="px-2 py-2">
                                {row.rating === 'up' ? '👍 up' : '👎 down'}
                              </td>
                              <td className="px-2 py-2 text-right font-medium text-gray-800 dark:text-gray-200">{row.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Tool Usage Metrics */}
        {metrics && (
          <div className="mt-6 rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 dark:text-gray-100">📊 Tool Usage Metrics</h2>
              <span className="text-xs text-gray-400 dark:text-gray-500">as of {new Date(metrics.timestamp).toLocaleTimeString()}</span>
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {Object.entries(metrics.tools).length === 0 ? (
                <p className="col-span-4 text-sm text-gray-400 dark:text-gray-500 text-center py-4">No tool metrics yet</p>
              ) : (
                Object.entries(metrics.tools)
                  .sort(([, a], [, b]) => (b.count || 0) - (a.count || 0))
                  .map(([tool, stats]) => (
                    <div key={tool} className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3 border border-gray-100 dark:border-gray-600">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate mb-1">{tool}</p>
                      <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{stats.count ?? 0}</p>
                      {stats.p50 !== undefined && (
                        <p className="text-xs text-gray-400 mt-1">p50: {Math.round(stats.p50)}ms</p>
                      )}
                    </div>
                  ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
