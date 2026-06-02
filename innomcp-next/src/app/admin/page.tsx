'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import Link from 'next/link';
import AgentLeaderboard from '@/app/components/chat/AgentLeaderboard';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface UserRow {
  user_id: number;
  user_dispname: string;
  user_email: string;
  userrole_id: number;
  user_active: number;
  created_at: string;
}

interface FeedbackStats {
  total: number;
  up: number;
  down: number;
  last7Days: { date: string; rating: 'up' | 'down'; count: number }[];
  error?: string;
}

interface HealthData {
  status: string;
  uptime: number;
  version: string;
  mode: string;
  mode_ready: boolean;
  ai_mode: string;
  mcp_status: string;
  redis_status: string;
  redis_ready: boolean;
  total_tools: number;
  local_tools: number;
  remote_tools: number;
  memory: { rss: number; heapUsed: number; heapTotal: number; external: number };
  timestamp: string;
}

interface StatsData {
  tasks: { status: string; count: number }[];
  feedback: { avg_rating: number | null; total: number };
  agents: { active: number; standby: number; total: number };
  agentActivity: { agentId: string; activations: number; lastActive: string }[];
}

interface SessionRow {
  jti: string;
  userId: number;
  email: string;
  loginAt: string;
  lastSeen: string;
  userAgent: string;
  ip: string;
}

interface AuditLogRow {
  id: number;
  timestamp: string;
  adminEmail: string;
  action: string;
  targetId: string | number | null;
  details: string | null;
}

type Tab = 'overview' | 'users' | 'sessions' | 'providers' | 'logs' | 'mother';

// ─── Mother Tab Types ───────────────────────────────────────────────────────────

interface MotherProviderBreakdown {
  providerId: string;
  totalCalls: number;
  successes: number;
  avgLatencyMs: number;
  successRate: number;
}

interface MotherStatsData {
  totalRuns: number;
  totalProviderCalls: number;
  avgSuccessRate: number;
  lastRunAt: string | null;
  providerBreakdown: MotherProviderBreakdown[];
  avgProvidersPerRun: number;
  recentIterations: number;
  winLeader?: string;   // providerId of current win leader
  totalWins?: number;   // total wins across all providers
}

interface MotherProbeResult {
  providerId: string;
  status: 'online' | 'offline' | 'configured' | 'checking';
  latencyMs: number;
  checkedAt: string;
}

interface MotherHistoryRun {
  totalEstimatedCostUsd?: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<number, string> = { 0: 'Admin', 1: 'Moderator', 2: 'User' };

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview',  label: 'Overview' },
  { id: 'users',     label: 'Users' },
  { id: 'sessions',  label: 'Sessions' },
  { id: 'providers', label: 'Providers' },
  { id: 'logs',      label: 'Logs & Stats' },
  { id: 'mother',    label: 'Mother' },
];

function fmtBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fmtUptime(sec: number) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const { isLoggedIn, isAuthLoading, userRoleId } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Users tab state
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // System tab state
  const [health, setHealth] = useState<HealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  // Sessions tab state
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [revokeMsg, setRevokeMsg] = useState('');
  const [revokeError, setRevokeError] = useState('');

  // Audit log state (loaded alongside sessions tab)
  const [auditLog, setAuditLog] = useState<AuditLogRow[]>([]);
  const [auditLogLoading, setAuditLogLoading] = useState(false);
  const [auditLogEndpointMissing, setAuditLogEndpointMissing] = useState(false);

  // Logs tab state
  const [stats, setStats] = useState<StatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Mother tab state
  const [motherStats, setMotherStats] = useState<MotherStatsData | null>(null);
  const [motherStatsLoading, setMotherStatsLoading] = useState(false);
  const [motherProbe, setMotherProbe] = useState<MotherProbeResult[]>([]);
  const [motherProbeLoading, setMotherProbeLoading] = useState(false);
  const [motherCostTotal, setMotherCostTotal] = useState<number | null>(null);
  const [motherHistoryLoading, setMotherHistoryLoading] = useState(false);
  const [winnerRanked, setWinnerRanked] = useState<Array<{providerId: string; wins: number; requests: number; successRate: number}>>([]);

  // ── Auth guard ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthLoading) {
      if (!isLoggedIn || userRoleId !== 0) {
        router.push('/');
      }
    }
  }, [isAuthLoading, isLoggedIn, userRoleId, router]);

  // ── Data fetchers ─────────────────────────────────────────────────────────────

  // Users
  useEffect(() => {
    if (!isLoggedIn || userRoleId !== 0) return;
    fetch('/api/admin/users', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success) setUsers(d.data);
        else setError(d.error || 'Failed to load users');
      })
      .catch(() => setError('Network error'))
      .finally(() => setUsersLoading(false));
  }, [isLoggedIn, userRoleId]);

  // Feedback stats
  useEffect(() => {
    if (!isLoggedIn || userRoleId !== 0) return;
    fetch('/api/admin/feedback/stats', { credentials: 'include', cache: 'no-store' })
      .then(r => r.json())
      .then((d: FeedbackStats) => setFeedbackStats(d))
      .catch(() => null);
  }, [isLoggedIn, userRoleId]);

  // System health — fetch on tab switch (overview tab)
  useEffect(() => {
    if (activeTab !== 'overview' || !isLoggedIn || userRoleId !== 0) return;
    setHealthLoading(true);
    fetch('/api/health?detailed=true', { credentials: 'include' })
      .then(r => r.json())
      .then((d: HealthData) => setHealth(d))
      .catch(() => null)
      .finally(() => setHealthLoading(false));
  }, [activeTab, isLoggedIn, userRoleId]);

  // Sessions — fetch on tab switch
  useEffect(() => {
    if (activeTab !== 'sessions' || !isLoggedIn || userRoleId !== 0) return;
    setSessionsLoading(true);
    setRevokeMsg(''); setRevokeError('');
    fetch('/api/admin/sessions', { credentials: 'include' })
      .then(r => r.json())
      .then((d: { success: boolean; data?: SessionRow[]; error?: string }) => {
        if (d.success && d.data) setSessions(d.data);
        else setRevokeError(d.error || 'Failed to load sessions');
      })
      .catch(() => setRevokeError('Network error'))
      .finally(() => setSessionsLoading(false));
  }, [activeTab, isLoggedIn, userRoleId]);

  // Audit log — fetch when sessions tab is active
  useEffect(() => {
    if (activeTab !== 'sessions' || !isLoggedIn || userRoleId !== 0) return;
    setAuditLogLoading(true);
    setAuditLogEndpointMissing(false);
    fetch('/api/admin/audit-log?limit=20', { credentials: 'include' })
      .then(async r => {
        if (r.status === 404) { setAuditLogEndpointMissing(true); return null; }
        const d = await r.json();
        if (d.success && Array.isArray(d.data)) setAuditLog(d.data);
        else setAuditLogEndpointMissing(true);
        return d;
      })
      .catch(() => setAuditLogEndpointMissing(true))
      .finally(() => setAuditLogLoading(false));
  }, [activeTab, isLoggedIn, userRoleId]);

  // Stats / logs — fetch on tab switch
  useEffect(() => {
    if (activeTab !== 'logs' || !isLoggedIn || userRoleId !== 0) return;
    setStatsLoading(true);
    fetch('/api/stats', { credentials: 'include' })
      .then(r => r.json())
      .then((d: StatsData) => setStats(d))
      .catch(() => null)
      .finally(() => setStatsLoading(false));
  }, [activeTab, isLoggedIn, userRoleId]);

  // Mother tab — fetch stats, probe, and history cost on tab switch
  useEffect(() => {
    if (activeTab !== 'mother' || !isLoggedIn || userRoleId !== 0) return;
    fetchMotherData();
  }, [activeTab, isLoggedIn, userRoleId]);

  // ── Actions ───────────────────────────────────────────────────────────────────

  function fetchMotherData() {
    // Stats
    setMotherStatsLoading(true);
    fetch('/api/mother/stats', { credentials: 'include' })
      .then(r => r.json())
      .then((d: MotherStatsData) => {
        setMotherStats(d);
        // Also fetch win leader
        fetch('/api/mother/winner', { credentials: 'include' })
          .then(r => r.ok ? r.json() : null)
          .then(wd => {
            if (wd?.winner) {
              setMotherStats(prev => prev ? { ...prev, winLeader: wd.winner.providerId, totalWins: wd.totalWins } : prev);
            }
            setWinnerRanked(wd?.ranked ?? []);
          })
          .catch(() => {});
      })
      .catch(() => null)
      .finally(() => setMotherStatsLoading(false));

    // Probe (triggers a fresh probe run)
    setMotherProbeLoading(true);
    fetch('/api/agent-leaderboard/probe', { credentials: 'include' })
      .then(r => r.json())
      .then((d: { results: MotherProbeResult[]; timestamp: string }) => {
        setMotherProbe(d.results ?? []);
      })
      .catch(() => null)
      .finally(() => setMotherProbeLoading(false));

    // History — compute cost client-side
    setMotherHistoryLoading(true);
    fetch('/api/mother/history?limit=50', { credentials: 'include' })
      .then(r => r.json())
      .then((d: { runs: MotherHistoryRun[] }) => {
        const total = (d.runs ?? []).reduce(
          (sum, run) => sum + (run.totalEstimatedCostUsd ?? 0),
          0
        );
        setMotherCostTotal(total);
      })
      .catch(() => null)
      .finally(() => setMotherHistoryLoading(false));
  }

  async function changeRole(userId: number, roleId: number) {
    setSuccessMsg(''); setError('');
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
    } catch { setError('Network error'); }
  }

  async function toggleActive(userId: number, active: boolean) {
    setSuccessMsg(''); setError('');
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
    } catch { setError('Network error'); }
  }

  async function revokeSession(jti: string) {
    setRevokeMsg(''); setRevokeError('');
    try {
      const r = await fetch(`/api/admin/sessions/${encodeURIComponent(jti)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const d = await r.json();
      if (d.success) {
        setSessions(prev => prev.filter(s => s.jti !== jti));
        setRevokeMsg(`Session ${jti.slice(0, 8)}… revoked`);
      } else {
        setRevokeError(d.error || 'Revoke failed');
      }
    } catch { setRevokeError('Network error'); }
  }

  async function revokeAllForUser(userId: number) {
    setRevokeMsg(''); setRevokeError('');
    try {
      const r = await fetch(`/api/admin/sessions/user/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const d = await r.json();
      if (d.success) {
        setSessions(prev => prev.filter(s => s.userId !== userId));
        setRevokeMsg(`All sessions for user ${userId} revoked`);
      } else {
        setRevokeError(d.error || 'Revoke failed');
      }
    } catch { setRevokeError('Network error'); }
  }

  // ── Early return ──────────────────────────────────────────────────────────────

  if (isAuthLoading || !isLoggedIn || userRoleId !== 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400">Loading…</p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Panel</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">INNOMCP system administration</p>
          </div>
          <Link href="/" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            Back to chat
          </Link>
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

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setError(''); setSuccessMsg(''); }}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-gray-800 border border-b-white dark:border-gray-700 dark:border-b-gray-800 text-blue-600 dark:text-blue-400 -mb-px border-gray-200'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ─── Users Tab ──────────────────────────────────────────────────────── */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* Users table */}
            <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h2 className="font-semibold text-gray-800 dark:text-gray-100">
                  Users ({users.length})
                </h2>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  Role 0 = Admin · 1 = Moderator · 2 = User
                </span>
              </div>
              {usersLoading ? (
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
                      {users.map(u => (
                        <tr key={u.user_id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                          <td className="px-4 py-3 text-gray-400 dark:text-gray-500 font-mono">{u.user_id}</td>
                          <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{u.user_dispname}</td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{u.user_email}</td>
                          <td className="px-4 py-3">
                            <select
                              value={u.userrole_id}
                              onChange={e => changeRole(u.user_id, parseInt(e.target.value, 10))}
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
              <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                  <h2 className="font-semibold text-gray-800 dark:text-gray-100">Feedback Insights</h2>
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
                          <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">Up</p>
                          <p className="text-2xl font-bold text-green-700 dark:text-green-300">{feedbackStats.up}</p>
                        </div>
                        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3 border border-red-100 dark:border-red-800">
                          <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Down</p>
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
                                  <td className="px-2 py-2 text-xs">
                                    {row.rating === 'up' ? 'up' : 'down'}
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
          </div>
        )}

        {/* ─── Overview Tab ───────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h2 className="font-semibold text-gray-800 dark:text-gray-100">System Health</h2>
                <button
                  onClick={() => {
                    setHealthLoading(true);
                    fetch('/api/health?detailed=true', { credentials: 'include' })
                      .then(r => r.json())
                      .then((d: HealthData) => setHealth(d))
                      .catch(() => null)
                      .finally(() => setHealthLoading(false));
                  }}
                  className="text-xs px-3 py-1 rounded border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  Refresh
                </button>
              </div>

              {healthLoading ? (
                <div className="p-8 text-center text-gray-400">Fetching system health…</div>
              ) : health ? (
                <div className="p-5 space-y-5">
                  {/* Status banner */}
                  <div className={`rounded-lg px-4 py-3 text-sm font-medium ${
                    health.status === 'healthy'
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                      : health.status === 'degraded'
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                  }`}>
                    Status: <span className="uppercase font-bold">{health.status}</span>
                    <span className="ml-3 font-normal opacity-70">
                      as of {new Date(health.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  {/* Key metric cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {[
                      { label: 'Uptime',      value: fmtUptime(health.uptime) },
                      { label: 'Version',     value: health.version },
                      { label: 'Mode',        value: health.mode },
                      { label: 'AI Mode',     value: health.ai_mode },
                      { label: 'MCP Status',  value: health.mcp_status },
                      { label: 'Redis',       value: health.redis_status },
                      { label: 'Total Tools', value: String(health.total_tools ?? 0) },
                      { label: 'Local / Remote', value: `${health.local_tools ?? 0} / ${health.remote_tools ?? 0}` },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3 border border-gray-100 dark:border-gray-600">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</p>
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Memory */}
                  {health.memory && (
                    <div>
                      <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                        Node.js Memory
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { label: 'RSS',        value: fmtBytes(health.memory.rss) },
                          { label: 'Heap Used',  value: fmtBytes(health.memory.heapUsed) },
                          { label: 'Heap Total', value: fmtBytes(health.memory.heapTotal) },
                          { label: 'External',   value: fmtBytes(health.memory.external) },
                        ].map(({ label, value }) => (
                          <div key={label} className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3 border border-gray-100 dark:border-gray-600">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</p>
                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-400">
                  Health data unavailable. Click Refresh to try again.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Sessions Tab ───────────────────────────────────────────────────── */}
        {activeTab === 'sessions' && (
          <div className="space-y-4">
            {revokeError && (
              <div className="rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 p-3 text-sm text-red-700 dark:text-red-300">
                {revokeError}
              </div>
            )}
            {revokeMsg && (
              <div className="rounded-lg bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 p-3 text-sm text-green-700 dark:text-green-300">
                {revokeMsg}
              </div>
            )}
            <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h2 className="font-semibold text-gray-800 dark:text-gray-100">
                  Active Sessions ({sessions.length})
                </h2>
                <button
                  onClick={() => {
                    setSessionsLoading(true);
                    setRevokeMsg(''); setRevokeError('');
                    fetch('/api/admin/sessions', { credentials: 'include' })
                      .then(r => r.json())
                      .then((d: { success: boolean; data?: SessionRow[]; error?: string }) => {
                        if (d.success && d.data) setSessions(d.data);
                        else setRevokeError(d.error || 'Failed to load sessions');
                      })
                      .catch(() => setRevokeError('Network error'))
                      .finally(() => setSessionsLoading(false));
                  }}
                  className="text-xs px-3 py-1 rounded border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  Refresh
                </button>
              </div>
              {sessionsLoading ? (
                <div className="p-8 text-center text-gray-400">Loading sessions…</div>
              ) : sessions.length === 0 ? (
                <div className="p-8 text-center text-gray-400">No active sessions found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-700/50 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        <th className="px-4 py-3">JTI</th>
                        <th className="px-4 py-3">User ID</th>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Login At</th>
                        <th className="px-4 py-3">Last Seen</th>
                        <th className="px-4 py-3">IP</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {sessions.map(s => (
                        <tr key={s.jti} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                            {s.jti.slice(0, 8)}…
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300 font-mono">{s.userId}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{s.email}</td>
                          <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                            {new Date(s.loginAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                            {new Date(s.lastSeen).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 font-mono">{s.ip}</td>
                          <td className="px-4 py-3 text-right flex gap-2 justify-end">
                            <button
                              onClick={() => revokeSession(s.jti)}
                              className="text-xs px-3 py-1 rounded font-medium bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-300 transition-colors"
                            >
                              Revoke
                            </button>
                            <button
                              onClick={() => revokeAllForUser(s.userId)}
                              className="text-xs px-3 py-1 rounded font-medium bg-orange-100 hover:bg-orange-200 text-orange-700 dark:bg-orange-900/30 dark:hover:bg-orange-900/50 dark:text-orange-300 transition-colors"
                              title={`Revoke all sessions for user ${s.userId}`}
                            >
                              All
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── Audit Log sub-section ────────────────────────────────────────── */}
            <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h2 className="font-semibold text-gray-800 dark:text-gray-100">Recent Admin Actions</h2>
                <button
                  onClick={() => {
                    setAuditLogLoading(true);
                    setAuditLogEndpointMissing(false);
                    fetch('/api/admin/audit-log?limit=20', { credentials: 'include' })
                      .then(async r => {
                        if (r.status === 404) { setAuditLogEndpointMissing(true); return null; }
                        const d = await r.json();
                        if (d.success && Array.isArray(d.data)) setAuditLog(d.data);
                        else setAuditLogEndpointMissing(true);
                        return d;
                      })
                      .catch(() => setAuditLogEndpointMissing(true))
                      .finally(() => setAuditLogLoading(false));
                  }}
                  className="text-xs px-3 py-1 rounded border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  Refresh
                </button>
              </div>

              {auditLogLoading ? (
                <div className="p-8 text-center text-gray-400">Loading audit log…</div>
              ) : auditLogEndpointMissing ? (
                <div className="p-6">
                  <div className="rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-700 dark:text-amber-300">
                    <p className="font-semibold mb-1">Audit log endpoint not yet configured</p>
                    <p className="font-mono text-xs">Wire <span className="font-bold">GET /api/admin/audit-log</span> in the backend to enable this section.</p>
                  </div>
                </div>
              ) : auditLog.length === 0 ? (
                <div className="p-8 text-center text-gray-400">No audit log entries found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-700/50 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        <th className="px-4 py-3">Timestamp</th>
                        <th className="px-4 py-3">Admin</th>
                        <th className="px-4 py-3">Action</th>
                        <th className="px-4 py-3">Target ID</th>
                        <th className="px-4 py-3">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {auditLog.map(row => (
                        <tr key={row.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                          <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap font-mono">
                            {new Date(row.timestamp).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-xs">{row.adminEmail}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                              {row.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 font-mono">
                            {row.targetId ?? '–'}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 max-w-xs truncate" title={row.details ?? ''}>
                            {row.details ?? '–'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Providers Tab ──────────────────────────────────────────────────── */}
        {activeTab === 'providers' && (
          <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="font-semibold text-gray-800 dark:text-gray-100">Agent Leaderboard</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Live provider and model status across the INNOMCP ecosystem
              </p>
            </div>
            <div className="p-5">
              <AgentLeaderboard />
            </div>
          </div>
        )}

        {/* ─── Logs & Stats Tab ───────────────────────────────────────────────── */}
        {activeTab === 'logs' && (
          <div className="space-y-6">
            <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h2 className="font-semibold text-gray-800 dark:text-gray-100">System Stats</h2>
                <button
                  onClick={() => {
                    setStatsLoading(true);
                    fetch('/api/stats', { credentials: 'include' })
                      .then(r => r.json())
                      .then((d: StatsData) => setStats(d))
                      .catch(() => null)
                      .finally(() => setStatsLoading(false));
                  }}
                  className="text-xs px-3 py-1 rounded border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  Refresh
                </button>
              </div>

              {statsLoading ? (
                <div className="p-8 text-center text-gray-400">Loading stats…</div>
              ) : stats ? (
                <div className="p-5 space-y-5">
                  {/* Agent summary */}
                  <div>
                    <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                      Agent Pool
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Active',  value: stats.agents.active,  cls: 'text-green-700 dark:text-green-400' },
                        { label: 'Standby', value: stats.agents.standby, cls: 'text-yellow-700 dark:text-yellow-400' },
                        { label: 'Total',   value: stats.agents.total,   cls: 'text-gray-800 dark:text-gray-100' },
                      ].map(({ label, value, cls }) => (
                        <div key={label} className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3 border border-gray-100 dark:border-gray-600">
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</p>
                          <p className={`text-2xl font-bold ${cls}`}>{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Task status breakdown */}
                  {stats.tasks.length > 0 && (
                    <div>
                      <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                        Task Status Breakdown
                      </h3>
                      <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-700">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 dark:bg-gray-700/50 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                              <th className="px-4 py-2">Status</th>
                              <th className="px-4 py-2 text-right">Count</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {stats.tasks.map(t => (
                              <tr key={t.status} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                                <td className="px-4 py-2 font-mono text-xs text-gray-600 dark:text-gray-300">{t.status}</td>
                                <td className="px-4 py-2 text-right font-semibold text-gray-800 dark:text-gray-100">{t.count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Feedback summary */}
                  <div>
                    <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                      Feedback Summary
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3 border border-gray-100 dark:border-gray-600">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Total Feedback</p>
                        <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{stats.feedback.total}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3 border border-gray-100 dark:border-gray-600">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Avg Rating</p>
                        <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                          {stats.feedback.avg_rating != null
                            ? Number(stats.feedback.avg_rating).toFixed(2)
                            : '–'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Agent activity (last 7 days) */}
                  {stats.agentActivity.length > 0 && (
                    <div>
                      <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                        Agent Activity (Last 7 Days)
                      </h3>
                      <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-700">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 dark:bg-gray-700/50 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                              <th className="px-4 py-2">Agent ID</th>
                              <th className="px-4 py-2 text-right">Activations</th>
                              <th className="px-4 py-2 text-right">Last Active</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {stats.agentActivity.slice(0, 20).map(a => (
                              <tr key={a.agentId} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                                <td className="px-4 py-2 font-mono text-xs text-gray-600 dark:text-gray-300">{a.agentId}</td>
                                <td className="px-4 py-2 text-right font-semibold text-gray-800 dark:text-gray-100">{a.activations}</td>
                                <td className="px-4 py-2 text-right text-xs text-gray-400 dark:text-gray-500">
                                  {a.lastActive ? new Date(a.lastActive).toLocaleString() : '–'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-400">
                  Stats unavailable. Click Refresh to try again.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Mother Tab ─────────────────────────────────────────────────────── */}
        {activeTab === 'mother' && (
          <div className="space-y-6">

            {/* Header with Refresh */}
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 dark:text-gray-100">Mother Dispatch Monitor</h2>
              <button
                onClick={() => fetchMotherData()}
                className="text-xs px-3 py-1 rounded border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                Refresh
              </button>
            </div>

            {/* ── Summary Row ─────────────────────────────────────────────────── */}
            <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">Summary</h3>
              </div>
              {motherStatsLoading ? (
                <div className="p-8 text-center text-gray-400">Loading stats…</div>
              ) : motherStats ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 p-4">
                  {[
                    { label: 'Total Runs',          value: String(motherStats.totalRuns) },
                    { label: 'Total Provider Calls', value: String(motherStats.totalProviderCalls) },
                    { label: 'Avg Success Rate',     value: `${motherStats.avgSuccessRate}%` },
                    { label: 'Last Run At',          value: motherStats.lastRunAt ? new Date(motherStats.lastRunAt).toLocaleString() : '–' },
                    { label: 'Avg Agents/Run',       value: String(motherStats.avgProvidersPerRun ?? 0) },
                    { label: 'Recent (5 min)',        value: String(motherStats.recentIterations ?? 0) },
                    { label: 'Win Leader',           value: motherStats.winLeader ?? '—' },
                    { label: 'Total Wins',           value: String(motherStats.totalWins ?? 0) },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3 border border-gray-100 dark:border-gray-600">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</p>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-400">No data. Click Refresh to try again.</div>
              )}
            </div>

            {/* ── Provider Breakdown Table ─────────────────────────────────────── */}
            <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center">
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">Provider Breakdown</h3>
                <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full px-2 py-0.5 font-medium">14 providers</span>
              </div>
              {motherStatsLoading ? (
                <div className="p-8 text-center text-gray-400">Loading…</div>
              ) : motherStats && motherStats.providerBreakdown.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-700/50 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        <th className="px-4 py-3">Provider ID</th>
                        <th className="px-4 py-3 text-right">Total Calls</th>
                        <th className="px-4 py-3 text-right">Successes</th>
                        <th className="px-4 py-3 text-right">Avg Latency</th>
                        <th className="px-4 py-3 text-right">Success Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {motherStats.providerBreakdown.map(p => (
                        <tr key={p.providerId} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{p.providerId}</td>
                          <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{p.totalCalls}</td>
                          <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{p.successes}</td>
                          <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{p.avgLatencyMs} ms</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              p.successRate >= 80
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : p.successRate >= 50
                                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                              {p.successRate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-gray-400">No provider breakdown data yet.</div>
              )}
            </div>

            {/* ── Win Rankings Table ──────────────────────────────────────────────── */}
            {winnerRanked.length > 0 && (
              <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">Win Rankings</h3>
                  <span className="ml-2 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-full px-2 py-0.5 font-medium">🏆 {winnerRanked.length} providers</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-700/50 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Provider</th>
                        <th className="px-4 py-3 text-right">Wins</th>
                        <th className="px-4 py-3 text-right">Requests</th>
                        <th className="px-4 py-3 text-right">Success%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {winnerRanked.map((p, i) => (
                        <tr key={p.providerId} className={`hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors ${i === 0 ? 'bg-yellow-50/30 dark:bg-yellow-900/10' : ''}`}>
                          <td className="px-4 py-3 text-xs text-gray-500">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}`}</td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{p.providerId}</td>
                          <td className="px-4 py-3 text-right font-semibold text-yellow-600 dark:text-yellow-400">{p.wins}</td>
                          <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{p.requests}</td>
                          <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{p.successRate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Circuit State ────────────────────────────────────────────────── */}
            <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">Circuit State</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Live probe results from <span className="font-mono">GET /api/agent-leaderboard/probe</span>
                </p>
              </div>
              {motherProbeLoading ? (
                <div className="p-8 text-center text-gray-400">Probing providers…</div>
              ) : motherProbe.length > 0 ? (
                <div className="p-4 flex flex-wrap gap-3">
                  {motherProbe.map(p => {
                    const badgeCls =
                      p.status === 'online'     ? 'bg-green-100  text-green-700  dark:bg-green-900/30  dark:text-green-400' :
                      p.status === 'offline'    ? 'bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-400'   :
                      p.status === 'configured' ? 'bg-blue-100   text-blue-700   dark:bg-blue-900/30   dark:text-blue-400'  :
                                                  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
                    return (
                      <div key={p.providerId} className="flex flex-col items-start rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40 px-3 py-2 min-w-[140px]">
                        <span className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate max-w-[160px]">{p.providerId}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeCls}`}>
                            {p.status}
                          </span>
                          {p.status === 'online' && (
                            <span className="text-xs text-gray-400 dark:text-gray-500">{p.latencyMs} ms</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-400">No probe results yet. Click Refresh to run a probe.</div>
              )}
            </div>

            {/* ── Cost Summary ─────────────────────────────────────────────────── */}
            <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">Cost Summary</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Estimated total cost across last 50 history runs (computed client-side)
                </p>
              </div>
              <div className="p-4">
                {motherHistoryLoading ? (
                  <div className="text-center text-gray-400 text-sm py-4">Loading history…</div>
                ) : motherCostTotal !== null ? (
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-4 border border-gray-100 dark:border-gray-600 inline-block">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Total Estimated Cost</p>
                    <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                      ${motherCostTotal.toFixed(6)}&nbsp;<span className="text-sm font-normal text-gray-400">USD</span>
                    </p>
                  </div>
                ) : (
                  <div className="text-center text-gray-400 text-sm py-4">No cost data available.</div>
                )}
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
