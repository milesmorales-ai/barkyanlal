import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faUser, faEnvelope, faFloppyDisk, faCamera, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../hooks/useSettings';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../services/supabaseClient';
import './Settings.css';
import LoadingButton from '../components/LoadingButton';

export default function EditProfile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings, updateSetting, persistSettings, loading } = useSettings(user);
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [username, setUsername] = useState('');
  const [photo, setPhoto] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading) {
      setUsername(settings.profile?.username || user?.user_metadata?.username || '');
      setPhoto(settings.profile?.photo || '');
    }
  }, [loading, settings.profile?.photo, settings.profile?.username, user?.user_metadata?.username]);

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose an image file.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setPhotoError('Please choose an image smaller than 3 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(String(reader.result));
      setPhotoError('');
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const trimmedUsername = username.trim().toLowerCase();

    if (!trimmedUsername) {
      setSaving(false);
      return;
    }

    const nextSettings = {
      ...settings,
      profile: {
        ...settings.profile,
        username: trimmedUsername,
        photo,
        email: user?.email || settings.profile?.email || '',
      },
    };

    try {
      await persistSettings(nextSettings);
      updateSetting('profile', nextSettings.profile);
    } catch (error) {
      console.error('Could not save profile settings:', error);
      setPhotoError('Could not save your profile. Please try again.');
      setSaving(false);
      return;
    }

    if (user && supabase) {
      await supabase.auth.updateUser({
        data: {
          username: trimmedUsername,
        },
      });

      await supabase.from('user_profiles').upsert(
        {
          user_id: user.id,
          username: trimmedUsername,
          email: user.email || settings.profile?.email || '',
          avatar_url: photo || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
    }

    navigate('/profile');
  };

  return (
    <div className="settings-page edit-profile-page" style={{ background: colors.background }}>
      <div className="edit-profile-header">
        <button
          type="button"
          className="edit-profile-back"
          onClick={() => navigate('/profile')}
          style={{ color: colors.textPrimary }}
          aria-label="Back to profile"
        >
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <div>
          <h1 className="settings-title edit-profile-title" style={{ color: colors.textPrimary }}>{t('profile')}</h1>
          <p className="settings-subtitle" style={{ color: colors.textMuted }}>{t('updateProfile')}</p>
        </div>
      </div>

      <form className="settings-card edit-profile-card" onSubmit={handleSave} style={{ background: colors.cardBg, borderColor: colors.cardBorder }}>
        {/* AVATAR */}
        <div className="edit-profile-avatar-section">
          <div className="edit-profile-avatar-wrap">
            <div className="edit-profile-avatar" style={{ background: colors.primary, color: '#ffffff' }}>
              {photo ? <img src={photo} alt="Profile preview" /> : <FontAwesomeIcon icon={faUser} />}
            </div>
            <label
              className="edit-profile-avatar-badge"
              style={{ background: colors.primary, borderColor: colors.cardBg }}
              aria-label="Change photo"
              title="Change photo"
            >
              <FontAwesomeIcon icon={faCamera} />
              <input type="file" accept="image/*" onChange={handlePhotoChange} />
            </label>
          </div>
          {photo && (
            <button
              type="button"
              className="edit-profile-remove-link"
              onClick={() => setPhoto('')}
              style={{ color: colors.error }}
            >
              <FontAwesomeIcon icon={faTrashCan} /> Remove photo
            </button>
          )}
          {photoError && <p className="edit-profile-photo-error" style={{ color: colors.error }}>{photoError}</p>}
        </div>

        {/* PROFILE INFO */}
        <p className="edit-profile-section-label" style={{ color: colors.textMuted }}>{t('profileInfo')}</p>

        <label className="edit-profile-field" style={{ color: colors.textPrimary }}>
          <span>{t('username')}</span>
          <div className="edit-profile-input-wrap" style={{ borderColor: colors.inputBorder, background: colors.inputBg }}>
            <FontAwesomeIcon icon={faUser} style={{ color: colors.textMuted }} />
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="yourname"
              maxLength={30}
              autoComplete="username"
              disabled={loading}
              required
            />
          </div>
        </label>

        <label className="edit-profile-field" style={{ color: colors.textPrimary }}>
          <span>{t('email')}</span>
          <div className="edit-profile-input-wrap edit-profile-readonly" style={{ borderColor: colors.inputBorder, background: colors.inputBg }}>
            <FontAwesomeIcon icon={faEnvelope} style={{ color: colors.textMuted }} />
            <input type="email" value={user?.email || settings.profile?.email || 'Local account'} readOnly />
          </div>
          <small style={{ color: colors.textMuted }}>
            {t('emailCannotChange')}
          </small>
        </label>

        <LoadingButton type="submit" className="edit-profile-save" loading={saving} disabled={loading || !username.trim()} style={{ background: colors.primary, color: '#ffffff' }}>
          <FontAwesomeIcon icon={faFloppyDisk} />
          {saving ? t('savingProfile') : t('saveProfile')}
        </LoadingButton>
      </form>
    </div>
  );
}