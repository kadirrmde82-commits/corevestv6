import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Send, X } from 'lucide-react';
import BottomNav from './BottomNav';
import LanguageSelector from './LanguageSelector';
import { trpc } from '@/providers/trpc';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [selectedNotificationId, setSelectedNotificationId] = useState<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const lastRefreshAtRef = useRef(0);
  const utils = trpc.useUtils();
  const heartbeat = trpc.presence.heartbeat.useMutation();
  const { data: notifications = [] } = trpc.notification.list.useQuery(undefined, {
    refetchInterval: 15000,
    retry: false,
  });
  const markRead = trpc.notification.markRead.useMutation({
    onSuccess: () => {
      utils.notification.list.invalidate();
    },
  });
  const markAllRead = trpc.notification.markAllRead.useMutation({
    onSuccess: () => {
      utils.notification.list.invalidate();
    },
  });
  const clearAllNotifications = trpc.notification.clearAll.useMutation({
    onSuccess: () => {
      setSelectedNotificationId(null);
      utils.notification.list.invalidate();
    },
  });
  const unreadCount = notifications.filter((item) => !item.readAt).length;
  const selectedNotification = notifications.find((item) => item.id === selectedNotificationId) ?? null;

  const refreshAllUserData = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastRefreshAtRef.current < 1200) return;
    lastRefreshAtRef.current = now;
    try {
      await Promise.allSettled([
        utils.profile.me.invalidate(),
        utils.notification.list.invalidate(),
        utils.deposit.list.invalidate(),
        utils.withdrawal.list.invalidate(),
        utils.ticket.list.invalidate(),
        utils.wheel.status.invalidate(),
        utils.wheel.list.invalidate(),
        utils.click.status.invalidate(),
        utils.click.history.invalidate(),
        utils.referral.earningsList.invalidate(),
        utils.referral.overview.invalidate(),
      ]);
    } catch {
      // Silent refresh: users should not see refresh errors during background updates.
    }
  }, [utils]);

  useEffect(() => {
    const sendHeartbeat = () => {
      if (document.visibilityState === 'visible') {
        heartbeat.mutate({ path: window.location.hash || window.location.pathname });
        refreshAllUserData();
      }
    };
    sendHeartbeat();
    const interval = window.setInterval(sendHeartbeat, 30000);
    window.addEventListener('focus', sendHeartbeat);
    document.addEventListener('visibilitychange', sendHeartbeat);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', sendHeartbeat);
      document.removeEventListener('visibilitychange', sendHeartbeat);
    };
  }, [heartbeat, refreshAllUserData]);

  useEffect(() => {
    const handleTouchStart = (event: TouchEvent) => {
      if (window.scrollY <= 2) {
        touchStartYRef.current = event.touches[0]?.clientY ?? null;
      } else {
        touchStartYRef.current = null;
      }
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const startY = touchStartYRef.current;
      touchStartYRef.current = null;
      if (startY === null || window.scrollY > 8) return;
      const endY = event.changedTouches[0]?.clientY ?? startY;
      if (endY - startY > 70) {
        refreshAllUserData(true);
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [refreshAllUserData]);

  return (
    <div className="page-bg min-h-screen pb-24">
      {/* Topbar */}
      <div
        className="sticky top-0 z-20 flex items-center justify-between gap-4 px-4 py-3 mb-4"
        style={{
          background: 'rgba(5, 11, 20, 0.82)',
          backdropFilter: 'blur(18px)',
          borderBottom: '1px solid rgba(248,251,255,0.06)',
        }}
      >
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => navigate('/home')}
        >
          <img src="/logo-icon.png" alt="Corevest" className="w-9 h-9 rounded-lg" />
          <span className="text-base font-extrabold tracking-wide">
            <span className="text-white">CORE</span>
            <span style={{ color: '#FFD700' }}>VEST</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://t.me/corevestai"
            target="_blank"
            rel="noreferrer"
            className="grid place-items-center rounded-xl"
            style={{
              width: 38,
              height: 38,
              color: '#35d7ff',
              background: 'rgba(53,215,255,0.09)',
              border: '1px solid rgba(53,215,255,0.18)',
            }}
            aria-label="Telegram destek"
            title="Telegram"
          >
            <Send size={18} />
          </a>
          <button
            onClick={() => setNotificationsOpen(true)}
            className="relative grid place-items-center rounded-xl"
            style={{
              width: 38,
              height: 38,
              color: unreadCount > 0 ? '#FFD700' : '#8fa5b8',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(248,251,255,0.08)',
            }}
            aria-label="Bildirimler"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full grid place-items-center text-[10px] font-extrabold text-black" style={{ background: '#FFD700' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <LanguageSelector />
        </div>
      </div>

      {/* Content */}
      <div className="px-4" style={{ width: 'min(100%, 1180px)', margin: '0 auto' }}>
        {children}
      </div>

      {notificationsOpen && (
        <div className="fixed inset-0 z-50 grid place-items-start md:place-items-center p-4" style={{ background: 'rgba(0,0,0,0.62)' }}>
          <div className="glass-card w-full max-w-md mt-16 md:mt-0" style={{ maxHeight: '80vh', overflow: 'hidden' }}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="text-lg font-extrabold text-white">Bildirimler</h2>
                <p className="text-xs" style={{ color: '#8fa5b8' }}>{unreadCount} okunmamış bildirim</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {notifications.length > 0 && (
                  <button onClick={() => markAllRead.mutate()} className="text-xs font-bold" style={{ color: '#FFD700' }}>
                    Tümünü okundu yap
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={() => {
                      if (window.confirm('Tüm bildirimler silinsin mi?')) {
                        clearAllNotifications.mutate();
                      }
                    }}
                    className="text-xs font-bold"
                    style={{ color: '#ef4444' }}
                  >
                    Tümünü temizle
                  </button>
                )}
                <button onClick={() => setNotificationsOpen(false)} className="grid place-items-center rounded-xl" style={{ width: 34, height: 34, background: 'rgba(255,255,255,0.06)', color: '#fff' }}>
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="grid gap-2 overflow-y-auto pr-1" style={{ maxHeight: '62vh' }}>
              {notifications.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelectedNotificationId(item.id);
                    if (!item.readAt) markRead.mutate({ id: item.id });
                  }}
                  className="text-left rounded-xl px-4 py-3"
                  style={{
                    background: item.readAt ? 'rgba(255,255,255,0.03)' : 'rgba(255,215,0,0.10)',
                    border: item.readAt ? '1px solid rgba(248,251,255,0.06)' : '1px solid rgba(255,215,0,0.18)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-extrabold text-white">{item.title}</span>
                    {!item.readAt && <span className="w-2 h-2 rounded-full" style={{ background: '#FFD700' }} />}
                  </div>
                  <p className="text-xs mt-1 truncate" style={{ color: '#b8c7d6' }}>{item.message}</p>
                  <p className="text-[10px] mt-1 font-bold" style={{ color: '#FFD700' }}>Okumak için tıkla</p>
                  <p className="text-[10px] mt-2" style={{ color: '#5a6a7a' }}>{new Date(item.createdAt).toLocaleString('tr-TR')}</p>
                </button>
              ))}
              {notifications.length === 0 && (
                <p className="text-sm text-center py-10" style={{ color: '#5a6a7a' }}>Henüz bildirimin yok.</p>
              )}
            </div>
          </div>

          {selectedNotification && (
            <div className="absolute inset-0 z-10 grid place-items-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
              <div className="glass-card w-full max-w-sm animate-fade-in">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-lg font-extrabold text-white">{selectedNotification.title}</h3>
                    <p className="text-[10px] mt-1" style={{ color: '#5a6a7a' }}>{new Date(selectedNotification.createdAt).toLocaleString('tr-TR')}</p>
                  </div>
                  <button onClick={() => setSelectedNotificationId(null)} className="grid place-items-center rounded-xl" style={{ width: 34, height: 34, background: 'rgba(255,255,255,0.06)', color: '#fff' }}>
                    <X size={16} />
                  </button>
                </div>
                <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: '#c8d6e5' }}>{selectedNotification.message}</p>
                <button onClick={() => setSelectedNotificationId(null)} className="btn-primary w-full mt-4" style={{ minHeight: '42px' }}>
                  Tamam
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <BottomNav onTabPress={() => refreshAllUserData(true)} />
    </div>
  );
}
