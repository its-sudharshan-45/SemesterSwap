import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotificationsQuery, useMarkNotificationReadMutation, useMarkAllNotificationsReadMutation } from '../hooks/useNotifications';
import { Card } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Skeleton from '../components/ui/Skeleton';
import { Bell, MessageSquare, Tag, CheckCircle, Eye } from 'lucide-react';
import { showToast } from '../components/ui/Toast';

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [now] = useState(() => Date.now());
  
  // Load and persist active tab using localStorage
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>(() => {
    try {
      const saved = localStorage.getItem('notifications_active_tab');
      return (saved === 'all' || saved === 'unread') ? saved : 'all';
    } catch (e) {
      return 'all';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('notifications_active_tab', activeTab);
    } catch (e) {}
  }, [activeTab]);

  const { data: notifications = [], isLoading, isError, refetch } = useNotificationsQuery();
  const readMutation = useMarkNotificationReadMutation();
  const readAllMutation = useMarkAllNotificationsReadMutation();

  // Track locally read notification IDs to enable optimistic updates and persistence across reloads
  const [localReadIds, setLocalReadIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('local_read_notification_ids');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Sync state with localStorage and dispatch event for cross-component sync (e.g. Navbar badge)
  const updateLocalReadIds = (newIds: string[]) => {
    setLocalReadIds(newIds);
    try {
      localStorage.setItem('local_read_notification_ids', JSON.stringify(newIds));
    } catch (e) {}
    window.dispatchEvent(new Event('local-read-ids-updated'));
  };

  // Sync backend read status with local storage read status on load/update
  useEffect(() => {
    if (notifications.length > 0) {
      const backendReadIds = notifications.filter(n => n.is_read).map(n => n.id);
      const merged = Array.from(new Set([...localReadIds, ...backendReadIds]));
      
      // Clean up old IDs that are no longer in the notifications list to keep storage size small
      const currentIds = notifications.map(n => n.id);
      const cleaned = merged.filter(id => currentIds.includes(id));
      
      // Check if we actually need to update the state to prevent infinite rendering loops
      const hasChanges = cleaned.length !== localReadIds.length || cleaned.some((val, idx) => val !== localReadIds[idx]);
      if (hasChanges) {
        updateLocalReadIds(cleaned);
      }
    }
  }, [notifications]);

  // Accessibility screen reader announcement region state
  const [announcement, setAnnouncement] = useState<string>('');

  // Watch for new incoming notifications to announce them to screen readers
  const prevCountRef = React.useRef(notifications.filter((n) => n.type.toLowerCase() !== 'message').length);
  useEffect(() => {
    const allowed = notifications.filter((n) => n.type.toLowerCase() !== 'message');
    if (allowed.length > prevCountRef.current) {
      const newItems = allowed.filter(n => !n.is_read && !localReadIds.includes(n.id));
      if (newItems.length > 0) {
        setAnnouncement(`New notification arrived: ${newItems[0].title}. ${newItems[0].message}`);
      }
    }
    prevCountRef.current = allowed.length;
  }, [notifications, localReadIds]);

  const isNotificationRead = (notif: any) => notif.is_read || localReadIds.includes(notif.id);

  const handleMarkRead = async (id: string) => {
    const notif = notifications.find(n => n.id === id);
    if (notif) {
      setAnnouncement(`Notification "${notif.title}" marked as read.`);
    }

    // Optimistic local update
    if (!localReadIds.includes(id)) {
      updateLocalReadIds([...localReadIds, id]);
    }

    try {
      await readMutation.mutateAsync(id);
    } catch (err) {
      console.error('Failed to mark notification as read on server:', err);
    }
  };

  const handleMarkAllRead = async () => {
    const allowed = notifications.filter((n) => n.type.toLowerCase() !== 'message');
    const unread = allowed.filter(n => !isNotificationRead(n));
    if (unread.length === 0) {
      showToast('No unread notifications.', 'info');
      return;
    }

    setAnnouncement('All notifications marked as read.');
    
    // Optimistic local update
    const unreadIds = unread.map(n => n.id);
    updateLocalReadIds(Array.from(new Set([...localReadIds, ...unreadIds])));

    try {
      await readAllMutation.mutateAsync();
      showToast('All notifications marked as read.', 'success');
    } catch (err) {
      showToast('Error marking notifications as read.', 'error');
      // Revert optimistic updates if server action failed
      refetch();
    }
  };

  const formatDistanceToNow = (dateString: string) => {
    const date = new Date(dateString);
    const diff = now - date.getTime();
    
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getNotificationIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'message':
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400 border border-blue-100/30">
            <MessageSquare className="h-5 w-5" />
          </div>
        );
      case 'interest':
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400 border border-brand-100/30">
            <Tag className="h-5 w-5" />
          </div>
        );
      case 'sold_status_alert':
      case 'sold':
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100/30">
            <CheckCircle className="h-5 w-5" />
          </div>
        );
      default:
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-100/30">
            <Bell className="h-5 w-5" />
          </div>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white text-left">Notifications</h1>
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, idx) => (
            <Skeleton key={idx} variant="rectangular" className="h-20 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-20 text-center max-w-md mx-auto space-y-5 animate-fade-in text-left">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/20 border border-red-200/50">
          <Bell className="h-6 w-6 text-red-500" />
        </div>
        <div className="text-center">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Failed to load alerts</h3>
          <p className="text-slate-500 text-sm mt-1">There was an issue fetching your alerts. Please check your connection and try again.</p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={() => refetch()} variant="primary" className="font-semibold">
            Retry
          </Button>
          <Button onClick={() => navigate('/marketplace')} variant="outline" className="font-semibold">
            Back to Marketplace
          </Button>
        </div>
      </div>
    );
  }

  // Filter out message notifications completely from display
  const allowedNotifications = notifications.filter((n) => n.type.toLowerCase() !== 'message');
  
  const displayNotifications = activeTab === 'all'
    ? allowedNotifications
    : allowedNotifications.filter((n) => !isNotificationRead(n));

  const unreadAllowedCount = allowedNotifications.filter((n) => !isNotificationRead(n)).length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto text-left animate-fade-in pb-12">
      
      {/* Live Region for Screen Readers */}
      <div 
        aria-live="polite" 
        className="sr-only"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: '0',
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: '0',
        }}
      >
        {announcement}
      </div>

      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Notifications</h1>
          <p className="text-slate-500 text-sm mt-1">Updates on swap requests, item interest, and saved items status</p>
        </div>
        {allowedNotifications.length > 0 && (
          <Button
            onClick={handleMarkAllRead}
            variant="outline"
            size="sm"
            className="font-bold flex items-center gap-1.5 border-slate-200 text-slate-600 dark:border-darkbg-border dark:text-slate-350"
          >
            <Eye className="h-4 w-4" />
            <span>Mark all read</span>
          </Button>
        )}
      </div>

      {/* Tabs / Modules */}
      <div className="flex border-b border-slate-200/60 dark:border-darkbg-border/60">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors relative ${
            activeTab === 'all'
              ? 'border-brand-500 text-brand-500'
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          <span>All messages ({allowedNotifications.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('unread')}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors relative ${
            activeTab === 'unread'
              ? 'border-brand-500 text-brand-500'
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          <span>Unread messages ({unreadAllowedCount})</span>
          {unreadAllowedCount > 0 && (
            <span className="absolute top-2.5 right-1.5 flex h-1.5 w-1.5 rounded-full bg-brand-500" />
          )}
        </button>
      </div>

      {displayNotifications.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto space-y-5 bg-white/50 dark:bg-darkbg-body/50 border border-slate-200/50 dark:border-darkbg-border/60 rounded-3xl mt-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 dark:bg-darkbg-border/30 text-slate-400 border border-slate-200/20 shadow-inner">
            <Bell className="h-8 w-8 stroke-[1.5]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">All caught up!</h3>
            <p className="text-slate-400 text-sm mt-1 max-w-xs mx-auto">
              {activeTab === 'all'
                ? "You will receive alerts here when people show interest in your listings or when swap requests status change."
                : "No unread notifications in this view."}
            </p>
          </div>
          <Button onClick={() => navigate('/marketplace')} variant="secondary" className="font-semibold">
            Explore Listings
          </Button>
        </Card>
      ) : (
        <div className="space-y-3.5 mt-6">
          {displayNotifications.map((notif) => {
            const isRead = isNotificationRead(notif);
            return (
              <Card
                key={notif.id}
                onClick={() => handleMarkRead(notif.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleMarkRead(notif.id);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`Notification: ${notif.title}. ${notif.message}. Status: ${isRead ? 'read' : 'unread'}`}
                className={`border transition-all p-4 rounded-2xl flex items-start gap-4 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/40 hover:bg-slate-50/50 dark:hover:bg-darkbg-card/50 ${
                  isRead
                    ? 'bg-white/40 dark:bg-darkbg-card/10 border-slate-100 dark:border-darkbg-border/30 shadow-none'
                    : 'bg-white dark:bg-darkbg-card/40 border-brand-100 dark:border-brand-950/20 shadow-sm'
                }`}
              >
                {getNotificationIcon(notif.type)}

                <div className="flex-1 space-y-0.5 text-left">
                  <div className="flex items-center justify-between gap-4">
                    <h4 className={`text-sm ${isRead ? 'font-semibold text-slate-700 dark:text-slate-300' : 'font-extrabold text-slate-900 dark:text-white'}`}>
                      {notif.title}
                    </h4>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 whitespace-nowrap">
                      {formatDistanceToNow(notif.created_at)}
                    </span>
                  </div>
                  <p className={`text-xs leading-relaxed ${isRead ? 'text-slate-500 dark:text-slate-400' : 'text-slate-600 dark:text-slate-200'}`}>
                    {notif.message}
                  </p>
                </div>

                {!isRead && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Avoid double triggers
                      handleMarkRead(notif.id);
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-brand-500 hover:bg-slate-50 dark:hover:bg-darkbg-border/30 active:scale-90 transition-all self-center"
                    title="Mark as read"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
