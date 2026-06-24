import React, { useState, useEffect, useMemo } from 'react';
import {
  db, auth, collection, addDoc, onSnapshot, query, orderBy, where, limit,
} from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { AllowedUser, UserRole } from '../types';
import {
  Trophy, Star, Activity, TrendingUp, User, ChevronDown, ChevronUp, Plus,
  Music, Mic, Sliders, Guitar, Wrench, Monitor, GraduationCap, Sparkles,
  Calendar, Mail, Hash, BarChart3, Clock,
} from 'lucide-react';

// ── Point system ────────────────────────────────────────────────────────────────
const POINT_VALUES: Record<string, number> = {
  composition: 15,
  recording: 10,
  mixing: 12,
  practice: 5,
  maintenance: 8,
  equipment_setup: 7,
  teaching: 10,
  performance: 20,
};

const ACTIVITY_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  composition:     { label: 'COMPOSITION',      icon: <Music size={13} />,          color: 'text-sky-400' },
  recording:       { label: 'RECORDING',        icon: <Mic size={13} />,            color: 'text-rose-400' },
  mixing:          { label: 'MIXING',           icon: <Sliders size={13} />,        color: 'text-violet-400' },
  practice:        { label: 'PRACTICE',         icon: <Guitar size={13} />,         color: 'text-amber-400' },
  maintenance:     { label: 'MAINTENANCE',      icon: <Wrench size={13} />,         color: 'text-zinc-400' },
  equipment_setup: { label: 'EQUIPMENT SETUP',  icon: <Monitor size={13} />,        color: 'text-cyan-400' },
  teaching:        { label: 'TEACHING',         icon: <GraduationCap size={13} />,  color: 'text-emerald-400' },
  performance:     { label: 'PERFORMANCE',      icon: <Sparkles size={13} />,       color: 'text-yellow-400' },
};

const ROLE_STYLES: Record<UserRole, { bg: string; text: string; label: string }> = {
  admin:        { bg: 'bg-indigo-500/10 border-indigo-500/20', text: 'text-indigo-400', label: 'ADMIN' },
  junior_admin: { bg: 'bg-amber-500/10 border-amber-500/20',  text: 'text-amber-400',  label: 'JUNIOR ADMIN' },
  member:       { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400', label: 'MEMBER' },
};

// ── Firestore activity document shape ───────────────────────────────────────────
interface ActivityDoc {
  id: string;
  userId: string;
  userName: string;
  activityType: string;
  description: string;
  points: number;
  loggedBy: string;
  loggedAt: string;
}

// ── Per-user leaderboard entry ──────────────────────────────────────────────────
interface LeaderboardEntry {
  user: AllowedUser;
  totalPoints: number;
  totalActivities: number;
  breakdown: Record<string, number>; // activityType → accumulated points
  recentActivities: ActivityDoc[];
}

// ── Component ───────────────────────────────────────────────────────────────────
export default function StewardshipProgress() {
  const [users, setUsers] = useState<AllowedUser[]>([]);
  const [activities, setActivities] = useState<ActivityDoc[]>([]);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);

  // Activity-log form state
  const [formUserId, setFormUserId] = useState('');
  const [formType, setFormType] = useState('composition');
  const [formDesc, setFormDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── Auth listener ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setCurrentUserEmail(u?.email ?? null);
    });
    return unsub;
  }, []);

  // ── Firestore: allowed_users ──────────────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, 'allowed_users'), orderBy('name'));
    const unsub = onSnapshot(q, (snap) => {
      const list: AllowedUser[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as AllowedUser);
      });
      setUsers(list);
    }, (err) => console.error('allowed_users listener error:', err));
    return unsub;
  }, []);

  // ── Firestore: activity_log ───────────────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, 'activity_log'), orderBy('loggedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list: ActivityDoc[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as ActivityDoc);
      });
      setActivities(list);
    }, (err) => console.error('activity_log listener error:', err));
    return unsub;
  }, []);

  // ── Derive current user role ──────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUserEmail) { setCurrentUserRole(null); return; }
    const match = users.find((u) => u.email === currentUserEmail);
    setCurrentUserRole(match?.role ?? null);
  }, [currentUserEmail, users]);

  const canLog = currentUserRole === 'admin' || currentUserRole === 'junior_admin';

  // ── Leaderboard computation ───────────────────────────────────────────────────
  const leaderboard: LeaderboardEntry[] = useMemo(() => {
    const map = new Map<string, LeaderboardEntry>();

    users.forEach((u) => {
      map.set(u.email, {
        user: u,
        totalPoints: 0,
        totalActivities: 0,
        breakdown: {},
        recentActivities: [],
      });
    });

    activities.forEach((a) => {
      const entry = map.get(a.userId);
      if (!entry) return;
      entry.totalPoints += a.points;
      entry.totalActivities += 1;
      entry.breakdown[a.activityType] = (entry.breakdown[a.activityType] || 0) + a.points;
      if (entry.recentActivities.length < 10) {
        entry.recentActivities.push(a);
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalPoints - a.totalPoints);
  }, [users, activities]);

  // ── Statistics ─────────────────────────────────────────────────────────────────
  const totalActivities = activities.length;
  const totalPoints = activities.reduce((s, a) => s + a.points, 0);
  const activeStewards = users.length;
  const topPerformer = leaderboard.length > 0 ? leaderboard[0] : null;

  // ── Max points for bar scaling ────────────────────────────────────────────────
  const maxPoints = leaderboard.length > 0 ? Math.max(leaderboard[0].totalPoints, 1) : 1;

  // ── Submit activity ───────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUserId || !formType || !formDesc.trim() || !currentUserEmail) return;
    const targetUser = users.find((u) => u.email === formUserId);
    if (!targetUser) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'activity_log'), {
        userId: targetUser.email,
        userName: targetUser.name,
        activityType: formType,
        description: formDesc.trim(),
        points: POINT_VALUES[formType] ?? 0,
        loggedBy: currentUserEmail,
        loggedAt: new Date().toISOString(),
      });
      setFormDesc('');
    } catch (err) {
      console.error('Failed to log activity:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Rank badge helper ─────────────────────────────────────────────────────────
  const rankBadge = (rank: number) => {
    if (rank === 1) return <span className="text-lg leading-none">🥇</span>;
    if (rank === 2) return <span className="text-lg leading-none">🥈</span>;
    if (rank === 3) return <span className="text-lg leading-none">🥉</span>;
    return (
      <span className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-400 font-mono">
        {rank}
      </span>
    );
  };

  // ── Segmented bar for breakdown ───────────────────────────────────────────────
  const BreakdownBar = ({ breakdown, total }: { breakdown: Record<string, number>; total: number }) => {
    if (total === 0) return <div className="h-3 rounded-full bg-zinc-800 w-full" />;
    const entries = Object.entries(breakdown).filter(([, v]) => v > 0);
    const SEGMENT_COLORS: Record<string, string> = {
      composition: 'bg-sky-500', recording: 'bg-rose-500', mixing: 'bg-violet-500',
      practice: 'bg-amber-500', maintenance: 'bg-zinc-500', equipment_setup: 'bg-cyan-500',
      teaching: 'bg-emerald-500', performance: 'bg-yellow-500',
    };
    return (
      <div className="h-3 rounded-full overflow-hidden flex w-full bg-zinc-800">
        {entries.map(([type, pts]) => (
          <div
            key={type}
            className={`${SEGMENT_COLORS[type] || 'bg-zinc-600'} transition-all`}
            style={{ width: `${(pts / total) * 100}%` }}
            title={`${ACTIVITY_META[type]?.label ?? type}: ${pts} pts`}
          />
        ))}
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 font-sans text-sm text-zinc-300">
      {/* ── Header ──────────────────────────────────────────────────────────────── */}
      <div className="border-b border-zinc-800 pb-3">
        <h2 className="text-base font-semibold font-display text-zinc-100 flex items-center gap-2">
          <Trophy size={18} className="text-emerald-400" />
          🏆 STEWARDSHIP LEADERBOARD
        </h2>
        <p className="text-xs text-zinc-400 mt-1">
          Track steward performance, log activities, and celebrate top contributors.
        </p>
      </div>

      {/* ── Statistics Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'TOTAL ACTIVITIES', value: totalActivities, icon: <Activity size={14} className="text-emerald-400" />, accent: 'text-emerald-400' },
          { label: 'TOTAL POINTS', value: totalPoints.toLocaleString(), icon: <Star size={14} className="text-amber-400" />, accent: 'text-amber-400' },
          { label: 'ACTIVE STEWARDS', value: activeStewards, icon: <User size={14} className="text-sky-400" />, accent: 'text-sky-400' },
          { label: 'TOP PERFORMER', value: topPerformer ? topPerformer.user.name : '—', icon: <TrendingUp size={14} className="text-yellow-400" />, accent: 'text-yellow-400' },
        ].map((card) => (
          <div key={card.label} className="bg-zinc-900 border border-zinc-800/80 p-4 rounded-xl shadow-sm select-none">
            <h4 className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider flex items-center gap-1.5 mb-2">
              {card.icon} {card.label}
            </h4>
            <p className={`text-sm font-bold ${card.accent} truncate`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* ── Empty state: no users ───────────────────────────────────────────────── */}
      {users.length === 0 && (
        <div className="text-center py-16 bg-zinc-900 border border-zinc-800/80 rounded-xl">
          <User size={28} className="mx-auto mb-3 text-zinc-700" />
          <p className="text-xs text-zinc-500 uppercase tracking-wide font-semibold">
            No stewards yet. Admin can add users from the admin panel.
          </p>
        </div>
      )}

      {/* ── Main layout: leaderboard (left) + activity log (right) ──────────── */}
      {users.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* ── Leaderboard ──────────────────────────────────────────────────────── */}
          <div className="lg:col-span-7 space-y-3">
            <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-800 flex items-center gap-2">
                <BarChart3 size={14} className="text-emerald-400" />
                <h3 className="font-semibold text-zinc-200 text-xs uppercase tracking-wide font-display">
                  RANKED LEADERBOARD
                </h3>
                <span className="ml-auto text-[10px] text-zinc-500 font-mono">{leaderboard.length} STEWARDS</span>
              </div>

              <div className="divide-y divide-zinc-800/60 max-h-[620px] overflow-y-auto">
                {leaderboard.map((entry, idx) => {
                  const rank = idx + 1;
                  const isExpanded = expandedUserId === entry.user.id;
                  const roleStyle = ROLE_STYLES[entry.user.role];

                  return (
                    <div key={entry.user.id} className="group">
                      {/* ── Row ─────────────────────────────────────────────────── */}
                      <button
                        type="button"
                        onClick={() => setExpandedUserId(isExpanded ? null : entry.user.id)}
                        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-zinc-800/40 transition-all cursor-pointer text-left"
                      >
                        {/* Rank */}
                        <div className="flex-shrink-0 w-8 flex justify-center">{rankBadge(rank)}</div>

                        {/* Name + role */}
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-semibold text-zinc-100 block truncate">{entry.user.name}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-semibold uppercase tracking-wider mt-0.5 inline-block ${roleStyle.bg} ${roleStyle.text}`}>
                            {roleStyle.label}
                          </span>
                        </div>

                        {/* Points pill */}
                        <span className="flex-shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono">
                          {entry.totalPoints} PTS
                        </span>

                        {/* Points bar */}
                        <div className="hidden sm:block w-28 flex-shrink-0">
                          <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 transition-all rounded-full"
                              style={{ width: `${(entry.totalPoints / maxPoints) * 100}%` }}
                            />
                          </div>
                        </div>

                        {/* Expand chevron */}
                        <div className="flex-shrink-0 text-zinc-500">
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </button>

                      {/* ── Expanded profile ──────────────────────────────────── */}
                      <div
                        className={`overflow-hidden transition-all duration-300 ${
                          isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
                        }`}
                      >
                        <div className="px-5 pb-5 pt-2 bg-zinc-950/40 border-t border-zinc-800/40 space-y-4">
                          {/* Profile info */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                              { icon: <User size={12} />, label: 'NAME', value: entry.user.name },
                              { icon: <Mail size={12} />, label: 'EMAIL', value: entry.user.email },
                              { icon: <Hash size={12} />, label: 'ROLE', value: roleStyle.label },
                              { icon: <Calendar size={12} />, label: 'JOINED', value: entry.user.addedAt ? new Date(entry.user.addedAt).toLocaleDateString() : '—' },
                            ].map((f) => (
                              <div key={f.label} className="bg-zinc-900 border border-zinc-800/60 rounded-lg p-2.5">
                                <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold flex items-center gap-1">
                                  {f.icon} {f.label}
                                </span>
                                <p className="text-[11px] text-zinc-200 font-medium mt-1 truncate">{f.value}</p>
                              </div>
                            ))}
                          </div>

                          {/* Breakdown bar */}
                          <div>
                            <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold block mb-1.5">POINTS BREAKDOWN</span>
                            <BreakdownBar breakdown={entry.breakdown} total={entry.totalPoints} />
                            {entry.totalPoints > 0 && (
                              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                                {Object.entries(entry.breakdown)
                                  .filter(([, v]) => v > 0)
                                  .sort(([, a], [, b]) => b - a)
                                  .map(([type, pts]) => {
                                    const meta = ACTIVITY_META[type];
                                    return (
                                      <span key={type} className={`text-[10px] flex items-center gap-1 ${meta?.color ?? 'text-zinc-400'}`}>
                                        {meta?.icon} {meta?.label ?? type}: <strong className="font-mono">{pts}</strong>
                                      </span>
                                    );
                                  })}
                              </div>
                            )}
                          </div>

                          {/* Total activities count */}
                          <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                            <Activity size={12} />
                            <span className="uppercase tracking-wider font-semibold">TOTAL ACTIVITIES:</span>
                            <span className="font-mono text-zinc-200 font-bold">{entry.totalActivities}</span>
                          </div>

                          {/* Recent activities */}
                          <div>
                            <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold block mb-2">RECENT ACTIVITIES</span>
                            {entry.recentActivities.length === 0 ? (
                              <p className="text-[11px] text-zinc-600 italic">No activities logged yet.</p>
                            ) : (
                              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                {entry.recentActivities.map((a) => {
                                  const meta = ACTIVITY_META[a.activityType];
                                  return (
                                    <div key={a.id} className="flex items-start gap-2 p-2 bg-zinc-900 border border-zinc-800/50 rounded-lg text-[11px]">
                                      <span className={`mt-0.5 flex-shrink-0 ${meta?.color ?? 'text-zinc-400'}`}>{meta?.icon ?? <Activity size={13} />}</span>
                                      <div className="flex-1 min-w-0">
                                        <span className="text-zinc-200 font-medium">{a.description}</span>
                                        <span className="block text-[9px] text-zinc-500 mt-0.5">
                                          {new Date(a.loggedAt).toLocaleDateString()} · {new Date(a.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                      </div>
                                      <span className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono">
                                        +{a.points}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Right panel: Log form + recent feed ──────────────────────────────── */}
          <div className="lg:col-span-5 space-y-5">
            {/* ── Activity Log Form (admin / junior_admin only) ──────────────── */}
            {canLog && (
              <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-zinc-800 flex items-center gap-2">
                  <Plus size={14} className="text-emerald-400" />
                  <h3 className="font-semibold text-zinc-200 text-xs uppercase tracking-wide font-display">
                    LOG ACTIVITY
                  </h3>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                  {/* User select */}
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold block mb-1">STEWARD</label>
                    <select
                      value={formUserId}
                      onChange={(e) => setFormUserId(e.target.value)}
                      required
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500/50 transition-colors cursor-pointer"
                    >
                      <option value="">SELECT STEWARD...</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.email}>{u.name} ({u.email})</option>
                      ))}
                    </select>
                  </div>

                  {/* Activity type */}
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold block mb-1">ACTIVITY TYPE</label>
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value)}
                      required
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500/50 transition-colors cursor-pointer"
                    >
                      {Object.entries(ACTIVITY_META).map(([key, meta]) => (
                        <option key={key} value={key}>{meta.label} (+{POINT_VALUES[key]} PTS)</option>
                      ))}
                    </select>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold block mb-1">DESCRIPTION</label>
                    <textarea
                      value={formDesc}
                      onChange={(e) => setFormDesc(e.target.value)}
                      required
                      rows={3}
                      placeholder="Describe the activity..."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500/50 transition-colors resize-none placeholder:text-zinc-600"
                    />
                  </div>

                  {/* Points preview */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold flex items-center gap-1">
                      <Star size={11} className="text-amber-400" /> POINTS AWARDED
                    </span>
                    <span className="text-sm font-bold font-mono text-emerald-400">+{POINT_VALUES[formType] ?? 0}</span>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !formUserId || !formDesc.trim()}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-100 rounded-lg text-[10px] font-semibold uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center gap-1.5"
                  >
                    <Plus size={12} />
                    {submitting ? 'LOGGING...' : 'LOG ACTIVITY'}
                  </button>
                </form>
              </div>
            )}

            {/* ── Recent Activity Feed ──────────────────────────────────────────── */}
            <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-800 flex items-center gap-2">
                <Clock size={14} className="text-zinc-400" />
                <h3 className="font-semibold text-zinc-200 text-xs uppercase tracking-wide font-display">
                  RECENT ACTIVITY FEED
                </h3>
                <span className="ml-auto text-[10px] text-zinc-500 font-mono">{Math.min(activities.length, 20)} LATEST</span>
              </div>

              <div className="divide-y divide-zinc-800/40 max-h-[480px] overflow-y-auto">
                {activities.length === 0 ? (
                  <div className="text-center py-16">
                    <Activity size={24} className="mx-auto mb-2 text-zinc-800" />
                    <p className="text-[11px] text-zinc-500 uppercase tracking-wide font-semibold">No activities logged yet.</p>
                  </div>
                ) : (
                  activities.slice(0, 20).map((a) => {
                    const meta = ACTIVITY_META[a.activityType];
                    return (
                      <div key={a.id} className="px-5 py-3 flex items-start gap-3 hover:bg-zinc-800/20 transition-colors">
                        <span className={`mt-0.5 flex-shrink-0 ${meta?.color ?? 'text-zinc-400'}`}>
                          {meta?.icon ?? <Activity size={13} />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-zinc-200 truncate">{a.userName}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-semibold uppercase tracking-wider ${
                              meta ? 'bg-zinc-800 border-zinc-700/60 text-zinc-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                            }`}>
                              {meta?.label ?? a.activityType}
                            </span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono">
                              +{a.points}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed truncate">{a.description}</p>
                          <span className="text-[9px] text-zinc-600 mt-0.5 block">
                            {new Date(a.loggedAt).toLocaleDateString()} · {new Date(a.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {a.loggedBy !== a.userId && (
                              <span className="ml-1 text-zinc-600">· logged by {a.loggedBy}</span>
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
