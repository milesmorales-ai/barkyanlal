import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import './Contact.css';

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby3Plx8krtXvuDyfV_TgPBgBde4vShBcU9lum-rp9evz4K1yLjl0lHRvBXlBTcBMruqAA/exec';

export default function Contact() {
  const navigate = useNavigate();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [type, setType] = useState('Problem');
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);

  const sendFeedback = async (event) => {
    event.preventDefault();
    if (!message.trim()) {
      setStatus('Please describe the problem or suggestion first.');
      return;
    }
    setSending(true);
    setStatus('');
    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({ type, category, message: message.trim() }),
      });
      setMessage('');
      setCategory('');
      setStatus('Thank you. Your feedback has been submitted.');
    } catch (error) {
      console.error('Could not submit feedback:', error);
      setStatus('Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="contact-page" style={{ background: colors.background, color: colors.textPrimary }}>
      <header className="contact-header">
        <button type="button" className="contact-back" onClick={() => navigate(-1)} aria-label="Go back">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <div>
          <p className="contact-eyebrow">BarKyanLal</p>
          <h1>{t('helpFeedback')}</h1>
        </div>
      </header>
      <form className="contact-card" onSubmit={sendFeedback} style={{ background: colors.cardBg, borderColor: colors.cardBorder }}>
        <label>{t('feedbackType')}<select value={type} onChange={(event) => setType(event.target.value)}><option value="Problem">{t('problem')}</option><option value="Suggestion">{t('suggestion')}</option></select></label>
        <label>{t('categoryLabel')}<input value={category} onChange={(event) => setCategory(event.target.value)} placeholder={t('categoryLabel')} /></label>
        <label>{t('message')}<textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder={t('feedbackPlaceholder')} rows={7} required /></label>
        <button type="submit" disabled={sending}><FontAwesomeIcon icon={faPaperPlane} /> {sending ? t('sending') : t('sendFeedback')}</button>
        {status && <p className="contact-status" role="status">{status}</p>}
      </form>
    </main>
  );
}
