import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  updated_at: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  verifyOtpAndResetPassword: (email: string, token: string, newPassword: string) => Promise<{ error: any }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Fetch the user's profile from the 'profiles' table.
// Profile creation is handled server-side by the on_auth_user_created trigger,
// so this helper is SELECT-only — no client-side INSERT needed or allowed.
export async function fetchOrCreateProfile(userId: string, email: string, fullName?: string): Promise<Profile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      // PGRST116 = row not found yet (trigger may not have fired); any other
      // error is logged but we return null rather than crashing.
      if (error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
      }
      return null;
    }

    return data;
  } catch (err) {
    console.error('Unexpected error loading profile:', err);
    return null;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isPasswordRecoveryRef = useRef(false);

  const loadProfile = async (userId: string, email: string, fullName?: string) => {
    try {
      const data = await fetchOrCreateProfile(userId, email, fullName);
      setProfile(data);
    } catch (e) {
      console.error('Failed to load user profile:', e);
    }
  };

  useEffect(() => {
    let active = true;

    // Load initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      if (isPasswordRecoveryRef.current) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id, session.user.email ?? '').finally(() => {
          if (active) setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!active) return;
      // During password reset / OTP verification, prevent transient sessions from leaking
      // into app state and falsely routing the user to tabs / triggering permissions
      if (isPasswordRecoveryRef.current) {
        return;
      }
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        setIsLoading(true);
        // Extract full name if available in user metadata
        const metadataFullName = currentSession.user.user_metadata?.full_name;
        await loadProfile(currentSession.user.id, currentSession.user.email ?? '', metadataFullName);
      } else {
        setProfile(null);
      }
      setIsLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          // Stored in auth.users user_metadata; the DB trigger reads this
          // to populate the profiles.full_name column automatically.
          full_name: fullName,
        },
      },
    });

    // Profile row is created by the on_auth_user_created trigger.
    // onAuthStateChange will fire and load the profile once the session
    // is established — no manual fetchOrCreateProfile call needed here.
    return { error: error ?? null };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error: error ?? null };
  };

  const verifyOtpAndResetPassword = async (email: string, token: string, newPassword: string) => {
    isPasswordRecoveryRef.current = true;
    try {
      const { error: otpError } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'recovery',
      });
      if (otpError) {
        isPasswordRecoveryRef.current = false;
        return { error: otpError };
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) {
        isPasswordRecoveryRef.current = false;
        return { error: updateError };
      }

      // Explicitly sign out and reset local state so the user is never logged in
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setProfile(null);
      return { error: null };
    } catch (err: any) {
      return { error: err };
    } finally {
      // Hold guard briefly to swallow any trailing async onAuthStateChange events
      setTimeout(() => {
        isPasswordRecoveryRef.current = false;
      }, 500);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await loadProfile(user.id, user.email ?? '');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        isLoading,
        signIn,
        signUp,
        signOut,
        resetPassword,
        verifyOtpAndResetPassword,
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
