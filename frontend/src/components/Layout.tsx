import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './layout/Navbar';
import { ToastContainer } from './ui/Toast';
import { useRealtimeNotifications } from '../hooks/useNotifications';

export const Layout: React.FC = () => {
  // Subscribe to real-time user notifications globally
  useRealtimeNotifications();

  return (
    <div className="min-h-screen flex flex-col bg-grid-pattern text-slate-800 dark:text-slate-100 transition-colors duration-200">
      {/* Light/Dark theme exact circle accent */}
      <div className="absolute -top-6 -left-6 w-20 h-20 rounded-full border-[6px] border-teal-400/50 dark:border-teal-500/30 pointer-events-none -z-10" />

      {/* Premium Gradient Background Highlights */}
      <div className="absolute top-0 left-1/4 -z-10 h-96 w-96 rounded-full bg-brand-500/5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 -z-10 h-[350px] w-[350px] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />

      {/* Navigation Header */}
      <Navbar />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        <Outlet />
      </main>

      {/* Global Toast Container */}
      <ToastContainer />
    </div>
  );
};
export default Layout;
