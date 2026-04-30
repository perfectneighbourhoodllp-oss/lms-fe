import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { notificationService } from '../services/leadService';

const TYPE_ICON = {
  'lead.assigned': '🆕',
  'lead.remark': '💬',
  'lead.followUp': '⏰',
};

const fmtAgo = (d) => {
  if (!d) return '';
  const ms = Date.now() - new Date(d).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  // Poll unread count every 30s
  const { data: countData } = useQuery({
    queryKey: ['notif-count'],
    queryFn: notificationService.unreadCount,
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
  });
  const unread = countData?.count ?? 0;

  // Load full list only when dropdown open
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationService.list({}),
    enabled: open,
    refetchInterval: open ? 30_000 : false,
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => notificationService.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notif-count'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: notificationService.markAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notif-count'] });
    },
  });

  // Close on click outside
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleClick = (n) => {
    if (!n.isRead) markReadMutation.mutate(n._id);
    setOpen(false);
    if (n.relatedLead?._id) {
      navigate(`/leads?focus=${n.relatedLead._id}`);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Notifications"
      >
        <span className="text-lg">🔔</span>
        {unread > 0 && (
          <span className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="font-semibold text-sm text-gray-800">
              Notifications
              {unread > 0 && <span className="ml-2 text-xs text-gray-500">({unread} unread)</span>}
            </p>
            {unread > 0 && (
              <button
                onClick={() => markAllMutation.mutate()}
                className="text-xs text-blue-600 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-12 text-center text-gray-400 text-sm">
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n._id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors ${
                    !n.isRead ? 'bg-blue-50/60' : ''
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-base flex-shrink-0">{TYPE_ICON[n.type] || '•'}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!n.isRead ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                        {n.title}
                      </p>
                      {n.message && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1">{fmtAgo(n.createdAt)}</p>
                    </div>
                    {!n.isRead && (
                      <span className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
