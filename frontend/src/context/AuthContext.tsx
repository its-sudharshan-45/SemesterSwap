import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { showToast } from '../components/ui/Toast';

export interface College {
  id: string;
  name: string;
  email_domain: string;
}

export interface Department {
  id: string;
  code: string;
  name: string;
}

export interface UserProfile {
  id: string;
  auth_id: string;
  college_id: string | null;
  department_id: string | null;
  full_name: string | null;
  email: string;
  admission_year: number | null;
  roll_number: number | null;
  profile_image: string | null;
  rating: number;
  total_transactions: number;
  verification_status: string;
  college?: College;
  department?: Department;
}

interface AuthContextType {
  user: UserProfile | null;
  session: any | null;
  isLoading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  authError: string | null;
  setAuthError: (err: string | null) => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const lastFetchedToken = React.useRef<string | null>(null);
  const profileFetchRef = React.useRef<Promise<void> | null>(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  const loginWithGoogle = async () => {
    try {
      setIsLoading(true);
      setAuthError(null);
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Redirect directly to marketplace on login success
          redirectTo: window.location.origin + '/marketplace',
        },
      });

      if (error) throw error;
    } catch (err: any) {
      console.error('Login error:', err);
      setAuthError(err.message || 'Failed to initialize Google login');
      showToast(err.message || 'Failed to initialize Google login', 'error');
      setIsLoading(false);
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setAuthError(null);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      showToast('Signed in successfully', 'success');
    } catch (err: any) {
      console.error('Email sign in error:', err);
      setAuthError(err.message || 'Failed to sign in with email');
      showToast(err.message || 'Failed to sign in with email', 'error');
      setIsLoading(false);
    }
  };

  const signUpWithEmail = async (email: string, password: string, fullName: string) => {
    try {
      setIsLoading(true);
      setAuthError(null);

      const domain = email.split('@')[1].toLowerCase();
      if (domain !== 'kpriet.ac.in') {
        throw new Error('Only verified college students can access SemesterSwap (requires @kpriet.ac.in email).');
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          }
        }
      });
      if (error) throw error;
      
      showToast('Registration successful! Check verification mail or try signing in.', 'success');
    } catch (err: any) {
      console.error('Email sign up error:', err);
      setAuthError(err.message || 'Failed to register with email');
      showToast(err.message || 'Failed to register with email', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setAuthError(null);
      showToast('Logged out successfully', 'success');
    } catch (err: any) {
      console.error('Logout error:', err);
      showToast('Error signing out', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserProfile = async (token: string): Promise<UserProfile | null> => {
    try {
      const response = await fetch(`${API_URL}/api/v1/users/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 403) {
        throw new Error('Only verified college students can access SemesterSwap.');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to fetch user profile');
      }

      return await response.json();
    } catch (err: any) {
      console.error('Fetch profile error:', err);
      throw err;
    }
  };

  const refreshProfile = async () => {
    if (!session) return;
    try {
      const profile = await fetchUserProfile(session.access_token);
      setUser(profile);
    } catch (err: any) {
      console.error('Refresh profile error:', err);
      showToast(err.message || 'Error updating profile state', 'error');
    }
  };

  const handleAuthSession = async (currentSession: any) => {
    if (!currentSession) {
      lastFetchedToken.current = null;
      profileFetchRef.current = null;
      setUser(null);
      setSession(null);
      setIsLoading(false);
      return;
    }

    const token = currentSession.access_token;

    // Wait for an in-flight profile fetch instead of bailing without clearing loading state
    if (profileFetchRef.current) {
      await profileFetchRef.current;
      setIsLoading(false);
      return;
    }

    // Profile for this token is already loaded
    if (lastFetchedToken.current === token) {
      setSession(currentSession);
      setIsLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const email = currentSession.user?.email;
        if (!email) {
          throw new Error('No email address provided by auth provider');
        }

        const profile = await fetchUserProfile(token);

        lastFetchedToken.current = token;
        setSession(currentSession);
        setUser(profile);
        setAuthError(null);
      } catch (err: any) {
        console.error('Auth handler error:', err);
        lastFetchedToken.current = null;
        setAuthError(err.message || 'Authentication failed');
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
      } finally {
        setIsLoading(false);
        profileFetchRef.current = null;
      }
    };

    profileFetchRef.current = fetchProfile();
    await profileFetchRef.current;
  };

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session: initialSession } }) => {
        handleAuthSession(initialSession);
      })
      .catch((err) => {
        console.error('Failed to restore auth session:', err);
        setIsLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (
          event === 'SIGNED_IN' ||
          event === 'TOKEN_REFRESHED' ||
          event === 'INITIAL_SESSION'
        ) {
          await handleAuthSession(currentSession);
        } else if (event === 'SIGNED_OUT') {
          lastFetchedToken.current = null;
          profileFetchRef.current = null;
          setUser(null);
          setSession(null);
          setIsLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        loginWithGoogle,
        loginWithEmail,
        signUpWithEmail,
        logout,
        authError,
        setAuthError,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
