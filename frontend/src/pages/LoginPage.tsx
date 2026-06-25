import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { AlertCircle, ArrowLeft } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { 
    user, 
    session, 
    isLoading, 
    loginWithGoogle, 
    authError, 
    setAuthError 
  } = useAuth();
  
  const navigate = useNavigate();
  const [isSubmitPending, setIsSubmitPending] = useState<boolean>(false);

  useEffect(() => {
    // If authenticated, redirect to marketplace
    if (session && user) {
      navigate('/marketplace');
    }
  }, [session, user, navigate]);

  const handleGoogleLogin = async () => {
    setIsSubmitPending(true);
    setAuthError(null);
    try {
      await loginWithGoogle();
    } catch (err) {
      setIsSubmitPending(false);
    }
  };

  // Helper to map technical auth errors to a friendly, actionable message
  const getFriendlyErrorMessage = (error: string | null): string => {
    if (!error) return '';
    const lowerError = error.toLowerCase();
    
    if (
      lowerError.includes('failed to fetch') ||
      lowerError.includes('load failed') ||
      lowerError.includes('network') ||
      lowerError.includes('signed out') ||
      lowerError.includes('session') ||
      lowerError.includes('unauthorized') ||
      lowerError.includes('jwt') ||
      lowerError.includes('token') ||
      lowerError.includes('authentication failed')
    ) {
      return 'Account signed out. Sign in again.';
    }
    
    // Fallback: hide any potential stack traces or code errors
    if (
      lowerError.includes('stack') || 
      lowerError.includes('at ') || 
      lowerError.includes('line ')
    ) {
      return 'Account signed out. Sign in again.';
    }
    
    return error;
  };

  return (
    <div className="flex min-h-[75vh] items-center justify-center py-10 px-4 sm:px-6 lg:px-8 animate-fade-in">
      <div className="w-full max-w-md space-y-6">
        
        {/* Navigation link back to landing */}
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-450 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-350 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Landing</span>
        </button>

        <Card className="p-8 shadow-2xl relative overflow-hidden bg-white/95 border-slate-200/80 dark:bg-[#0b101d]/90 dark:border-slate-800/80 text-slate-800 dark:text-slate-100 transition-all duration-300">
          {/* Top subtle glow banner line */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-cyan-450 via-brand-500 to-indigo-500" />
          
          <div className="space-y-6">
            
            {/* Title / Description */}
            <div className="text-left space-y-1.5">
              <h2 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white font-display">
                Sign In
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-450 font-medium">
                Access the marketplace using your verified college credentials.
              </p>
            </div>

            {/* Error alerts */}
            {authError && (
              <div className="flex gap-2.5 rounded-xl border border-red-200/50 bg-red-50/70 dark:border-red-950/30 dark:bg-red-950/20 p-4 text-left text-xs text-red-800 dark:text-red-300 animate-pulse">
                <AlertCircle className="h-4.5 w-4.5 shrink-0 text-red-500" />
                <div className="space-y-0.5 font-medium leading-normal">
                  <p className="font-bold">Authentication Error</p>
                  <p>{getFriendlyErrorMessage(authError)}</p>
                </div>
              </div>
            )}

            {/* Continue with Google */}
            <button
              onClick={handleGoogleLogin}
              disabled={isLoading || isSubmitPending}
              className="w-full flex items-center justify-center gap-3 font-extrabold py-3 border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:bg-[#070b13] dark:border-slate-800/80 dark:hover:bg-[#121929] dark:text-white transition-all rounded-xl shadow-sm text-xs active:scale-[0.98]"
            >
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" width="20" height="20">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Verification Notice */}
            <div className="border-t border-slate-100 dark:border-slate-800/80 pt-5 text-center text-xs">
              <span className="text-slate-500 dark:text-slate-450 font-medium">
                Note: Logging in is restricted to verified student accounts from our authorized college email domain.
              </span>
            </div>

          </div>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
