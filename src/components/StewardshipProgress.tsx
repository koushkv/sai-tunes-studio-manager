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
  composition:     { label: 'Composition',      icon: <Music size={13} />,          color: 'text-[#0071e3]' },
  recording:       { label: 'Recording',        icon: <Mic size={13} />,            color: 'text-[#ff3b30]' },
  mixing:          { label: 'Mixing',           icon: <Sliders size={13} />,        color: 'text-[#5856d6]' },
  practice:        { label: 'Practice',         icon: <Guitar size={13} />,         color: 'text-[#ff9f0a]' },
  maintenance:     { label: 'Maintenance',      icon: <Wrench size={13} />,         color: 'text-[#86868b]' },
  equipment_setup: { label: 'Equipment setup',  icon: <Monitor size={13} />,        color: 'text-[#32ade6]' },
  teaching:        { label: 'Teaching',         icon: <GraduationCap size={13} />,  color: 'text-[#34c759]' },
  performance:     { label: 'Performance',      icon: <Sparkles size={13} />,       color: 'text-[#ff9f0a]' },
};

const ROLE_STYLES: Record<UserRole, { bg: string; text: string; label: string }> = {
  admin:        { bg: 'bg-[#5856d6]/10', text: 'text-[#5856d6]', label: 'Admin' },
  junior_admin: { bg: 'bg-[#ff9f0a]/10', text: 'text-[#ff9f0a]', label: 'Junior admin' },
  member:       { bg: 'bg-[#34c759]/10', text: 'text-[#34c759]', label: 'Member' },
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
    const isTop3 = rank <= 3;
    return (
      <span
        className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold ${
          isTop3
            ? 'bg-[#0071e3]/10 text-[#0071e3]'
            : 'bg-[#f5f5f7] text-[#86868b]'
        }`}
      >
        {rank}
      </span>
    );
  };

  // ── Segmented bar for breakdown ───────────────────────────────────────────────
  const BreakdownBar = ({ breakdown, total }: { breakdown: Record<string, number>; total: number }) => {
    if (total === 0) return <div className="h-2.5 rounded-full bg-[#f5f5f7] w-full" />;
    const entries = Object.entries(breakdown).filter(([, v]) => v > 0);
    const SEGMENT_COLORS: Record<string, string> = {
      composition: 'bg-[#0071e3]', recording: 'bg-[#ff3b30]/70', mixing: 'bg-[#5856d6]/70',
      practice: 'bg-[#ff9f0a]/70', maintenance: 'bg-[#86868b]/50', equipment_setup: 'bg-[#32ade6]/70',
      teaching: 'bg-[#34c759]/70', performance: 'bg-[#ff9f0a]',
    };
    return (
      <div className="h-2.5 rounded-full overflow-hidden flex w-full bg-[#f5f5f7]">
        {entries.map(([type, pts]) => (
          <div
            key={type}
            className={`${SEGMENT_COLORS[type] || 'bg-[#86868b]/30'} transition-colors`}
            style={{ width: `${(pts / total) * 100}%` }}
            title={`${ACTIVITY_META[type]?.label ?? type}: ${pts} pts`}
          />
        ))}
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 font-sans text-[14px] text-[#1d1d1f]">
      {/* ── Header ──────────────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-[22px] font-bold text-[#1d1d1f]">Leaderboard</h2>
        <p className="text-[13px] text-[#86868b] mt-1">
          Track steward performance, log activities, and celebrate top contributors.
        </p>
      </div>

      {/* ── Statistics Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total activities', value: totalActivities, accent: 'text-[#34c759]' },
          { label: 'Total points', value: totalPoints.toLocaleString(), accent: 'text-[#0071e3]' },
          { label: 'Active stewards', value: activeStewards, accent: 'text-[#5856d6]' },
          { label: 'Top performer', value: topPerformer ? topPerformer.user.name : '—', accent: 'text-[#ff9f0a]' },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-2xl border border-[#e8e8ed] p-4">
            <p className="text-[12px] text-[#86868b] font-medium mb-1.5">{card.label}</p>
            <p className={`text-[17px] font-semibold ${card.accent} truncate`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* ── Empty state: no users ───────────────────────────────────────────────── */}
      {users.length === 0 && (
        <div className="text-center py-20">
          <p className="text-[14px] text-[#86868b]">
            No stewards yet. Add users from the admin panel to get started.
          </p>
        </div>
      )}

      {/* ── Main layout: leaderboard (left) + activity log (right) ──────────── */}
      {users.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* ── Leaderboard ──────────────────────────────────────────────────────── */}
          <div className="lg:col-span-7 space-y-3">
            <div className="bg-white rounded-2xl border border-[#e8e8ed] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#e8e8ed] flex items-center justify-between">
                <h3 className="text-[17px] font-semibold text-[#1d1d1f]">Rankings</h3>
                <span className="text-[12px] text-[#86868b]">{leaderboard.length} stewards</span>
              </div>

              <div className="divide-y divide-[#e8e8ed] max-h-[620px] overflow-y-auto">
                {leaderboard.map((entry, idx) => {
                  const rank = idx + 1;
                  const isExpanded = expandedUserId === entry.user.id;
                  const roleStyle = ROLE_STYLES[entry.user.role];

                  return (
                    <div key={entry.user.id}>
                      {/* ── Row ─────────────────────────────────────────────────── */}
                      <button
                        type="button"
                        onClick={() => setExpandedUserId(isExpanded ? null : entry.user.id)}
                        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-[#f5f5f7] transition-colors cursor-pointer text-left"
                      >
                        {/* Rank */}
                        <div className="flex-shrink-0 w-8 flex justify-center">{rankBadge(rank)}</div>

                        {/* Name + role */}
                        <div className="flex-1 min-w-0">
                          <span className="text-[14px] font-semibold text-[#1d1d1f] block truncate">{entry.user.name}</span>
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium mt-0.5 inline-block ${roleStyle.bg} ${roleStyle.text}`}>
                            {roleStyle.label}
                          </span>
                        </div>

                        {/* Points pill */}
                        <span className="flex-shrink-0 text-[12px] font-semibold px-2.5 py-1 rounded-full bg-[#34c759]/10 text-[#34c759]">
                          {entry.totalPoints} pts
                        </span>

                        {/* Points bar */}
                        <div className="hidden sm:block w-28 flex-shrink-0">
                          <div className="h-2 rounded-full bg-[#f5f5f7] overflow-hidden">
                            <div
                              className="h-full bg-[#34c759] transition-colors rounded-full"
                              style={{ width: `${(entry.totalPoints / maxPoints) * 100}%` }}
                            />
                          </div>
                        </div>

                        {/* Expand chevron */}
                        <div className="flex-shrink-0 text-[#86868b]">
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </button>

                      {/* ── Expanded profile ──────────────────────────────────── */}
                      <div
                        className={`overflow-hidden transition-all duration-300 ${
                          isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
                        }`}
                      >
                        <div className="px-5 pb-5 pt-3 bg-[#f5f5f7]/60 border-t border-[#e8e8ed] space-y-4">
                          {/* Profile info */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                              { label: 'Name', value: entry.user.name },
                              { label: 'Email', value: entry.user.email },
                              { label: 'Role', value: roleStyle.label },
                              { label: 'Joined', value: entry.user.addedAt ? new Date(entry.user.addedAt).toLocaleDateString() : '—' },
                            ].map((f) => (
                              <div key={f.label} className="bg-white rounded-xl border border-[#e8e8ed] p-3">
                                <span className="text-[11px] text-[#86868b] font-medium">{f.label}</span>
                                <p className="text-[13px] text-[#1d1d1f] font-medium mt-0.5 truncate">{f.value}</p>
                              </div>
                            ))}
                          </div>

                          {/* Breakdown bar */}
                          <div>
                            <span className="text-[12px] text-[#6e6e73] font-medium block mb-2">Points breakdown</span>
                            <BreakdownBar breakdown={entry.breakdown} total={entry.totalPoints} />
                            {entry.totalPoints > 0 && (
                              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2.5">
                                {Object.entries(entry.breakdown)
                                  .filter(([, v]) => v > 0)
                                  .sort(([, a], [, b]) => b - a)
                                  .map(([type, pts]) => {
                                    const meta = ACTIVITY_META[type];
                                    return (
                                      <span key={type} className={`text-[12px] flex items-center gap-1 ${meta?.color ?? 'text-[#86868b]'}`}>
                                        {meta?.icon} {meta?.label ?? type}: <strong>{pts}</strong>
                                      </span>
                                    );
                                  })}
                              </div>
                            )}
                          </div>

                          {/* Total activities count */}
                          <div className="flex items-center gap-2 text-[12px] text-[#6e6e73]">
                            <span className="font-medium">Total activities:</span>
                            <span className="text-[#1d1d1f] font-semibold">{entry.totalActivities}</span>
                          </div>

                          {/* Recent activities */}
                          <div>
                            <span className="text-[12px] text-[#6e6e73] font-medium block mb-2">Recent activities</span>
                            {entry.recentActivities.length === 0 ? (
                              <p className="text-[13px] text-[#86868b]">No activities logged yet.</p>
                            ) : (
                              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                {entry.recentActivities.map((a) => {
                                  const meta = ACTIVITY_META[a.activityType];
                                  return (
                                    <div key={a.id} className="flex items-start gap-2.5 p-2.5 bg-white rounded-xl border border-[#e8e8ed] text-[13px]">
                                      <span className={`mt-0.5 flex-shrink-0 ${meta?.color ?? 'text-[#86868b]'}`}>{meta?.icon ?? <Activity size={13} />}</span>
                                      <div className="flex-1 min-w-0">
                                        <span className="text-[#1d1d1f] font-medium">{a.description}</span>
                                        <span className="block text-[11px] text-[#86868b] mt-0.5">
                                          {new Date(a.loggedAt).toLocaleDateString()} · {new Date(a.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                      </div>
                                      <span className="flex-shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#34c759]/10 text-[#34c759]">
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
              <div className="bg-white rounded-2xl border border-[#e8e8ed] overflow-hidden">
                <div className="px-5 py-4 border-b border-[#e8e8ed]">
                  <h3 className="text-[17px] font-semibold text-[#1d1d1f]">Log activity</h3>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                  {/* User select */}
                  <div>
                    <label className="text-[13px] text-[#6e6e73] font-medium block mb-1.5">Steward</label>
                    <select
                      value={formUserId}
                      onChange={(e) => setFormUserId(e.target.value)}
                      required
                      className="w-full bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg px-3 py-2.5 text-[14px] text-[#1d1d1f] outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] transition-colors cursor-pointer"
                    >
                      <option value="">Select steward…</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.email}>{u.name} ({u.email})</option>
                      ))}
                    </select>
                  </div>

                  {/* Activity type */}
                  <div>
                    <label className="text-[13px] text-[#6e6e73] font-medium block mb-1.5">Activity type</label>
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value)}
                      required
                      className="w-full bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg px-3 py-2.5 text-[14px] text-[#1d1d1f] outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] transition-colors cursor-pointer"
                    >
                      {Object.entries(ACTIVITY_META).map(([key, meta]) => (
                        <option key={key} value={key}>{meta.label} (+{POINT_VALUES[key]} pts)</option>
                      ))}
                    </select>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-[13px] text-[#6e6e73] font-medium block mb-1.5">Description</label>
                    <textarea
                      value={formDesc}
                      onChange={(e) => setFormDesc(e.target.value)}
                      required
                      rows={3}
                      placeholder="Describe the activity…"
                      className="w-full bg-[#f5f5f7] border border-[#d2d2d7] rounded-lg px-3 py-2.5 text-[14px] text-[#1d1d1f] outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] transition-colors resize-none placeholder:text-[#86868b]"
                    />
                  </div>

                  {/* Points preview */}
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[#6e6e73] font-medium">Points awarded</span>
                    <span className="text-[17px] font-semibold text-[#34c759]">+{POINT_VALUES[formType] ?? 0}</span>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !formUserId || !formDesc.trim()}
                    className="w-full py-2.5 bg-[#0071e3] hover:bg-[#0077ED] disabled:bg-[#e8e8ed] disabled:text-[#86868b] text-white rounded-full text-[14px] font-medium cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus size={14} />
                    {submitting ? 'Logging…' : 'Log activity'}
                  </button>
                </form>
              </div>
            )}

            {/* ── Recent Activity Feed ──────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-[#e8e8ed] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#e8e8ed] flex items-center justify-between">
                <h3 className="text-[17px] font-semibold text-[#1d1d1f]">Recent activity</h3>
                <span className="text-[12px] text-[#86868b]">{Math.min(activities.length, 20)} latest</span>
              </div>

              <div className="divide-y divide-[#e8e8ed] max-h-[480px] overflow-y-auto">
                {activities.length === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-[14px] text-[#86868b]">No activities logged yet.</p>
                  </div>
                ) : (
                  activities.slice(0, 20).map((a) => {
                    const meta = ACTIVITY_META[a.activityType];
                    return (
                      <div key={a.id} className="px-5 py-3.5 flex items-start gap-3 hover:bg-[#f5f5f7] transition-colors">
                        <span className={`mt-0.5 flex-shrink-0 ${meta?.color ?? 'text-[#86868b]'}`}>
                          {meta?.icon ?? <Activity size={13} />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[14px] font-semibold text-[#1d1d1f] truncate">{a.userName}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-[#f5f5f7] text-[#6e6e73]">
                              {meta?.label ?? a.activityType}
                            </span>
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#34c759]/10 text-[#34c759]">
                              +{a.points}
                            </span>
                          </div>
                          <p className="text-[13px] text-[#6e6e73] mt-0.5 leading-relaxed truncate">{a.description}</p>
                          <span className="text-[11px] text-[#86868b] mt-0.5 block">
                            {new Date(a.loggedAt).toLocaleDateString()} · {new Date(a.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {a.loggedBy !== a.userId && (
                              <span className="ml-1 text-[#86868b]">· logged by {a.loggedBy}</span>
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
