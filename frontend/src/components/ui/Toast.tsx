import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export interface ToastType {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

let toastListeners: ((toasts: ToastType[]) => void)[] = [];
let toasts: ToastType[] = [];

export const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
  const id = Math.random().toString(36).substring(2, 9);
  toasts = [...toasts, { id, message, type }];
  toastListeners.forEach((listener) => listener(toasts));
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    toastListeners.forEach((listener) => listener(toasts));
  }, 4000);
};

export const ToastContainer: React.FC = () => {
  const [activeToasts, setActiveToasts] = useState<ToastType[]>([]);

  useEffect(() => {
    const listener = (newToasts: ToastType[]) => setActiveToasts(newToasts);
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== listener);
    };
  }, []);

  const removeToast = (id: string) => {
    toasts = toasts.filter((t) => t.id !== id);
    toastListeners.forEach((listener) => listener(toasts));
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full px-4 md:px-0">
      {activeToasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-start gap-3 p-4 rounded-2xl shadow-lg border backdrop-blur-md transition-all duration-300 animate-fade-in ${
            toast.type === 'success'
              ? 'bg-emerald-50/90 border-emerald-200/50 text-emerald-800 dark:bg-emerald-950/90 dark:border-emerald-900/40 dark:text-emerald-200'
              : toast.type === 'error'
              ? 'bg-red-50/90 border-red-200/50 text-red-800 dark:bg-red-950/90 dark:border-red-900/40 dark:text-red-200'
              : 'bg-blue-50/90 border-blue-200/50 text-blue-800 dark:bg-blue-950/90 dark:border-blue-900/40 dark:text-blue-200'
          }`}
        >
          {toast.type === 'success' && <CheckCircle className="h-5 w-5 shrink-0 mt-0.5 text-emerald-500" />}
          {toast.type === 'error' && <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-red-500" />}
          {toast.type === 'info' && <Info className="h-5 w-5 shrink-0 mt-0.5 text-blue-500" />}
          
          <div className="text-sm font-medium flex-1">{toast.message}</div>
          
          <button
            onClick={() => removeToast(toast.id)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
export default ToastContainer;
