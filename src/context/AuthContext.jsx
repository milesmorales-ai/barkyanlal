import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [isLocalMode, setIsLocalMode] = useState(false);

  const upsertUserProfile = async ({ userId, username, email }) => {
    if (!supabase || !userId || !username) return null;

    const normalizedUsername = String(username).trim().toLowerCase();
    if (!normalizedUsername) return null;

    const { error } = await supabase.from('user_profiles').upsert(
      {
        user_id: userId,
        username: normalizedUsername,
        email: email || '',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    if (error) {
      console.error('Could not save profile username:', error);
      return null;
    }

    await supabase.auth.updateUser({
      data: {
        username: normalizedUsername,
      },
    });

    return normalizedUsername;
  };

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    let mounted = true;

    const sessionRequest = supabase.auth.getSession();
    const sessionTimeout = new Promise((resolve) => {
      window.setTimeout(() => resolve({ data: { session: null } }), 8000);
    });

    Promise.race([sessionRequest, sessionTimeout]).then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setLoading(false);
      }
    });

    const storedLocalMode = localStorage.getItem('app_local_mode');
    if (storedLocalMode === 'true' && !session) {
      setIsLocalMode(true);
    }

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) {
        setSession(nextSession);
        setLoading(false);
        if (nextSession) {
          setIsLocalMode(false);
          localStorage.removeItem('app_local_mode');
        }
      }
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    if (!supabase) {
      return { error: new Error('Supabase is not configured yet.') };
    }

    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/login`,
        queryParams: {
          prompt: 'select_account',
        },
      },
    });
  };

  const signInWithEmail = async ({ email, password }) => {
    if (!supabase) {
      return { error: new Error('Supabase is not configured yet.') };
    }

    return supabase.auth.signInWithPassword({ email, password });
  };

  const signUpWithEmail = async ({ email, password, username }) => {
    if (!supabase) {
      return { error: new Error('Supabase is not configured yet.') };
    }

    const normalizedUsername = String(username || '').trim().toLowerCase();
    const result = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: normalizedUsername,
        },
      },
    });

    if (result.data?.user && normalizedUsername) {
      await upsertUserProfile({
        userId: result.data.user.id,
        username: normalizedUsername,
        email: result.data.user.email,
      });
    }

    return result;
  };

  const signInWithUsernameOrEmail = async ({ identifier, password }) => {
    if (!supabase) {
      return { error: new Error('Supabase is not configured yet.') };
    }

    const cleanedIdentifier = String(identifier || '').trim();
    if (!cleanedIdentifier) {
      return { error: new Error('Please enter your username or email.') };
    }

    if (cleanedIdentifier.includes('@')) {
      return supabase.auth.signInWithPassword({ email: cleanedIdentifier, password });
    }

    const normalizedUsername = cleanedIdentifier.toLowerCase();
    const { data: profile, error: lookupError } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('username', normalizedUsername)
      .maybeSingle();

    if (lookupError) {
      return { error: lookupError };
    }

    if (!profile?.email) {
      return { error: new Error('No account was found for that username.') };
    }

    return supabase.auth.signInWithPassword({ email: profile.email, password });
  };

  const signOut = async () => {
    localStorage.removeItem('app_local_mode');
    let error = null;

    if (supabase) {
      try {
        const result = await supabase.auth.signOut();
        error = result.error || null;
        if (error) console.error('Could not sign out from Supabase:', error);
      } catch (signOutError) {
        error = signOutError;
        console.error('Could not sign out from Supabase:', signOutError);
      }
    }

    const localUser = {
      id: 'local-' + Date.now(),
      email: 'local@device.local',
      full_name: 'Local User',
      isLocal: true,
    };
    localStorage.setItem('app_local_mode', 'true');
    localStorage.setItem('local_user', JSON.stringify(localUser));
    setIsLocalMode(true);
    setSession({ user: localUser, isLocal: true });
    return { error };
  };

  const skipSignIn = () => {
    setIsLocalMode(true);
    localStorage.setItem('app_local_mode', 'true');
    const localUser = {
      id: 'local-' + Date.now(),
      email: 'local@device.local',
      full_name: 'Local User',
      isLocal: true,
    };
    localStorage.setItem('local_user', JSON.stringify(localUser));
    setSession({
      user: localUser,
      isLocal: true,
    });
    return { user: localUser };
  };

  const getUser = () => {
    if (session?.user && !session.isLocal) {
      return session.user;
    }
    if (isLocalMode) {
      const localUser = localStorage.getItem('local_user');
      if (localUser) {
        try {
          return JSON.parse(localUser);
        } catch (e) {
          return null;
        }
      }
    }
    return session?.user || null;
  };

  const user = useMemo(() => getUser(), [session, isLocalMode]);

  return (
    <AuthContext.Provider value={{
      session,
      user,
      loading,
      isLocalMode,
      isAuthenticated: !!user,
      isConfigured: Boolean(supabase),
      signInWithGoogle,
      signInWithEmail,
      signInWithUsernameOrEmail,
      signUpWithEmail,
      signOut,
      skipSignIn,
      upsertUserProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}