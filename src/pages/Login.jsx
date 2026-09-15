import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { withConnectionHint } from '../utils/userFacingErrors';
import LoadingButton from '../components/LoadingButton';
import './Login.css';

export default function Login() {
  const navigate = useNavigate();
  const { theme, colors } = useTheme();
  const { t, language, setLanguage } = useLanguage();
  const {
    signInWithGoogle,
    signInWithUsernameOrEmail,
    signUpWithEmail,
    isConfigured,
    session,
    loading: authLoading,
    user,
  } = useAuth();

  const [mode, setMode] = useState('signin');
  const [loading, setLoading] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ─── Redirect if already logged in ───
  useEffect(() => {
    if (!authLoading && session?.user && !session.isLocal) {
      const metadata = session.user.user_metadata || {};
      const hasUsername = Boolean(metadata.username || metadata.user_name || metadata.display_name);

      if (hasUsername) {
        navigate('/', { replace: true });
      } else if (user && !user.isLocal) {
        navigate('/profile/edit', { replace: true });
      }
    }
  }, [authLoading, navigate, session, user]);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/');
  };

  // ─── Google Login ───
  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    const { error: signInError } = await signInWithGoogle();
    if (signInError) {
      setError(withConnectionHint(signInError.message, 'try signing in'));
      setLoading(false);
    }
  };

  // ─── Email/Password Submit ───
  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // ─── SIGN UP ───
    if (mode === 'signup') {
      const trimmedUsername = username.trim();
      const trimmedEmail = identifier.trim();

      if (!trimmedEmail || !password || !trimmedUsername) {
        setError('Please enter your email, password, and username.');
        setLoading(false);
        return;
      }

      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        setLoading(false);
        return;
      }

      const { data, error: signUpError } = await signUpWithEmail({
        email: trimmedEmail,
        password,
        username: trimmedUsername,
      });

      if (signUpError) {
        setError(withConnectionHint(signUpError.message, 'try creating your account'));
        setLoading(false);
        return;
      }

      if (data?.session?.user) {
        setLoading(false);
        navigate('/profile/edit', { replace: true });
        return;
      }

      setLoading(false);
      setSuccess('Account created. Check your email to verify it, then sign in to finish your profile.');
      setMode('signin');
      return;
    }

    // ─── SIGN IN ───
    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier || !password) {
      setError('Please enter your username or email and password.');
      setLoading(false);
      return;
    }

    const { error: signInError } = await signInWithUsernameOrEmail({
      identifier: trimmedIdentifier,
      password,
    });

    if (signInError) {
      setError(withConnectionHint(signInError.message, 'try signing in'));
      setLoading(false);
      return;
    }

    setLoading(false);
    navigate('/', { replace: true });
  };

  // ─── Theme-based styles ───
  const isDark = theme === 'dark';

  const pageStyle = {
    background: isDark
      ? colors.background
      : 'linear-gradient(180deg, #f7f0e8 0%, #efe3d2 100%)',
  };

  const panelStyle = {
    background: isDark ? colors.cardBg : 'rgba(255, 255, 255, 0.96)',
    borderColor: isDark ? colors.cardBorder : 'rgba(141, 110, 63, 0.14)',
    color: colors.textPrimary,
    boxShadow: isDark
      ? '0 18px 38px rgba(0, 0, 0, 0.4)'
      : '0 18px 38px rgba(62, 46, 30, 0.12)',
  };

  const headingStyle = {
    color: isDark ? colors.textPrimary : '#2f261e',
  };

  const subtitleStyle = {
    color: isDark ? colors.textMuted : '#7c6d5d',
  };

  const fieldStyle = {
    color: isDark ? colors.textSecondary : '#4d3c2a',
  };

  const inputStyle = {
    background: isDark ? colors.inputBg : 'rgba(255, 255, 255, 0.9)',
    borderColor: isDark ? colors.inputBorder : 'rgba(122, 92, 61, 0.2)',
    color: isDark ? colors.textPrimary : '#2b2119',
  };

  const backButtonStyle = {
    color: isDark ? colors.primary : '#7a5d34',
  };

  return (
    <main className="login-page" style={pageStyle}>
      <section className="login-panel" aria-labelledby="login-title" style={panelStyle}>
        {/* ─── Back Button ─── */}
        <button
          type="button"
          className="login-back-top"
          onClick={handleBack}
          aria-label="Go back"
          style={backButtonStyle}
        >
          ← {t('goBack')}
        </button>

        {/* ─── Logo ─── */}
        <div className="login-mark" aria-hidden="true">
          <img src="/logo.png" alt="" />
        </div>

        {/* ─── Title ─── */}
        <h1 id="login-title" className="login-heading" style={headingStyle}>
          {mode === 'signin' ? t('welcomeBack') : t('createAccount')}
        </h1>
        <p className="login-subtitle" style={subtitleStyle}>
          {mode === 'signin'
            ? t('loginSubtitle')
            : t('signupSubtitle')}
        </p>

        <button type="button" className="login-mode-btn" onClick={() => setLanguage(language === 'mm' ? 'en' : 'mm')}>
          {language === 'mm' ? 'English' : 'မြန်မာ'}
        </button>

        <div className="login-mode-switch" aria-label="Choose sign in or sign up mode">
          <button
            type="button"
            className={`login-mode-btn ${mode === 'signin' ? 'active' : ''}`}
            onClick={() => {
              setMode('signin');
              setError('');
              setSuccess('');
            }}
          >
            {language === 'mm' ? 'ဝင်ရန်' : 'Log in'}
          </button>
          <button
            type="button"
            className={`login-mode-btn ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => {
              setMode('signup');
              setError('');
              setSuccess('');
            }}
          >
            {language === 'mm' ? 'စာရင်းသွင်းရန်' : 'Sign up'}
          </button>
        </div>

        {/* ─── Form ─── */}
        <form className="login-form" onSubmit={handleAuthSubmit}>
          {/* Username or email for sign in, email for account creation */}
          <label className="login-field" style={fieldStyle}>
            <span>{mode === 'signin' ? t('usernameOrEmail') : t('email')}</span>
            <input
              type={mode === 'signin' ? 'text' : 'email'}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={mode === 'signin' ? 'yourname or you@example.com' : 'you@example.com'}
              autoComplete={mode === 'signin' ? 'username' : 'email'}
              style={inputStyle}
            />
          </label>

          {/* Username (Sign Up only) */}
          {mode === 'signup' && (
            <label className="login-field" style={fieldStyle}>
              <span>{t('username')}</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="yourname"
                autoComplete="username"
                style={inputStyle}
              />
            </label>
          )}

          {/* Password */}
          <label className="login-field" style={fieldStyle}>
            <span>{t('password')}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signin' ? 'Enter your password' : 'Min 6 characters'}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              style={inputStyle}
            />
          </label>

          {/* Submit Button */}
          <LoadingButton
            className="login-primary-btn"
            type="submit"
            loading={loading}
            disabled={!isConfigured}
          >
            {loading
              ? (language === 'mm' ? 'ခဏစောင့်ပါ...' : 'Please wait...')
              : mode === 'signin'
                ? t('continueEmail')
                : t('createAccountButton')}
          </LoadingButton>
        </form>

        {/* ─── Divider ─── */}
        <div className="login-divider" style={{ color: isDark ? colors.textMuted : '#86745f' }}>
          <span>{t('or')}</span>
        </div>

        {/* ─── Google Button ─── */}
        <LoadingButton
          className="login-google-btn"
          type="button"
          onClick={handleGoogleLogin}
          loading={loading}
          disabled={!isConfigured}
          style={{
            background: isDark ? colors.cardBg : '#fff',
            color: isDark ? colors.textPrimary : '#2d241d',
            borderColor: isDark ? colors.cardBorder : 'rgba(122, 92, 61, 0.18)',
          }}
        >
          <span className="login-google-icon" aria-hidden="true">G</span>
          {loading ? t('connecting') : t('continueGoogle')}
        </LoadingButton>

        {/* ─── Error / Success / Setup ─── */}
        {!isConfigured && (
          <p className="login-setup">
            Add your Supabase URL and anon key to enable sign in.
          </p>
        )}
        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="login-setup" role="status">
            {success}
          </p>
        )}
      </section>
    </main>
  );
}