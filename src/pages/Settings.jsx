import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import Papa from 'papaparse';
import { useSettings } from '../hooks/useSettings';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useItems } from '../context/ItemContext';
import { useFamily } from '../context/FamilyContext';
import { enablePushNotifications } from '../services/notificationService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGear,
  faUser,
  faMobileScreen,
  faBell,
  faClock,
  faBoxesStacked,
  faCalendarDays,
  faWarehouse,
  faTrashCan,
  faTriangleExclamation,
  faPalette,
  faCircleHalfStroke,
  faLanguage,
  faDatabase,
  faFileExport,
  faFileImport,
  faBroom,
  faArrowRotateLeft,
  faCircleInfo,
  faBook,
  faLifeRing,
  faFileLines,
  faRightFromBracket,
  faUsers,
  faLink,
  faCopy,
  faRotate,
  faUserMinus,
  faPeopleGroup,
  faQrcode,
} from '@fortawesome/free-solid-svg-icons';
import './Settings.css';
import LoadingButton from '../components/LoadingButton';

const Settings = () => {
  const { user, isLocalMode, signOut } = useAuth();
  const { settings, updateSetting, resetSettings, cloudSaveError } = useSettings(user);
  const { colors, setTheme } = useTheme();
  const { t, language, setLanguage } = useLanguage();
  const { items, addItem } = useItems();
  const {
    family,
    members,
    loading: familyLoading,
    createFamily,
    joinFamily,
    regenerateInviteCode,
    leaveFamily,
    removeMember,
    deleteFamily,
    refreshFamily,
  } = useFamily();
  const navigate = useNavigate();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showClearDataModal, setShowClearDataModal] = useState(false);
  const [showResetSettingsModal, setShowResetSettingsModal] = useState(false);
  const [showAutoDeleteWarning, setShowAutoDeleteWarning] = useState(false);
  const [familyName, setFamilyName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [familyAction, setFamilyAction] = useState('');
  const [familyBusy, setFamilyBusy] = useState(false);
  const [dataAction, setDataAction] = useState('');
  const [showFamilyMembers, setShowFamilyMembers] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [showFamilyQr, setShowFamilyQr] = useState(false);
  const [familyQrUrl, setFamilyQrUrl] = useState('');
  const [showInviteJoin, setShowInviteJoin] = useState(false);
  const [notificationAction, setNotificationAction] = useState('');
  const importInputRef = useRef(null);

  const handleLogout = async () => {
    setLogoutBusy(true);
    try {
      await signOut();
    } finally {
      window.location.replace('/');
    }
  };

  const handleOpenFamilyMembers = async () => {
    setShowFamilyMembers(true);
    await refreshFamily();
  };

  useEffect(() => {
    const invite = new URLSearchParams(window.location.search).get('family_invite');
    if (invite) {
      setJoinCode(invite.toUpperCase());
      setShowInviteJoin(true);
    }
  }, []);

  useEffect(() => {
    if (
      !user?.id
      || !settings.notificationsEnabled
      || typeof Notification === 'undefined'
      || Notification.permission !== 'granted'
    ) return;

    enablePushNotifications(user.id).catch((error) => {
      console.error('Could not refresh this device notification token:', error);
    });
  }, [user?.id, settings.notificationsEnabled]);

  useEffect(() => {
    let active = true;
    if (!family?.invite_code) {
      setFamilyQrUrl('');
      return () => { active = false; };
    }

    const inviteLink = `${window.location.origin}/settings?family_invite=${family.invite_code}`;
    QRCode.toDataURL(inviteLink, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#2d241d', light: '#ffffff' },
    }).then((url) => {
      if (active) setFamilyQrUrl(url);
    }).catch((error) => {
      console.error('Could not create family invite QR code:', error);
      if (active) setFamilyQrUrl('');
    });

    return () => { active = false; };
  }, [family?.invite_code]);

  const handleCreateFamily = async (event) => {
    event.preventDefault();
    if (!familyName.trim()) return;
    setFamilyBusy(true);
    setFamilyAction('');
    try {
      await createFamily(familyName);
      setFamilyName('');
      setFamilyAction('Family pantry created.');
    } catch (error) {
      setFamilyAction(error.message);
    } finally {
      setFamilyBusy(false);
    }
  };

  const handleJoinFamily = async (event) => {
    event.preventDefault();
    if (!joinCode.trim()) return;
    setFamilyBusy(true);
    setFamilyAction('');
    try {
      await joinFamily(joinCode);
      setJoinCode('');
      setFamilyAction('You joined the family pantry.');
    } catch (error) {
      setFamilyAction(error.message);
    } finally {
      setFamilyBusy(false);
    }
  };

  const copyInviteLink = async () => {
    const inviteLink = `${window.location.origin}/settings?family_invite=${family.invite_code}`;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setFamilyAction('Invite link copied. QR code is ready to scan.');
    } catch (error) {
      console.error('Could not copy family invite link:', error);
      setFamilyAction('Could not copy the invite link. You can share the code instead.');
    }
    setShowFamilyQr(true);
  };

  const copyInviteCode = async () => {
    if (!family?.invite_code) return;
    try {
      await navigator.clipboard.writeText(family.invite_code);
      setFamilyAction('Invite code copied.');
    } catch (error) {
      console.error('Could not copy family invite code:', error);
      setFamilyAction('Could not copy the invite code. Please select and copy it manually.');
    }
  };

  const downloadFamilyQr = () => {
    if (!familyQrUrl || !family) return;
    const link = document.createElement('a');
    link.href = familyQrUrl;
    link.download = `${family.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-invite-qr.png`;
    link.click();
  };

  const regenerateCode = async () => {
    setFamilyBusy(true);
    try {
      await regenerateInviteCode();
      setFamilyAction('New invite code created.');
    } catch (error) {
      setFamilyAction(error.message);
    } finally {
      setFamilyBusy(false);
    }
  };

  const handleLeaveFamily = async () => {
    if (!window.confirm('Leave this family pantry? Your personal items will stay with your account.')) return;
    setFamilyBusy(true);
    try {
      await leaveFamily();
      setFamilyAction('You left the family pantry.');
    } catch (error) {
      setFamilyAction(error.message);
    } finally {
      setFamilyBusy(false);
    }
  };

  const handleRemoveMember = async (member) => {
    const label = member.username || 'this member';
    if (!window.confirm(`Remove ${label} from the family pantry?`)) return;
    setFamilyBusy(true);
    try {
      await removeMember(member.user_id);
      setFamilyAction(`${label} was removed from the family pantry.`);
    } catch (error) {
      setFamilyAction(error.message);
    } finally {
      setFamilyBusy(false);
    }
  };

  const handleDeleteFamily = async () => {
    if (!window.confirm('Delete this family pantry for everyone? Shared links will stop working.')) return;
    setFamilyBusy(true);
    try {
      await deleteFamily();
      setFamilyAction('Family pantry deleted.');
    } catch (error) {
      setFamilyAction(error.message);
    } finally {
      setFamilyBusy(false);
    }
  };

  useEffect(() => {
    if (settings.language && settings.language !== language) {
      setLanguage(settings.language);
    }
  }, [settings.language, language, setLanguage]);

  const handleToggle = (key) => (e) => {
    const value = e.target.checked;
    updateSetting(key, value);

    // Show warning when enabling auto-delete
    if (key === 'autoDeleteExpired' && value) {
      setShowAutoDeleteWarning(true);
    }
  };

  const handleSelectChange = (key) => (e) => {
    updateSetting(key, e.target.value);
  };

  const handleLanguageChange = (event) => {
    const nextLanguage = event.target.value;
    updateSetting('language', nextLanguage);
    setLanguage(nextLanguage);
  };

  const handleThemeChange = (e) => {
    const newTheme = e.target.value;
    updateSetting('theme', newTheme);
    setTheme(newTheme === 'system' ?
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') :
      newTheme
    );
  };

  const handleNotificationToggle = async (event) => {
    const enabled = event.target.checked;

    if (!enabled) {
      updateSetting('notificationsEnabled', false);
      return;
    }

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      updateSetting('notificationsEnabled', true);
      return;
    }

    await handleEnablePush();
  };

  const handleEnablePush = async () => {
    if (!user?.id) {
      setNotificationAction(language === 'mm' ? 'အသိပေးချက်များအတွက် အကောင့်ဝင်ပါ။' : 'Sign in to enable notifications.');
      return;
    }
    try {
      await enablePushNotifications(user.id);
      updateSetting('notificationsEnabled', true);
      setNotificationAction('');
    } catch (error) {
      updateSetting('notificationsEnabled', false);
      setNotificationAction(error.message || (language === 'mm' ? 'အသိပေးချက်များကို ဖွင့်၍မရပါ။' : 'Notifications could not be enabled.'));
    }
  };

  const handleExportInventory = () => {
    const headers = ['Name', 'Category', 'Location', 'Quantity', 'Expiry date'];
    const escapeCsv = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const rows = items.map(item => [item.name, item.category, item.location, item.quantity, item.expiryDate]
      .map(escapeCsv).join(','));
    const blob = new Blob([[headers.map(escapeCsv).join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kitchen-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportInventory = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async ({ data }) => {
        const importedItems = data
          .map((row) => {
            const value = (key) => row[key] ?? row[key.toLowerCase()] ?? '';
            return {
              name: String(value('Name') || '').trim(),
              category: String(value('Category') || 'other').trim().toLowerCase(),
              location: String(value('Location') || 'fridge').trim().toLowerCase(),
              quantity: value('Quantity') || null,
              expiryDate: value('Expiry date') || null,
            };
          })
          .filter((item) => item.name);

        for (const item of importedItems) await addItem(item);
        setDataAction(`Imported ${importedItems.length} inventory item${importedItems.length === 1 ? '' : 's'}.`);
      },
      error: (error) => setDataAction(`Could not import inventory: ${error.message}`),
    });
  };

  const profileName = settings.profile?.username || user?.user_metadata?.username || 'Add your username';
  const profileInitial = (settings.profile?.username || user?.user_metadata?.username || user?.email || '?')
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <div className="settings-page" style={{ background: colors.background }}>
      {/* Header */}
      <div className="settings-header">
        <div>
          <h1 className="settings-title" style={{ color: colors.textPrimary }}>
            <span className="settings-title-icon" style={{ color: colors.primary }}>
              <FontAwesomeIcon icon={faGear} />
            </span>{' '}
            {t('settings')}
          </h1>
          <p className="settings-subtitle" style={{ color: colors.textMuted }}>
            {t('manageAccount')}
          </p>
        </div>
      </div>

      {cloudSaveError && (
        <div className="settings-cloud-error" role="alert">
          {cloudSaveError}
        </div>
      )}

      {/* ACCOUNT SECTION */}
      <div className="settings-card" style={{
        background: colors.cardBg,
        borderColor: colors.cardBorder
      }}>
        <div className="settings-card-header" style={{ borderColor: colors.cardBorder }}>
          <span className="settings-card-header-icon" style={{ color: colors.primary }}>
            <FontAwesomeIcon icon={faUser} />
          </span>
          <span className="settings-card-header-title" style={{ color: colors.textWarm }}>{t('account')}</span>
        </div>

        {(!user || isLocalMode) ? (
          <div className="settings-item" style={{ borderColor: colors.cardBorder }}>
            <div className="settings-item-left">
              <span className="settings-item-icon" style={{ color: colors.textSecondary }}>
                <FontAwesomeIcon icon={faUser} />
              </span>
              <div className="settings-item-content">
                <p className="settings-item-label" style={{ color: colors.textPrimary }}>{t('guestMode')}</p>
                <p className="settings-item-description" style={{ color: colors.textMuted }}>
                  {language === 'mm' ? 'သင့်မီးဖိုချောင်ကို စက်များအကြား တစ်ပြိုင်တည်းအသုံးပြုပြီး မိသားစုနှင့် ချိတ်ဆက်ရန် ဝင်ရောက်ပါ။' : 'Sign in to sync your kitchen across devices and keep your family connected.'}
                </p>
              </div>
            </div>
            <div className="settings-item-right">
              <button
                type="button"
                className="settings-edit-profile-button"
                onClick={() => navigate('/login')}
              >
                <FontAwesomeIcon icon={faUser} style={{ marginRight: '6px' }} />
                Sign up / Log in
              </button>
            </div>
          </div>
        ) : (
          <div
            className="settings-profile-card"
            style={{ borderColor: colors.cardBorder }}
            onClick={() => navigate('/profile/edit')}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                navigate('/profile/edit');
              }
            }}
          >
            <div className="settings-profile-avatar-wrap">
              {settings.profile?.photo ? (
                <img src={settings.profile.photo} alt="Profile" className="settings-profile-avatar" />
              ) : (
                <div
                  className="settings-profile-avatar settings-profile-avatar-placeholder"
                  aria-hidden="true"
                >
                  {profileInitial}
                </div>
              )}
            </div>
            <div className="settings-profile-info">
              <p className="settings-profile-name" style={{ color: colors.textPrimary }}>
                {profileName}
              </p>
              {user?.email && (
                <p className="settings-profile-email" style={{ color: colors.textMuted }}>
                  {user.email}
                </p>
              )}
            </div>
            <span className="settings-item-chevron" style={{ color: colors.textMuted }}>›</span>
          </div>
        )}

      </div>

      {/* FAMILY PANTRY */}
      {user && !isLocalMode && (
        <div className="settings-card" style={{
          background: colors.cardBg,
          borderColor: colors.cardBorder
        }}>
          <div className="settings-card-header" style={{ borderColor: colors.cardBorder }}>
            <span className="settings-card-header-icon" style={{ color: colors.primary }}>
              <FontAwesomeIcon icon={faUsers} />
            </span>
            <span className="settings-card-header-title" style={{ color: colors.textWarm }}>{t('familyPantry')}</span>
          </div>

          {familyLoading ? (
            <div className="settings-family-empty" style={{ color: colors.textMuted }}>{language === 'mm' ? 'မိသားစုချိတ်ဆက်မှု စစ်ဆေးနေသည်...' : 'Checking family connection...'}</div>
          ) : family ? (
            <div className="settings-family-panel">
              <div className="settings-family-heading">
                <div>
                  <p className="settings-item-label" style={{ color: colors.textPrimary }}>{family.name}</p>
                  <p className="settings-item-description" style={{ color: colors.textMuted }}>
                    {language === 'mm' ? 'မျှဝေထားသော စားစရာခန်း · ' : 'Shared pantry · '}{family.role === 'owner' ? (language === 'mm' ? 'ပိုင်ရှင်' : 'Owner') : t('member')}
                  </p>
                </div>
              </div>
              <div className="settings-invite-box" style={{ background: colors.inputBg, borderColor: colors.inputBorder }}>
                <button
                  type="button"
                  className="settings-invite-code"
                  onClick={copyInviteCode}
                  style={{ color: colors.textPrimary }}
                  aria-label="Copy invite code"
                  title="Copy invite code"
                >
                  {family.invite_code}
                </button>
                <span className="settings-invite-code-label" style={{ color: colors.textMuted }}>{t('inviteCode')}</span>
              </div>
              <p className="settings-item-description" style={{ color: colors.textMuted }}>
                {t('sharedPantryDescription')}
              </p>
              <div className="settings-family-actions">
                <button type="button" className="settings-family-action-button" onClick={handleOpenFamilyMembers}>
                  <FontAwesomeIcon icon={faPeopleGroup} /> {t('viewMembers')}
                </button>
                <button type="button" className="settings-family-action-button" onClick={copyInviteLink} disabled={!familyQrUrl}>
                  <FontAwesomeIcon icon={faLink} /> {t('inviteMembers')}
                </button>
                {family.role === 'owner' && (
                  <LoadingButton type="button" className="settings-family-action-button" onClick={regenerateCode} loading={familyBusy}>
                    <FontAwesomeIcon icon={faRotate} /> {t('newCode')}
                  </LoadingButton>
                )}
                {family.role !== 'owner' && (
                  <LoadingButton type="button" className="settings-family-action-button settings-danger-button" onClick={handleLeaveFamily} loading={familyBusy}>
                    {t('leaveFamily')}
                  </LoadingButton>
                )}
                {family.role === 'owner' && (
                  <LoadingButton type="button" className="settings-family-action-button settings-danger-button" onClick={handleDeleteFamily} loading={familyBusy}>
                    {t('deleteFamily')}
                  </LoadingButton>
                )}
              </div>
            </div>
          ) : (
            <div className="settings-family-panel">
              <p className="settings-item-description" style={{ color: colors.textMuted }}>
                Create a shared pantry for your household, or join one with an invite code.
              </p>
              <form className="settings-family-form" onSubmit={handleCreateFamily}>
                <input
                  className="settings-family-input"
                  value={familyName}
                  onChange={(event) => setFamilyName(event.target.value)}
                  placeholder={language === 'mm' ? 'မိသားစု စားစရာခန်းအမည်' : 'Family pantry name'}
                  maxLength={80}
                  style={{ background: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }}
                />
                <LoadingButton type="submit" className="settings-edit-profile-button" loading={familyBusy} disabled={!familyName.trim()}>
                  {t('createPantry')}
                </LoadingButton>
              </form>
              <div className="settings-family-divider" style={{ color: colors.textMuted }}>{language === 'mm' ? 'သို့မဟုတ် ရှိပြီးသား စားစရာခန်းသို့ ဝင်ရန်' : 'or join an existing pantry'}</div>
              <form className="settings-family-form" onSubmit={handleJoinFamily}>
                <input
                  className="settings-family-input settings-family-code-input"
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  placeholder="8-character invite code"
                  maxLength={8}
                  style={{ background: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }}
                />
                <LoadingButton type="submit" className="settings-edit-profile-button" loading={familyBusy} disabled={joinCode.trim().length < 8}>
                  {t('joinPantry')}
                </LoadingButton>
              </form>
            </div>
          )}
          {familyAction && <p className="settings-family-status" style={{ color: colors.textMuted }}>{familyAction}</p>}
        </div>
      )}

      {showFamilyQr && family && familyQrUrl && (
        <div className="settings-modal-overlay" style={{ background: colors.overlay }}>
          <div className="settings-modal settings-family-qr-modal" style={{ background: colors.cardBg }}>
            <div className="settings-family-modal-header">
              <div>
                <h3 className="settings-modal-title" style={{ color: colors.textPrimary }}>Join {family.name}</h3>
                <p className="settings-modal-description" style={{ color: colors.textMuted }}>
                  Scan this code to open the family invite.
                </p>
              </div>
              <button type="button" className="settings-modal-close" onClick={() => setShowFamilyQr(false)} aria-label="Close QR code">
                ×
              </button>
            </div>
            <img className="settings-family-qr" src={familyQrUrl} alt={`QR code to join ${family.name}`} />
            <p className="settings-family-qr-code" style={{ color: colors.textPrimary }}>{family.invite_code}</p>
            <div className="settings-modal-actions">
              <button type="button" className="settings-modal-btn settings-modal-btn-cancel" onClick={downloadFamilyQr}>
                Download QR
              </button>
              <button type="button" className="settings-modal-btn settings-modal-btn-confirm" onClick={() => setShowFamilyQr(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {showInviteJoin && !family && joinCode && (
        <div className="settings-modal-overlay" style={{ background: colors.overlay }}>
          <div className="settings-modal" style={{ background: colors.cardBg }}>
            <h3 className="settings-modal-title" style={{ color: colors.textPrimary }}>Join a family pantry</h3>
            <p className="settings-modal-description" style={{ color: colors.textMuted }}>
              You were invited with code <strong>{joinCode}</strong>. Join to share the family pantry.
            </p>
            <div className="settings-modal-actions">
              <button type="button" className="settings-modal-btn settings-modal-btn-cancel" onClick={() => setShowInviteJoin(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="settings-modal-btn settings-modal-btn-confirm"
                disabled={familyBusy}
                onClick={async () => {
                  await handleJoinFamily({ preventDefault: () => {} });
                  setShowInviteJoin(false);
                }}
              >
                Join pantry
              </button>
            </div>
          </div>
        </div>
      )}

      {showFamilyMembers && family && (
        <div className="settings-modal-overlay" style={{ background: colors.overlay }}>
          <div className="settings-modal settings-family-members-modal" style={{ background: colors.cardBg }}>
            <div className="settings-family-modal-header">
              <div>
                <h3 className="settings-modal-title" style={{ color: colors.textPrimary }}>{language === 'mm' ? 'မိသားစုအဖွဲ့ဝင်များ' : 'Family members'}</h3>
                <p className="settings-modal-description" style={{ color: colors.textMuted }}>{family.name}</p>
              </div>
              <button type="button" className="settings-modal-close" onClick={() => setShowFamilyMembers(false)} aria-label="Close members">
                ×
              </button>
            </div>
            <div className="settings-family-modal-list">
              {members.map((member) => {
                const photo = member.user_id === user?.id
                  ? member.photo || settings.profile?.photo
                  : member.photo;

                return (
                <div className="settings-family-member" key={member.user_id}>
                  <div>
                    {photo ? (
                      <img src={photo} alt="" className="settings-family-member-photo" />
                    ) : (
                      <span className="settings-family-member-photo settings-family-member-photo-placeholder">
                        <FontAwesomeIcon icon={faUser} />
                      </span>
                    )}
                  </div>
                  <div className="settings-family-member-details">
                    <p className="settings-item-label" style={{ color: colors.textPrimary }}>
                      {member.username || t('familyMember')}
                      {member.user_id === user?.id ? (language === 'mm' ? ' (သင်)' : ' (you)') : ''}
                    </p>
                    <p className="settings-item-description" style={{ color: colors.textMuted }}>
                      {member.role === 'owner' ? t('host') : t('member')}
                    </p>
                  </div>
                  {family.role === 'owner' && member.user_id !== user?.id && (
                    <LoadingButton
                      type="button"
                      className="settings-edit-profile-button settings-danger-button"
                      onClick={() => handleRemoveMember(member)}
                      loading={familyBusy}
                    >
                      <FontAwesomeIcon icon={faUserMinus} /> {language === 'mm' ? 'ဖယ်ရှားရန်' : 'Kick'}
                    </LoadingButton>
                  )}
                </div>
                );
              })}
            </div>
            <div className="settings-modal-actions">
              <button type="button" className="settings-modal-btn settings-modal-btn-cancel" onClick={() => setShowFamilyMembers(false)}>
                {t('done')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NOTIFICATIONS SECTION */}
      <div className="settings-card" style={{
        background: colors.cardBg,
        borderColor: colors.cardBorder
      }}>
        <div className="settings-card-header" style={{ borderColor: colors.cardBorder }}>
          <span className="settings-card-header-icon" style={{ color: colors.primary }}>
            <FontAwesomeIcon icon={faBell} />
          </span>
          <span className="settings-card-header-title" style={{ color: colors.textWarm }}>{t('notifications')}</span>
        </div>

        <div className="settings-item" style={{ borderColor: colors.cardBorder }}>
          <div className="settings-item-left">
            <span className="settings-item-icon" style={{ color: colors.textSecondary }}>
              <FontAwesomeIcon icon={faBell} />
            </span>
            <div className="settings-item-content">
              <p className="settings-item-label" style={{ color: colors.textPrimary }}>{t('masterNotifications')}</p>
              <p className="settings-item-description" style={{ color: colors.textMuted }}>{t('globalNotificationToggle')}</p>
            </div>
          </div>
          <div className="settings-item-right">
            <label className="settings-toggle">
              <input
                type="checkbox"
                className="settings-toggle-input"
                checked={settings.notificationsEnabled}
                onChange={handleNotificationToggle}
              />
              <span className="settings-toggle-slider" style={{
                background: settings.notificationsEnabled ? colors.primary : colors.toggleBg
              }}></span>
            </label>
          </div>
        </div>
        {notificationAction && (
          <p className="settings-item-description" style={{ color: colors.textMuted, padding: '0 16px 12px' }}>
            {notificationAction}
          </p>
        )}

        <div className="settings-item" style={{ borderColor: colors.cardBorder }}>
          <div className="settings-item-left">
            <span className="settings-item-icon" style={{ color: colors.textSecondary }}>
              <FontAwesomeIcon icon={faClock} />
            </span>
            <div className="settings-item-content">
              <p className="settings-item-label" style={{ color: colors.textPrimary }}>{t('expiringReminders')}</p>
              <p className="settings-item-description" style={{ color: colors.textMuted }}>{t('expiryReminderDescription')}</p>
            </div>
          </div>
          <div className="settings-item-right">
            <label className="settings-toggle">
              <input
                type="checkbox"
                className="settings-toggle-input"
                checked={settings.expiringReminders}
                onChange={handleToggle('expiringReminders')}
                disabled={!settings.notificationsEnabled}
              />
              <span className="settings-toggle-slider" style={{
                background: settings.expiringReminders && settings.notificationsEnabled ? colors.primary : colors.toggleBg
              }}></span>
            </label>
          </div>
        </div>

        <div className="settings-item" style={{ borderColor: colors.cardBorder }}>
          <div className="settings-item-left">
            <span className="settings-item-icon" style={{ color: colors.textSecondary }}>
              <FontAwesomeIcon icon={faBell} />
            </span>
            <div className="settings-item-content">
              <p className="settings-item-label" style={{ color: colors.textPrimary }}>{t('recipeRecommendations')}</p>
              <p className="settings-item-description" style={{ color: colors.textMuted }}>{t('personalizedRecipeSuggestions')}</p>
            </div>
          </div>
          <div className="settings-item-right">
            <label className="settings-toggle">
              <input
                type="checkbox"
                className="settings-toggle-input"
                checked={settings.recipeRecommendations}
                onChange={handleToggle('recipeRecommendations')}
                disabled={!settings.notificationsEnabled}
              />
              <span className="settings-toggle-slider" style={{
                background: settings.recipeRecommendations && settings.notificationsEnabled ? colors.primary : colors.toggleBg
              }}></span>
            </label>
          </div>
        </div>

      </div>

      {/* INVENTORY SETTINGS */}
      <div className="settings-card" style={{
        background: colors.cardBg,
        borderColor: colors.cardBorder
      }}>
        <div className="settings-card-header" style={{ borderColor: colors.cardBorder }}>
          <span className="settings-card-header-icon" style={{ color: colors.primary }}>
            <FontAwesomeIcon icon={faBoxesStacked} />
          </span>
          <span className="settings-card-header-title" style={{ color: colors.textWarm }}>{t('inventory')}</span>
        </div>

        <div className="settings-item" style={{ borderColor: colors.cardBorder }}>
          <div className="settings-item-left">
            <span className="settings-item-icon" style={{ color: colors.textSecondary }}>
              <FontAwesomeIcon icon={faCalendarDays} />
            </span>
            <div className="settings-item-content">
              <p className="settings-item-label" style={{ color: colors.textPrimary }}>{t('expiryReminderLabel')}</p>
              <p className="settings-item-description" style={{ color: colors.textMuted }}>{t('expiryReminderDescription')}</p>
            </div>
          </div>
          <div className="settings-item-right">
            <select
              className="settings-select"
              value={settings.expiryReminder}
              onChange={handleSelectChange('expiryReminder')}
              style={{
                background: colors.inputBg,
                borderColor: colors.inputBorder,
                color: colors.textPrimary
              }}
            >
              <option value="1">1 {t('dayBefore')}</option>
              <option value="3">3 {t('daysBefore')}</option>
              <option value="5">5 {t('daysBefore')}</option>
              <option value="7">7 {t('daysBefore')}</option>
            </select>
          </div>
        </div>

        <div className="settings-item" style={{ borderColor: colors.cardBorder }}>
          <div className="settings-item-left">
            <span className="settings-item-icon" style={{ color: colors.textSecondary }}>
              <FontAwesomeIcon icon={faTrashCan} />
            </span>
            <div className="settings-item-content">
              <p className="settings-item-label" style={{ color: colors.textPrimary }}>{t('autoDeleteExpiredItems')}</p>
              <p className="settings-item-description" style={{ color: colors.textMuted }}>{t('autoDeleteDescription')}</p>
            </div>
          </div>
          <div className="settings-item-right">
            <label className="settings-toggle">
              <input
                type="checkbox"
                className="settings-toggle-input"
                checked={settings.autoDeleteExpired}
                onChange={handleToggle('autoDeleteExpired')}
              />
              <span className="settings-toggle-slider" style={{
                background: settings.autoDeleteExpired ? colors.primary : colors.toggleBg
              }}></span>
            </label>
          </div>
        </div>

        {settings.autoDeleteExpired && (
          <div className="settings-item" style={{ borderColor: colors.cardBorder }}>
            <div className="settings-item-left">
              <span className="settings-item-icon" style={{ color: colors.textSecondary }}>
                <FontAwesomeIcon icon={faCalendarDays} />
              </span>
              <div className="settings-item-content">
                <p className="settings-item-label" style={{ color: colors.textPrimary }}>{t('deleteAfter')}</p>
                <p className="settings-item-description" style={{ color: colors.textMuted }}>{t('deleteAfterDescription')}</p>
              </div>
            </div>
            <div className="settings-item-right">
              <select
                className="settings-select"
                value={settings.autoDeleteAfterDays || '1'}
                onChange={handleSelectChange('autoDeleteAfterDays')}
                style={{
                  background: colors.inputBg,
                  borderColor: colors.inputBorder,
                  color: colors.textPrimary
                }}
              >
                <option value="1">1 {t('day')}</option>
                <option value="2">2 {t('days')}</option>
                <option value="3">3 {t('days')}</option>
              </select>
            </div>
          </div>
        )}

        {showAutoDeleteWarning && settings.autoDeleteExpired && (
          <div className="settings-warning" style={{
            background: colors.warningBg,
            color: colors.warning
          }}>
            <FontAwesomeIcon icon={faTriangleExclamation} className="settings-warning-icon" />
            <span>
              {t('expiredRemovalWarning')} {settings.autoDeleteAfterDays || '1'} {Number(settings.autoDeleteAfterDays || '1') > 1 ? t('days') : t('day')}.
            </span>
          </div>
        )}
      </div>

      {/* APPEARANCE */}
      <div className="settings-card" style={{
        background: colors.cardBg,
        borderColor: colors.cardBorder
      }}>
        <div className="settings-card-header" style={{ borderColor: colors.cardBorder }}>
          <span className="settings-card-header-icon" style={{ color: colors.primary }}>
            <FontAwesomeIcon icon={faPalette} />
          </span>
          <span className="settings-card-header-title" style={{ color: colors.textWarm }}>{t('appearance')}</span>
        </div>

        <div className="settings-item" style={{ borderColor: colors.cardBorder }}>
          <div className="settings-item-left">
            <span className="settings-item-icon" style={{ color: colors.textSecondary }}>
              <FontAwesomeIcon icon={faCircleHalfStroke} />
            </span>
            <div className="settings-item-content">
              <p className="settings-item-label" style={{ color: colors.textPrimary }}>Theme</p>
              <p className="settings-item-description" style={{ color: colors.textMuted }}>
                {settings.theme === 'system' ? t('systemPreference') :
                 settings.theme === 'dark' ? t('darkMode') : t('lightMode')}
              </p>
            </div>
          </div>
          <div className="settings-item-right">
            <select
              className="settings-select"
              value={settings.theme}
              onChange={handleThemeChange}
              style={{
                background: colors.inputBg,
                borderColor: colors.inputBorder,
                color: colors.textPrimary
              }}
            >
                <option value="system">{t('system')}</option>
                <option value="light">{t('light')}</option>
                <option value="dark">{t('dark')}</option>
            </select>
          </div>
        </div>

        <div className="settings-item" style={{ borderColor: colors.cardBorder }}>
          <div className="settings-item-left">
            <span className="settings-item-icon" style={{ color: colors.textSecondary }}>
              <FontAwesomeIcon icon={faLanguage} />
            </span>
            <div className="settings-item-content">
              <p className="settings-item-label" style={{ color: colors.textPrimary }}>{t('language')}</p>
              <p className="settings-item-description" style={{ color: colors.textMuted }}>{t('appLanguage')}</p>
            </div>
          </div>
          <div className="settings-item-right">
            <select
              className="settings-select"
              value={settings.language}
              onChange={handleLanguageChange}
              style={{
                background: colors.inputBg,
                borderColor: colors.inputBorder,
                color: colors.textPrimary
              }}
            >
                <option value="en">{t('english')}</option>
                <option value="mm">{t('burmese')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* DATA MANAGEMENT */}
      <div className="settings-card" style={{
        background: colors.cardBg,
        borderColor: colors.cardBorder
      }}>
        <div className="settings-card-header" style={{ borderColor: colors.cardBorder }}>
          <span className="settings-card-header-icon" style={{ color: colors.primary }}>
            <FontAwesomeIcon icon={faDatabase} />
          </span>
          <span className="settings-card-header-title" style={{ color: colors.textWarm }}>{t('data')}</span>
        </div>

        <div className="settings-item" onClick={handleExportInventory} style={{ borderColor: colors.cardBorder }}>
          <div className="settings-item-left">
            <span className="settings-item-icon" style={{ color: colors.textSecondary }}>
              <FontAwesomeIcon icon={faFileExport} />
            </span>
            <div className="settings-item-content">
              <p className="settings-item-label" style={{ color: colors.textPrimary }}>{t('exportInventory')}</p>
              <p className="settings-item-description" style={{ color: colors.textMuted }}>{t('exportDescription')}</p>
            </div>
          </div>
          <div className="settings-item-right">
            <span className="settings-item-chevron" style={{ color: colors.textMuted }}>›</span>
          </div>
        </div>

        <div className="settings-item" onClick={() => importInputRef.current?.click()} style={{ borderColor: colors.cardBorder }}>
          <div className="settings-item-left">
            <span className="settings-item-icon" style={{ color: colors.textSecondary }}>
              <FontAwesomeIcon icon={faFileImport} />
            </span>
            <div className="settings-item-content">
              <p className="settings-item-label" style={{ color: colors.textPrimary }}>{t('importInventory')}</p>
              <p className="settings-item-description" style={{ color: colors.textMuted }}>{t('importDescription')}</p>
            </div>
          </div>
          <div className="settings-item-right">
            <span className="settings-item-chevron" style={{ color: colors.textMuted }}>›</span>
          </div>
          <input ref={importInputRef} type="file" accept=".csv,text/csv" onChange={handleImportInventory} hidden />
        </div>

        {dataAction && (
          <p className="settings-data-status" style={{ color: colors.textMuted }} role="status">
            {dataAction}
          </p>
        )}

        <div className="settings-item" onClick={() => setShowClearDataModal(true)} style={{ borderColor: colors.cardBorder }}>
          <div className="settings-item-left">
            <span className="settings-item-icon" style={{ color: colors.textSecondary }}>
              <FontAwesomeIcon icon={faBroom} />
            </span>
            <div className="settings-item-content">
              <p className="settings-item-label" style={{ color: colors.textPrimary }}>{t('clearLocalData')}</p>
              <p className="settings-item-description" style={{ color: colors.textMuted }}>{t('clearDataDescription')}</p>
            </div>
          </div>
          <div className="settings-item-right">
            <span className="settings-item-chevron" style={{ color: colors.textMuted }}>›</span>
          </div>
        </div>

        <div className="settings-item" onClick={() => setShowResetSettingsModal(true)} style={{ borderColor: colors.cardBorder }}>
          <div className="settings-item-left">
            <span className="settings-item-icon" style={{ color: colors.textSecondary }}>
              <FontAwesomeIcon icon={faArrowRotateLeft} />
            </span>
            <div className="settings-item-content">
              <p className="settings-item-label" style={{ color: colors.textPrimary }}>{t('resetPreferences')}</p>
              <p className="settings-item-description" style={{ color: colors.textMuted }}>{t('resetDescription')}</p>
            </div>
          </div>
          <div className="settings-item-right">
            <span className="settings-item-chevron" style={{ color: colors.textMuted }}>›</span>
          </div>
        </div>
      </div>

      {/* ABOUT */}
      <div className="settings-card" style={{
        background: colors.cardBg,
        borderColor: colors.cardBorder
      }}>
        <div className="settings-card-header" style={{ borderColor: colors.cardBorder }}>
          <span className="settings-card-header-icon" style={{ color: colors.primary }}>
            <FontAwesomeIcon icon={faCircleInfo} />
          </span>
          <span className="settings-card-header-title" style={{ color: colors.textWarm }}>{t('about')}</span>
        </div>

        <div className="settings-item" style={{ borderColor: colors.cardBorder }}>
          <div className="settings-item-left">
            <span className="settings-item-icon" style={{ color: colors.textSecondary }}>
              <FontAwesomeIcon icon={faMobileScreen} />
            </span>
            <div className="settings-item-content">
              <p className="settings-item-label" style={{ color: colors.textPrimary }}>{t('appVersion')}</p>
              <p className="settings-item-description" style={{ color: colors.textMuted }}>{t('currentVersionDescription')}</p>
            </div>
          </div>
          <div className="settings-item-right">
            <span className="settings-badge version" style={{
              background: colors.badgeBg,
              color: colors.textMuted
            }}>v2.4.1-beta</span>
          </div>
        </div>

        <div className="settings-item" style={{ borderColor: colors.cardBorder }}>
          <div className="settings-item-left">
            <span className="settings-item-icon" style={{ color: colors.textSecondary }}>
              <FontAwesomeIcon icon={faBook} />
            </span>
            <div className="settings-item-content">
                  <p className="settings-item-label" style={{ color: colors.textPrimary }}>{t('about')}</p>
              <p className="settings-item-description" style={{ color: colors.textMuted }}>{t('aboutDescription')}</p>
            </div>
          </div>
          <div className="settings-item-right">
            <span className="settings-item-chevron" style={{ color: colors.textMuted }}>›</span>
          </div>
        </div>

        <div className="settings-item" onClick={() => navigate('/contact')} role="button" tabIndex={0} style={{ borderColor: colors.cardBorder }}>
          <div className="settings-item-left">
            <span className="settings-item-icon" style={{ color: colors.textSecondary }}>
              <FontAwesomeIcon icon={faLifeRing} />
            </span>
            <div className="settings-item-content">
              <p className="settings-item-label" style={{ color: colors.textPrimary }}>{t('help')}</p>
              <p className="settings-item-description" style={{ color: colors.textMuted }}>{t('feedbackDescription')}</p>
            </div>
          </div>
          <div className="settings-item-right">
            <span className="settings-item-chevron" style={{ color: colors.textMuted }}>›</span>
          </div>
        </div>

        <div className="settings-item" onClick={() => navigate('/legal')} role="button" tabIndex={0} style={{ borderColor: colors.cardBorder }}>
          <div className="settings-item-left">
            <span className="settings-item-icon" style={{ color: colors.textSecondary }}>
              <FontAwesomeIcon icon={faFileLines} />
            </span>
            <div className="settings-item-content">
              <p className="settings-item-label" style={{ color: colors.textPrimary }}>{t('terms')}</p>
              <p className="settings-item-description" style={{ color: colors.textMuted }}>{t('termsDescription')}</p>
            </div>
          </div>
          <div className="settings-item-right">
            <span className="settings-item-chevron" style={{ color: colors.textMuted }}>›</span>
          </div>
        </div>
      </div>

      {!isLocalMode && user && (
        <button
          className="settings-logout-btn"
          onClick={() => setShowLogoutModal(true)}
          style={{
            background: colors.errorBg,
            color: colors.error,
            borderColor: 'rgba(192, 57, 43, 0.1)'
          }}
        >
          <FontAwesomeIcon icon={faRightFromBracket} style={{ marginRight: '8px' }} />
          {t('logOut')}
        </button>
      )}

      {/* MODALS */}
      {showLogoutModal && (
        <div className="settings-modal-overlay" style={{ background: colors.overlay }}>
          <div className="settings-modal" style={{ background: colors.cardBg }}>
            <h3 className="settings-modal-title" style={{ color: colors.textPrimary }}>Log Out</h3>
            <p className="settings-modal-description" style={{ color: colors.textMuted }}>
              Are you sure you want to log out? You'll need to sign in again to access your account.
            </p>
            <div className="settings-modal-actions">
              <button
                className="settings-modal-btn settings-modal-btn-cancel"
                onClick={() => setShowLogoutModal(false)}
                style={{
                  background: 'rgba(60, 60, 67, 0.06)',
                  color: colors.textPrimary
                }}
              >
                Cancel
              </button>
              <LoadingButton
                className="settings-modal-btn settings-modal-btn-confirm warning"
                onClick={handleLogout}
                loading={logoutBusy}
                style={{
                  background: colors.warning,
                  color: '#ffffff'
                }}
              >
                {logoutBusy ? 'Logging out...' : 'Log Out'}
              </LoadingButton>
            </div>
          </div>
        </div>
      )}

      {showClearDataModal && (
        <div className="settings-modal-overlay" style={{ background: colors.overlay }}>
          <div className="settings-modal" style={{ background: colors.cardBg }}>
            <h3 className="settings-modal-title" style={{ color: colors.textPrimary }}>Clear Local Data</h3>
            <p className="settings-modal-description" style={{ color: colors.textMuted }}>
              This will remove all cached data, preferences, and offline content. Your account data will remain safe.
            </p>
            <div className="settings-modal-actions">
              <button
                className="settings-modal-btn settings-modal-btn-cancel"
                onClick={() => setShowClearDataModal(false)}
                style={{
                  background: 'rgba(60, 60, 67, 0.06)',
                  color: colors.textPrimary
                }}
              >
                Cancel
              </button>
              <button
                className="settings-modal-btn settings-modal-btn-confirm warning"
                onClick={handleClearData}
                style={{
                  background: colors.warning,
                  color: '#ffffff'
                }}
              >
                Clear Data
              </button>
            </div>
          </div>
        </div>
      )}

      {showResetSettingsModal && (
        <div className="settings-modal-overlay" style={{ background: colors.overlay }}>
          <div className="settings-modal" style={{ background: colors.cardBg }}>
            <h3 className="settings-modal-title" style={{ color: colors.textPrimary }}>Reset Preferences</h3>
            <p className="settings-modal-description" style={{ color: colors.textMuted }}>
              Restore all settings to their default values. This cannot be undone.
            </p>
            <div className="settings-modal-actions">
              <button
                className="settings-modal-btn settings-modal-btn-cancel"
                onClick={() => setShowResetSettingsModal(false)}
                style={{
                  background: 'rgba(60, 60, 67, 0.06)',
                  color: colors.textPrimary
                }}
              >
                Cancel
              </button>
              <button
                className="settings-modal-btn settings-modal-btn-confirm warning"
                onClick={handleResetSettings}
                style={{
                  background: colors.warning,
                  color: '#ffffff'
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;