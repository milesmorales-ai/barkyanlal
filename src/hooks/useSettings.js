import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

const DEFAULT_SETTINGS = {
  // Account
  profile: { name: '', email: '' },
  
  // Notifications
  notificationsEnabled: false,
  expiringReminders: true,
  recipeRecommendations: true,
  inventoryAlerts: true,
  
  // Recipe Preferences
  dietaryPreference: 'none',
  cuisine: 'any',
  spiceLevel: 'medium',
  cookingTime: 'any',
  servingSize: 2,
  
  // Inventory
  expiryReminder: '3',
  autoDeleteExpired: false,
  autoDeleteAfterDays: '1',
  
  // Appearance
  theme: 'system', // 'light', 'dark', or 'system'
  language: 'en',
};

export const useSettings = (user = null) => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [cloudSaveError, setCloudSaveError] = useState('');

  // Load local preferences first, then replace them with account preferences when available.
  useEffect(() => {
    let active = true;
    setLoading(true);
    const storageKey = user?.id ? `appSettings:${user.id}` : 'appSettings';
    const savedSettings = localStorage.getItem(storageKey);
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        const accountName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.full_name || '';
        const storedName = parsed.profile?.name;
        const profileName = storedName && storedName !== 'John Doe' ? storedName : accountName;
        setSettings({
          ...DEFAULT_SETTINGS,
          ...parsed,
          profile: { ...DEFAULT_SETTINGS.profile, ...parsed.profile, name: profileName, email: user?.email || parsed.profile?.email || '' },
        });
      } catch (e) {
        console.error('Error loading settings:', e);
        setSettings(DEFAULT_SETTINGS);
      }
    } else if (user) {
      setSettings(prev => ({
        ...prev,
        profile: {
          name: user.user_metadata?.full_name || user.user_metadata?.name || user.full_name || '',
          email: user.email || '',
        },
      }));
    }

    if (!user || user.isLocal || !supabase) {
      setLoading(false);
      return () => { active = false; };
    }

    supabase.from('user_preferences').select('settings').eq('user_id', user.id).maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error('Error loading account preferences:', error);
          if (active) setCloudSaveError('Settings could not be loaded from the cloud.');
          if (active) setLoading(false);
          return;
        }
        if (active && data?.settings) {
          setSettings(prev => ({ ...prev, ...data.settings, profile: { ...prev.profile, ...data.settings.profile } }));
        }
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [user?.id]);

  // Save local changes immediately and coalesce cloud writes during rapid edits.
  useEffect(() => {
    let active = true;
    let saveTimer;
    if (!loading) {
      const storageKey = user?.id ? `appSettings:${user.id}` : 'appSettings';
      localStorage.setItem(storageKey, JSON.stringify(settings));
      if (user && !user.isLocal && supabase) {
        saveTimer = window.setTimeout(async () => {
          const { error } = await supabase.from('user_preferences').upsert(
            { user_id: user.id, settings, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' },
          );
          if (!active) return;
          if (error) {
            console.error('Error saving account preferences:', error);
            setCloudSaveError('Your change was saved on this device, but could not be synced to the cloud.');
          } else {
            setCloudSaveError('');
          }
        }, 250);
      }
    }
    return () => {
      active = false;
      if (saveTimer) window.clearTimeout(saveTimer);
    };
  }, [settings, loading, user?.id]);

  const persistSettings = async (nextSettings) => {
    const storageKey = user?.id ? `appSettings:${user.id}` : 'appSettings';
    localStorage.setItem(storageKey, JSON.stringify(nextSettings));

    if (!user || user.isLocal || !supabase) return null;

    const { error } = await supabase.from('user_preferences').upsert(
      {
        user_id: user.id,
        settings: nextSettings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    if (error) throw error;
    setCloudSaveError('');
    return nextSettings;
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateNestedSetting = (key, nestedKey, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: { ...prev[key], [nestedKey]: value }
    }));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    const storageKey = user?.id ? `appSettings:${user.id}` : 'appSettings';
    localStorage.removeItem(storageKey);
    if (user && !user.isLocal && supabase) {
      supabase.from('user_preferences').delete().eq('user_id', user.id)
        .then(({ error }) => { if (error) console.error('Error resetting account preferences:', error); });
    }
  };

  return {
    settings,
    loading,
    cloudSaveError,
    updateSetting,
    updateNestedSetting,
    persistSettings,
    resetSettings,
  };
};