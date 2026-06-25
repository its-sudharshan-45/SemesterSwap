import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Sun, Moon, LogOut, User as UserIcon, PlusCircle, Tags, Store, Bookmark, MessageSquare, Bell, ShoppingBag } from 'lucide-react';
import Button from '../ui/Button';
import { useConversationsQuery } from '../../hooks/useChat';
import { useNotificationsQuery } from '../../hooks/useNotifications';
import logo from '../../assets/Logo.png';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(!darkMode);

  // Queries for message & notification badge counts
  const { data: conversations = [] } = useConversationsQuery();
  const { data: notifications = [] } = useNotificationsQuery();

  const [localReadIds, setLocalReadIds] = useState<string[]>([]);

  useEffect(() => {
    const loadReadIds = () => {
      try {
        const saved = localStorage.getItem('local_read_notification_ids');
        setLocalReadIds(saved ? JSON.parse(saved) : []);
      } catch (e) {}
    };
    loadReadIds();
    window.addEventListener('storage', loadReadIds);
    window.addEventListener('local-read-ids-updated', loadReadIds);
    return () => {
      window.removeEventListener('storage', loadReadIds);
      window.removeEventListener('local-read-ids-updated', loadReadIds);
    };
  }, []);

  const unreadMessagesCount = conversations.reduce((acc, conv) => acc + (conv.unread_count || 0), 0);
  const unreadNotificationsCount = notifications.filter(
    (n) => !n.is_read && !localReadIds.includes(n.id) && n.type.toLowerCase() !== 'message'
  ).length;
  const unreadOrdersCount = notifications.filter(
    (n) =>
      !n.is_read &&
      !localReadIds.includes(n.id) &&
      [
        'new_request',
        'request_accepted',
        'request_rejected',
        'request_expired',
        'meeting_cancelled',
        'meeting_reminder',
        'transaction_completed',
      ].includes(n.type.toLowerCase())
  ).length;

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-slate-200/50 bg-white/80 backdrop-blur-md dark:border-darkbg-border/60 dark:bg-darkbg-body/80 transition-colors duration-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo & Desktop Nav Links */}
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5 group">
              <img 
                src={logo} 
                alt="SemesterSwap Logo" 
                className="h-9 w-9 object-contain rounded-xl group-hover:scale-105 transition-transform duration-200"
              />
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                Semester<span className="text-brand-500">Swap</span>
              </span>
            </Link>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center gap-5">
              <Link
                to="/marketplace"
                className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-brand-500 dark:text-slate-300 dark:hover:text-brand-500 transition-colors"
              >
                <Store className="h-4 w-4" />
                <span>Marketplace</span>
              </Link>
              {user && (
                <>
                  <Link
                    to="/sell"
                    className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-brand-500 dark:text-slate-300 dark:hover:text-brand-500 transition-colors"
                  >
                    <PlusCircle className="h-4 w-4" />
                    <span>Sell</span>
                  </Link>
                  <Link
                    to="/my-listings"
                    className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-brand-500 dark:text-slate-300 dark:hover:text-brand-500 transition-colors"
                  >
                    <Tags className="h-4 w-4" />
                    <span>Listings</span>
                  </Link>
                  <Link
                    to="/orders"
                    className="relative flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-brand-500 dark:text-slate-300 dark:hover:text-brand-500 transition-colors"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    <span>Orders</span>
                    {unreadOrdersCount > 0 && (
                      <span className="flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white animate-pulse">
                        {unreadOrdersCount}
                      </span>
                    )}
                  </Link>
                  <Link
                    to="/wishlist"
                    className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-brand-500 dark:text-slate-300 dark:hover:text-brand-500 transition-colors"
                  >
                    <Bookmark className="h-4 w-4" />
                    <span>Saved</span>
                  </Link>
                  <Link
                    to="/messages"
                    className="relative flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-brand-500 dark:text-slate-300 dark:hover:text-brand-500 transition-colors"
                  >
                    <MessageSquare className="h-4 w-4" />
                    <span>Inbox</span>
                    {unreadMessagesCount > 0 && (
                      <span className="flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white animate-pulse">
                        {unreadMessagesCount}
                      </span>
                    )}
                  </Link>
                  <Link
                    to="/notifications"
                    className="relative flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-brand-500 dark:text-slate-300 dark:hover:text-brand-500 transition-colors"
                  >
                    <Bell className="h-4 w-4" />
                    <span>Notifications</span>
                    {unreadNotificationsCount > 0 && (
                      <span className="flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white">
                        {unreadNotificationsCount}
                      </span>
                    )}
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Right side options */}
          <div className="flex items-center gap-4">
            <button
              onClick={toggleDarkMode}
              className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-darkbg-border/40 dark:hover:text-slate-200 transition-all active:scale-95"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            {user ? (
              <div className="flex items-center gap-3">
                {/* Mobile Responsive Icon Links */}
                <Link
                  to="/marketplace"
                  className="md:hidden flex items-center p-2 text-slate-600 hover:text-brand-500 dark:text-slate-300 dark:hover:text-brand-500 transition-colors"
                  title="Marketplace"
                >
                  <Store className="h-5 w-5" />
                </Link>
                <Link
                  to="/sell"
                  className="md:hidden flex items-center p-2 text-slate-600 hover:text-brand-500 dark:text-slate-300 dark:hover:text-brand-500 transition-colors"
                  title="Sell Item"
                >
                  <PlusCircle className="h-5 w-5" />
                </Link>
                <Link
                  to="/my-listings"
                  className="md:hidden flex items-center p-2 text-slate-600 hover:text-brand-500 dark:text-slate-300 dark:hover:text-brand-500 transition-colors"
                  title="My Listings"
                >
                  <Tags className="h-5 w-5" />
                </Link>
                <Link
                  to="/orders"
                  className="relative md:hidden flex items-center p-2 text-slate-600 hover:text-brand-500 dark:text-slate-300 dark:hover:text-brand-500 transition-colors"
                  title="My Orders"
                >
                  <ShoppingBag className="h-5 w-5" />
                  {unreadOrdersCount > 0 && (
                    <span className="absolute top-0 right-0 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand-500 text-[8px] font-bold text-white animate-pulse">
                      {unreadOrdersCount}
                    </span>
                  )}
                </Link>
                <Link
                  to="/wishlist"
                  className="md:hidden flex items-center p-2 text-slate-600 hover:text-brand-500 dark:text-slate-300 dark:hover:text-brand-500 transition-colors"
                  title="Wishlist"
                >
                  <Bookmark className="h-5 w-5" />
                </Link>
                <Link
                  to="/messages"
                  className="relative md:hidden flex items-center p-2 text-slate-600 hover:text-brand-500 dark:text-slate-300 dark:hover:text-brand-500 transition-colors"
                  title="Inbox"
                >
                  <MessageSquare className="h-5 w-5" />
                  {unreadMessagesCount > 0 && (
                    <span className="absolute top-0 right-0 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand-500 text-[8px] font-bold text-white animate-pulse">
                      {unreadMessagesCount}
                    </span>
                  )}
                </Link>
                <Link
                  to="/notifications"
                  className="relative md:hidden flex items-center p-2 text-slate-600 hover:text-brand-500 dark:text-slate-300 dark:hover:text-brand-500 transition-colors"
                  title="Alerts"
                >
                  <Bell className="h-5 w-5" />
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute top-0 right-0 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand-50 text-[8px] font-bold text-white bg-brand-500">
                      {unreadNotificationsCount}
                    </span>
                  )}
                </Link>

                <div className="h-5 w-[1px] bg-slate-200 dark:bg-darkbg-border" />

                <div className="flex items-center gap-2">
                  <Link to="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <div className="relative h-8 w-8 rounded-full overflow-hidden bg-brand-50 text-brand-650 dark:bg-brand-900/30 dark:text-brand-400 ring-2 ring-brand-500/20 flex items-center justify-center shrink-0">
                      {user.profile_image ? (
                        <img
                          src={user.profile_image}
                          alt={user.full_name || 'Profile'}
                          className="absolute inset-0 h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.parentElement?.querySelector('.avatar-fallback');
                            if (fallback) {
                              fallback.classList.remove('hidden');
                              fallback.classList.add('flex');
                            }
                          }}
                        />
                      ) : null}
                      <div className={`avatar-fallback ${user.profile_image ? 'hidden' : 'flex'} h-full w-full items-center justify-center`}>
                        <UserIcon className="h-4 w-4" />
                      </div>
                    </div>
                    
                    <span className="hidden lg:inline text-sm font-medium text-slate-700 dark:text-slate-300">
                      {user.full_name?.split(' ')[0]}
                    </span>
                  </Link>

                  <button
                    onClick={logout}
                    className="rounded-xl p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all active:scale-95"
                    title="Log Out"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/marketplace"
                  className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-brand-500 dark:text-slate-300 dark:hover:text-brand-500 transition-colors mr-2"
                >
                  <Store className="h-4 w-4" />
                  <span>Marketplace</span>
                </Link>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/login')}
                  className="font-semibold"
                >
                  Sign In
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
export default Navbar;
