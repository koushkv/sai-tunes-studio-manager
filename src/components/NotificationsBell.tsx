import { useEffect, useMemo, useRef, useState } from 'react';
import { db, collection, onSnapshot, query, orderBy, limit } from '../lib/firebase';
import { Bell, CheckCheck } from 'lucide-react';
import type { AppNotification } from '../types';
import { NOTIFICATION_META, markNotificationRead } from '../lib/notifications';
import { formatRelative } from '../lib/format';

interface NotificationsBellProps {
  currentUserEmail: string;
  /** Jumps the app to the Projects tab when a project notification is clicked. */
  onOpenProjects: () => void;
}

/** Admin-only activity feed: everything students do across the studio. */
export default function NotificationsBell({ currentUserEmail, onOpenProjects }: NotificationsBellProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Newest 50 only — the feed is glanceable recent activity, not an archive.
    return onSnapshot(
      query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(50)),
      (snapshot) => {
        const list: AppNotification[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            type: data.type,
            title: data.title || '',
            body: data.body || '',
            actorName: data.actorName || '',
            actorEmail: data.actorEmail || '',
            entityType: data.entityType,
            entityId: data.entityId || '',
            createdAt: data.createdAt || '',
            readBy: data.readBy || [],
          });
        });
        setNotifications(list);
      },
      (err) => console.error('Notifications subscription error:', err),
    );
  }, []);

  const unread = useMemo(
    () => notifications.filter(n => !n.readBy.includes(currentUserEmail)),
    [notifications, currentUserEmail],
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleClick = (n: AppNotification) => {
    markNotificationRead(n.id, currentUserEmail);
    if (n.entityType === 'project') {
      onOpenProjects();
      setOpen(false);
    }
  };

  const markAllRead = () => {
    unread.forEach(n => markNotificationRead(n.id, currentUserEmail));
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={unread.length > 0 ? `Notifications, ${unread.length} unread` : 'Notifications'}
        className="relative p-1.5 rounded-full text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/[0.04] transition-colors cursor-pointer"
      >
        <Bell size={18} aria-hidden="true" />
        {unread.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#ff3b30] text-white text-[10px] font-semibold flex items-center justify-center tabular-nums">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-[min(360px,calc(100vw-2rem))] bg-white rounded-2xl shadow-xl ring-1 ring-black/5 overflow-hidden animate-sheet-in z-50"
        >
          <div className="px-4 py-3 border-b border-[#e8e8ed] flex items-center justify-between gap-3">
            <div>
              <p className="text-[14px] font-semibold text-[#1d1d1f]">Activity</p>
              <p className="text-[12px] text-[#86868b]">
                {unread.length > 0 ? `${unread.length} unread` : 'All caught up'}
              </p>
            </div>
            {unread.length > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-[12px] font-medium text-[#0071e3] hover:underline cursor-pointer shrink-0"
              >
                <CheckCheck size={13} aria-hidden="true" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[26rem] overflow-y-auto divide-y divide-[#e8e8ed]">
            {notifications.length === 0 ? (
              <p className="px-4 py-10 text-center text-[13px] text-[#86868b]">
                No activity yet. Student actions will show up here.
              </p>
            ) : (
              notifications.map(n => {
                const meta = NOTIFICATION_META[n.type] || NOTIFICATION_META.project_updated;
                const isUnread = !n.readBy.includes(currentUserEmail);
                return (
                  <button
                    key={n.id}
                    role="menuitem"
                    onClick={() => handleClick(n)}
                    className={`w-full text-left px-4 py-3 flex gap-2.5 hover:bg-[#f5f5f7] transition-colors cursor-pointer ${
                      isUnread ? 'bg-[#0071e3]/[0.03]' : ''
                    }`}
                  >
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${isUnread ? meta.dot : 'bg-transparent'}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={`text-[11px] font-semibold ${meta.tone}`}>{meta.label}</span>
                        <span className="text-[11px] text-[#86868b] shrink-0">{formatRelative(n.createdAt)}</span>
                      </span>
                      <span className={`block text-[13px] leading-snug mt-0.5 break-words ${isUnread ? 'text-[#1d1d1f] font-medium' : 'text-[#6e6e73]'}`}>
                        {n.title}
                      </span>
                      {n.body && (
                        <span className="block text-[12px] text-[#86868b] leading-snug mt-0.5 break-words">{n.body}</span>
                      )}
                      {n.actorName && (
                        <span className="block text-[11px] text-[#86868b] mt-1">by {n.actorName}</span>
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
