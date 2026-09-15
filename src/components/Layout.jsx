import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav';
import { useState, useEffect, useRef } from 'react';
import { useItems } from '../context/ItemContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../hooks/useSettings';
import { useLanguage } from '../context/LanguageContext';
import { listenForForegroundMessages, sendTestNotification } from '../services/notificationService';
import { supabase } from '../services/supabaseClient';
import PageSkeleton from './PageSkeleton';
import OnboardingTour from './OnboardingTour';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBell,
  faExclamationTriangle,
  faCheckCircle,
  faLeaf,
  faTimes,
  faUser,
  faSignOutAlt,
  faCircleInfo,
} from '@fortawesome/free-solid-svg-icons';

export default function Layout() {
  const location = useLocation();
  const { items, loading, addDebugSampleItems } = useItems();
  const { colors, theme } = useTheme();
  const { user, signOut, isLocalMode } = useAuth();
  const { settings } = useSettings(user);
  const { t } = useLanguage();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showDebugMenu, setShowDebugMenu] = useState(false);
  const [debugCommand, setDebugCommand] = useState('');
  const [debugStatus, setDebugStatus] = useState('');
  const [showTour, setShowTour] = useState(false);
  const previousNotificationIds = useRef(new Set());
  const notificationDate = new Date().toISOString().slice(0, 10);
  const notificationStateKey = `notificationState:${user?.id || 'local'}:${notificationDate}`;

  const getNotificationState = () => {
    try {
      return JSON.parse(localStorage.getItem(notificationStateKey) || '{}');
    } catch {
      return {};
    }
  };

  const isDark = theme === 'dark';

  // ─── Check expiring items ───
  useEffect(() => {
    const now = new Date();
    const reminderDays = Number(settings.expiryReminder) || 3;
    const getDaysLeft = (expiryDate) => Math.ceil(
      (new Date(`${expiryDate}T00:00:00`) - now) / (1000 * 60 * 60 * 24)
    );
    const expiringItems = items.filter(item => {
      if (!item.expiryDate) return false;
      const daysLeft = getDaysLeft(item.expiryDate);
      return daysLeft <= reminderDays && daysLeft >= 0;
    });

    const newNotifications = expiringItems.map(item => {
      const daysLeft = getDaysLeft(item.expiryDate);
      return {
        id: item.id,
        title: `${item.name} expires soon!`,
        message: `${daysLeft} day${daysLeft > 1 ? 's' : ''} left - use it or freeze it!`,
        time: new Date().toLocaleTimeString(),
        read: false,
        type: 'expiry'
      };
    });

    const remindersEnabled = settings.notificationsEnabled && settings.expiringReminders;
    const notificationState = getNotificationState();
    const readIds = new Set(notificationState.readIds || []);
    const visibleNotifications = remindersEnabled
      ? newNotifications.map((notification) => ({ ...notification, read: readIds.has(notification.id) }))
      : [];
    setNotifications(visibleNotifications);

    if (remindersEnabled && !notificationState.suppressed && 'Notification' in window && Notification.permission === 'granted') {
      const previousIds = previousNotificationIds.current;
      newNotifications
        .filter((notification) => !previousIds.has(notification.id))
        .forEach((notification) => {
          navigator.serviceWorker?.ready.then((registration) => {
            registration.showNotification(notification.title, {
              body: notification.message,
              icon: '/logo.png',
              data: { url: '/', itemId: notification.id },
            });
          });
        });
      previousNotificationIds.current = new Set(newNotifications.map((notification) => notification.id));
    }
  }, [items, settings.notificationsEnabled, settings.expiringReminders, settings.expiryReminder]);

  useEffect(() => {
    let unsubscribe;
    listenForForegroundMessages(async (payload) => {
      if (!settings.notificationsEnabled) return;
      const registration = await navigator.serviceWorker?.ready;
      if (!registration) return;
      await registration.showNotification(
        payload.notification?.title || 'Kitchen reminder',
        {
          body: payload.notification?.body || 'You have a new kitchen notification.',
          icon: '/logo.png',
          data: payload.data || {},
        },
      );
    }).then((cleanup) => {
      unsubscribe = cleanup;
    }).catch((error) => {
      console.error('Could not listen for foreground notifications:', error);
    });

    return () => unsubscribe?.();
  }, [settings.notificationsEnabled]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id) => {
    const next = notifications.map(n => n.id === id ? { ...n, read: true } : n);
    localStorage.setItem(notificationStateKey, JSON.stringify({
      ...getNotificationState(),
      readIds: next.filter(n => n.read).map(n => n.id),
    }));
    setNotifications(next);
  };

  const markAllAsRead = () => {
    const next = notifications.map(n => ({ ...n, read: true }));
    localStorage.setItem(notificationStateKey, JSON.stringify({
      ...getNotificationState(),
      readIds: next.map(n => n.id),
      suppressed: true,
    }));
    setNotifications(next);
    if (user && !user.isLocal && supabase) {
      supabase.from('notification_dismissals').upsert({
        user_id: user.id,
        dismissed_date: notificationDate,
      }, { onConflict: 'user_id' }).then(({ error }) => {
        if (error) console.error('Could not save notification dismissal:', error);
      });
    }
  };

  const clearNotifications = () => {
    localStorage.setItem(notificationStateKey, JSON.stringify({
      ...getNotificationState(),
      readIds: notifications.map(n => n.id),
      suppressed: true,
    }));
    setNotifications([]);
    setShowNotifications(false);
    if (user && !user.isLocal && supabase) {
      supabase.from('notification_dismissals').upsert({
        user_id: user.id,
        dismissed_date: notificationDate,
      }, { onConflict: 'user_id' }).then(({ error }) => {
        if (error) console.error('Could not save notification dismissal:', error);
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      window.location.replace('/');
    }
  };

  useEffect(() => {
    const handleDebugShortcut = (event) => {
      if (event.shiftKey && event.ctrlKey && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        setShowDebugMenu(true);
        setDebugCommand('');
        setDebugStatus('');
      }
    };

    window.addEventListener('keydown', handleDebugShortcut);
    return () => window.removeEventListener('keydown', handleDebugShortcut);
  }, []);

  useEffect(() => {
    const gesture = {
      holdTimer: null,
      tapTimer: null,
      startX: 0,
      startY: 0,
      held: false,
      armedUntil: 0,
      taps: 0,
    };

    const resetTaps = () => {
      gesture.taps = 0;
      gesture.armedUntil = 0;
    };

    const handleTouchStart = (event) => {
      if (showDebugMenu || event.touches.length !== 1) return;
      const touch = event.touches[0];
      gesture.startX = touch.clientX;
      gesture.startY = touch.clientY;
      gesture.held = false;
      window.clearTimeout(gesture.holdTimer);
      gesture.holdTimer = window.setTimeout(() => {
        gesture.held = true;
        gesture.armedUntil = Date.now() + 4000;
        gesture.taps = 0;
      }, 700);
    };

    const cancelHold = () => {
      window.clearTimeout(gesture.holdTimer);
    };

    const handleTouchMove = (event) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (Math.hypot(touch.clientX - gesture.startX, touch.clientY - gesture.startY) > 12) {
        cancelHold();
      }
    };

    const handleTouchEnd = () => {
      cancelHold();
      if (gesture.held) {
        gesture.held = false;
        return;
      }
      if (Date.now() > gesture.armedUntil) return;

      gesture.taps += 1;
      if (gesture.taps === 2) {
        resetTaps();
        setShowDebugMenu(true);
        setDebugCommand('');
        setDebugStatus('');
        return;
      }

      window.clearTimeout(gesture.tapTimer);
      gesture.tapTimer = window.setTimeout(resetTaps, 700);
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', cancelHold, { passive: true });
    return () => {
      cancelHold();
      window.clearTimeout(gesture.tapTimer);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', cancelHold);
    };
  }, [showDebugMenu]);

  const runDebugCommand = async (event) => {
    event.preventDefault();
    const command = debugCommand.trim().toLowerCase();
    if (command === 'test reminder' || command === 'test recommendation') {
      if (!user || user.isLocal) {
        setDebugStatus('Sign in to send a device notification test.');
        return;
      }
      setDebugStatus('Sending notification test...');
      try {
        await sendTestNotification(command === 'test reminder' ? 'reminder' : 'recommendation');
        setDebugStatus('Notification sent to your registered browser devices.');
      } catch (error) {
        console.error('Could not send notification test:', error);
        setDebugStatus(error.message || 'Could not send the notification test.');
      }
      return;
    }
    if (command !== 'debug') {
      setDebugStatus('Unknown command.');
      return;
    }

    setDebugStatus('Adding 12 test items...');
    await addDebugSampleItems(12);
    setDebugStatus('Added 12 test items.');
  };

  return (
    <div style={{ 
      paddingBottom: '80px',
      paddingTop: 'env(safe-area-inset-top)',
      background: colors.background,
      minHeight: '100vh',
      transition: 'background-color 0.3s ease',
    }}>
      {/* ─── APP HEADER ─── */}
      <div style={{
        padding: '12px 20px 8px 20px',
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'transparent',
        maxWidth: '480px',
        margin: '0 auto',
      }}>
        <div>
          {/* ─── TITLE + BETA ─── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{
              fontSize: '22px',
              margin: 0,
              color: colors.textPrimary,
              fontWeight: 700,
              letterSpacing: '-0.5px',
              transition: 'color 0.3s ease',
            }}>
              BarKyanLal
            </h1>
            
            {/* ─── BETA BADGE ─── */}
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '9px',
              fontWeight: 700,
              color: isDark ? '#FBBF24' : '#D97706',
              background: isDark ? 'rgba(251, 191, 36, 0.12)' : 'rgba(217, 119, 6, 0.08)',
              padding: '2px 8px',
              borderRadius: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              border: `1px solid ${isDark ? '#F59E0B' : '#D97706'}`,
              marginTop: '2px',
              lineHeight: 1.2,
            }}>
              <span style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: isDark ? '#FBBF24' : '#D97706',
              }} />
              Beta
            </span>
          </div>
          
          <p style={{
            fontSize: '12px',
            margin: '2px 0 0 0',
            color: colors.textMuted,
            fontWeight: 400,
            letterSpacing: '0.3px',
            transition: 'color 0.3s ease',
          }}>
            <FontAwesomeIcon 
              icon={faLeaf} 
              style={{ 
                fontSize: '10px', 
                marginRight: '4px', 
                color: colors.primary 
              }} 
            />
            {t('kitchenManager')}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* ─── User Info ─── */}
          {user && (
            <div style={{
              order: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              color: colors.textMuted,
            }}>
              <FontAwesomeIcon icon={faUser} style={{ fontSize: '12px', color: colors.primary }} />
              <span style={{ 
                maxWidth: '80px', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap',
                fontSize: '12px',
                fontWeight: 500,
              }}>
                {isLocalMode ? 'Guest' : settings.profile?.username || user.user_metadata?.username || 'User'}
              </span>
              {!isLocalMode && (
                <button
                  onClick={handleSignOut}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: colors.textMuted,
                    cursor: 'pointer',
                    padding: '4px 6px',
                    fontSize: '14px',
                    borderRadius: '6px',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(60,50,40,0.06)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  title="Sign Out"
                >
                  <FontAwesomeIcon icon={faSignOutAlt} />
                </button>
              )}
            </div>
          )}

          {/* ─── Notification Bell ─── */}
          <button
            type="button"
            data-tour="tour-notifications"
            aria-label="Open notifications"
            onClick={() => setShowNotifications(!showNotifications)}
            style={{
              order: 3,
              position: 'relative',
              cursor: 'pointer',
              background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(122, 92, 61, 0.06)',
              borderRadius: '14px',
              width: '46px',
              height: '46px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(122, 92, 61, 0.12)'}`,
              boxShadow: isDark
                ? '0 10px 24px rgba(0,0,0,0.22)'
                : '0 10px 24px rgba(92, 68, 49, 0.08)',
              transition: 'all 0.2s ease',
              padding: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(122, 92, 61, 0.18)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(122, 92, 61, 0.12)';
            }}
          >
            <FontAwesomeIcon 
              icon={faBell}
              style={{ 
                fontSize: '18px', 
                color: colors.textMuted,
                transition: 'color 0.3s ease',
              }}
            />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-5px',
                right: '-5px',
                background: isDark ? '#FBBF24' : '#D97706',
                color: '#fff',
                borderRadius: '999px',
                minWidth: '18px',
                height: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
                fontSize: '10px',
                fontWeight: 700,
                boxShadow: '0 4px 12px rgba(217, 119, 6, 0.35)',
              }}>
                {unreadCount}
              </span>
            )}
          </button>
          <button
            type="button"
            aria-label="Open app tour"
            title="How BarKyanLal works"
            onClick={() => setShowTour(true)}
            style={{
              order: 2,
              width: '38px',
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(122, 92, 61, 0.14)'}`,
              background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(122, 92, 61, 0.06)',
              color: colors.textMuted,
              cursor: 'pointer',
              fontSize: '17px',
              fontWeight: 700,
              padding: 0,
            }}
          >
            <FontAwesomeIcon icon={faCircleInfo} />
          </button>
        </div>
      </div>

      {/* ─── NOTIFICATION DROPDOWN ─── */}
      {showNotifications && (
        <>
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999,
              backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(44, 36, 26, 0.2)',
              transition: 'background-color 0.3s ease',
            }}
            onClick={() => setShowNotifications(false)}
          />
          <div style={{
            position: 'fixed',
            top: '82px',
            right: '16px',
            background: isDark ? 'linear-gradient(180deg, rgba(33,30,27,0.98), rgba(20,18,16,0.98))' : 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(250,246,242,0.98))',
            borderRadius: '18px',
            boxShadow: isDark
              ? '0 20px 40px rgba(0,0,0,0.45)'
              : '0 20px 40px rgba(86, 62, 42, 0.12)',
            width: 'min(360px, calc(100vw - 24px))',
            maxHeight: '420px',
            overflowY: 'auto',
            zIndex: 1000,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(124,92,64,0.12)'}`,
            transition: 'all 0.2s ease',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 16px 12px',
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(124,92,64,0.08)'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isDark ? 'rgba(251,191,36,0.12)' : 'rgba(217,119,6,0.08)',
                  color: isDark ? '#FBBF24' : '#D97706',
                }}>
                  <FontAwesomeIcon icon={faBell} style={{ fontSize: '12px' }} />
                </div>
                <span style={{
                  fontWeight: 700,
                  fontSize: '15px',
                  color: colors.textPrimary,
                }}>
                  Alerts
                </span>
                {unreadCount > 0 && (
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: isDark ? '#FBBF24' : '#D97706',
                    background: isDark ? 'rgba(251,191,36,0.12)' : 'rgba(217,119,6,0.08)',
                    borderRadius: '999px',
                    padding: '3px 7px',
                  }}>
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: colors.primary,
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      padding: 0,
                    }}
                  >
                    Read all
                  </button>
                )}
                <button
                  onClick={clearNotifications}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: colors.textMuted,
                    fontSize: '11px',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Clear
                </button>
              </div>
            </div>

            {notifications.length === 0 ? (
              <div style={{
                padding: '26px 20px',
                textAlign: 'center',
                color: colors.textMuted,
              }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  margin: '0 auto 10px',
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(122,92,61,0.06)',
                  color: isDark ? '#D7D2CE' : '#8C6A4D',
                }}>
                  <FontAwesomeIcon icon={faCheckCircle} style={{ fontSize: '18px' }} />
                </div>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: colors.textPrimary }}>
                  All clear
                </p>
                <p style={{ margin: '6px 0 0', fontSize: '12px', color: colors.textMuted }}>
                  Expiring items will show up here.
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  style={{
                    padding: '12px 14px',
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(124,92,64,0.08)'}`,
                    background: notification.read ? 'transparent' : (isDark ? 'rgba(251,191,36,0.05)' : 'rgba(217,119,6,0.04)'),
                    cursor: 'pointer',
                    transition: 'background 0.2s ease',
                  }}
                  onClick={() => markAsRead(notification.id)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(124,92,64,0.04)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = notification.read ? 'transparent' : (isDark ? 'rgba(251,191,36,0.05)' : 'rgba(217,119,6,0.04)');
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isDark ? 'rgba(217,119,6,0.12)' : 'rgba(217,119,6,0.08)',
                      color: isDark ? '#FBBF24' : '#D97706',
                      flexShrink: 0,
                    }}>
                      <FontAwesomeIcon icon={faExclamationTriangle} style={{ fontSize: '12px' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: notification.read ? 500 : 700,
                        fontSize: '13px',
                        color: colors.textPrimary,
                        lineHeight: 1.35,
                      }}>
                        {notification.title}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: colors.textMuted,
                        marginTop: '4px',
                        lineHeight: 1.4,
                      }}>
                        {notification.message}
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: isDark ? '#D7D2CE' : '#8C6A4D',
                        marginTop: '6px',
                      }}>
                        {notification.time}
                      </div>
                    </div>
                    {!notification.read && (
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: isDark ? '#FBBF24' : '#D97706',
                        flexShrink: 0,
                        marginTop: '7px',
                      }} />
                    )}
                  </div>
                </div>
              ))
            )}

            <div style={{
              padding: '10px 16px 12px',
              borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(124,92,64,0.08)'}`,
            }}>
              <button
                onClick={() => setShowNotifications(false)}
                style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(122,92,61,0.06)',
                  border: 'none',
                  borderRadius: '10px',
                  color: colors.textPrimary,
                  fontSize: '12px',
                  cursor: 'pointer',
                  width: '100%',
                  padding: '10px',
                  fontWeight: 600,
                }}
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}

      {/* ─── PAGE CONTENT ─── */}
      {showDebugMenu && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Debug command"
          onClick={() => setShowDebugMenu(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1200,
            display: 'grid', placeItems: 'center', padding: '20px',
            background: 'rgba(20, 16, 12, 0.52)',
          }}
        >
          <form
            onSubmit={runDebugCommand}
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(360px, 100%)', padding: '20px', borderRadius: '16px',
              background: colors.cardBg, border: `1px solid ${colors.cardBorder}`,
              boxShadow: '0 18px 50px rgba(0,0,0,0.2)',
            }}
          >
            <h2 style={{ margin: '0 0 6px', color: colors.textPrimary, fontSize: '18px' }}>Debug command</h2>
            <p style={{ margin: '0 0 14px', color: colors.textMuted, fontSize: '13px' }}>Enter a debug command or notification test.</p>
            <input
              autoFocus
              value={debugCommand}
              onChange={(event) => setDebugCommand(event.target.value)}
              placeholder="Type command"
              style={{ width: '100%', padding: '11px 12px', borderRadius: '10px', border: `1px solid ${colors.cardBorder}`, background: colors.inputBg, color: colors.textPrimary, boxSizing: 'border-box' }}
            />
            {debugStatus && <p style={{ margin: '10px 0 0', color: colors.textMuted, fontSize: '12px' }}>{debugStatus}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button type="button" onClick={() => setShowDebugMenu(false)} style={{ padding: '9px 13px', border: `1px solid ${colors.cardBorder}`, borderRadius: '9px', background: 'transparent', color: colors.textPrimary, cursor: 'pointer' }}>Close</button>
              <button type="submit" style={{ padding: '9px 13px', border: 'none', borderRadius: '9px', background: colors.primary, color: '#fff', cursor: 'pointer', fontWeight: 700 }}>Run</button>
            </div>
          </form>
        </div>
      )}

      <main
        translate={location.pathname === '/recipes' ? 'yes' : 'no'}
        lang={location.pathname === '/recipes' ? 'my' : undefined}
        style={{ 
        padding: '8px 16px 16px 16px', 
        maxWidth: '480px', 
        margin: '0 auto',
      }}>
        {loading ? <PageSkeleton colors={colors} /> : <Outlet />}
      </main>

      {/* ─── BOTTOM NAV ─── */}
      <BottomNav />
      <OnboardingTour open={showTour} onClose={() => setShowTour(false)} />
    </div>
  );
}