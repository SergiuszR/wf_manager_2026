import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Session, AuthChangeEvent, User } from '@supabase/supabase-js';
import { setAuthToken } from '../api/apiClient';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [initializing, setInitializing] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      setUser(data.session?.user ?? null);
      setSession(data.session ?? null);
      setToken(data.session?.access_token ?? null);
      setInitializing(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      setUser(session?.user ?? null);
      setSession(session ?? null);
      setToken(session?.access_token ?? null);
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  const login = async (email: string, password: string) => {
    setError(null);
    console.debug('[AuthContext] Attempting login', { email });
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });
    console.debug('[AuthContext] Login response', { error, data });
    if (error) {
      setError(error.message);
      console.error('[AuthContext] Login error', error);
      throw new Error(error.message);
    }
    setUser(data?.user ?? data?.session?.user ?? null);
    setSession(data?.session ?? null);
    setToken(data?.session?.access_token ?? null);
  };

  const register = async (email: string, password: string) => {
    setError(null);
    console.debug('[AuthContext] Attempting register', { email });
    const { error, data } = await supabase.auth.signUp({ email, password });
    console.debug('[AuthContext] Register response', { error, data });
    if (error) {
      setError(error.message);
      console.error('[AuthContext] Register error', error);
      throw new Error(error.message);
    }
    setUser(data?.user ?? data?.session?.user ?? null);
    setSession(data?.session ?? null);
    setToken(data?.session?.access_token ?? null);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setToken(null);
  };

  const clearError = () => setError(null);

  const value: AuthContextType = {
    user,
    session,
    token,
    loading,
    error,
    login,
    register,
    logout,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {initializing ? <div>Loading...</div> : children}
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