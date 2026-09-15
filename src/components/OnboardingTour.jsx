import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import './OnboardingTour.css';

const ENGLISH_STEPS = [
  { target: 'tour-add', title: 'Add groceries', description: 'Tap Add to save groceries you already have.' },
  { target: 'tour-storage', title: 'Check Storage', description: "Check Storage to see what's in your kitchen and what's expiring soon." },
  { target: 'tour-recipes', title: 'Find recipes', description: 'Open Recipes to get recipe suggestions based on what you currently have.' },
  { target: 'tour-notifications', title: 'Stay reminded', description: 'Use the bell icon for reminders.' },
  { target: 'tour-profile', title: 'Manage preferences', description: 'Manage your preferences here.' },
];

const BURMESE_STEPS = [
  { target: 'tour-add', title: 'စားစရာများ ထည့်ရန်', description: 'သင့်ထံတွင် ရှိပြီးသား စားစရာများကို သိမ်းရန် ထည့်ရန်ကို နှိပ်ပါ။' },
  { target: 'tour-storage', title: 'သိုလှောင်ခန်း စစ်ဆေးရန်', description: 'မီးဖိုချောင်ရှိ ပစ္စည်းများနှင့် မကြာမီ သက်တမ်းကုန်မည့် ပစ္စည်းများကို ကြည့်ရန် သိုလှောင်ခန်းကို ဖွင့်ပါ။' },
  { target: 'tour-recipes', title: 'ချက်ပြုတ်နည်းများ ရှာရန်', description: 'လက်ရှိရှိသော ပစ္စည်းများအပေါ် အခြေခံသည့် ချက်ပြုတ်နည်း အကြံပြုချက်များ ရရန် ချက်ပြုတ်နည်းများကို ဖွင့်ပါ။' },
  { target: 'tour-notifications', title: 'သတိပေးချက်များ ရယူရန်', description: 'သတိပေးချက်များအတွက် ခေါင်းလောင်းအိုင်ကွန်ကို အသုံးပြုပါ။' },
  { target: 'tour-profile', title: 'စိတ်ကြိုက်ရွေးချယ်မှုများ စီမံရန်', description: 'သင့်စိတ်ကြိုက် ဆက်တင်များကို ဤနေရာတွင် စီမံပါ။' },
];

const getTargetRect = (target) => {
  const element = document.querySelector(`[data-tour="${target}"]`);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
};

export default function OnboardingTour({ open, onClose }) {
  const { colors, theme } = useTheme();
  const { language } = useLanguage();
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [finished, setFinished] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState(null);
  const tooltipRef = useRef(null);
  const isDark = theme === 'dark';
  const tourSteps = language === 'mm' ? BURMESE_STEPS : ENGLISH_STEPS;
  const step = tourSteps[stepIndex];

  useEffect(() => {
    if (!open) return undefined;
    setStepIndex(0);
    setFinished(false);
  }, [open]);

  useEffect(() => {
    if (!open || finished) return undefined;
    const updateRect = () => setRect(getTargetRect(step.target));
    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [open, finished, step.target, stepIndex]);

  useEffect(() => {
    if (!open || finished || !rect || !tooltipRef.current) return;

    const tooltipHeight = tooltipRef.current.getBoundingClientRect().height;
    const gap = 18;
    const horizontal = Math.min(
      Math.max(rect.left + rect.width / 2 - 150, 16),
      Math.max(16, window.innerWidth - 316),
    );
    const hasRoomAbove = rect.top >= tooltipHeight + gap + 16;
    const top = hasRoomAbove
      ? rect.top - tooltipHeight - gap
      : Math.min(rect.top + rect.height + gap, window.innerHeight - tooltipHeight - 16);

    setTooltipPosition({ top: Math.max(16, top), left: horizontal });
  }, [open, finished, rect, stepIndex]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight' && !finished) setStepIndex((index) => Math.min(index + 1, tourSteps.length - 1));
      if (event.key === 'ArrowLeft' && !finished) setStepIndex((index) => Math.max(index - 1, 0));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, finished, onClose, tourSteps.length]);

  if (!open) return null;

  const finishTour = () => {
    window.localStorage.setItem('barkyanlal-tour-completed', 'true');
    setFinished(true);
  };

  const nextStep = () => {
    if (stepIndex === tourSteps.length - 1) finishTour();
    else setStepIndex((index) => index + 1);
  };

  return createPortal(
    <div className="tour-root" role="dialog" aria-modal="true" aria-label={language === 'mm' ? 'BarKyanLal အက်ပ်လမ်းညွှန်' : 'BarKyanLal app tour'}>
      {!finished && rect && <div className="tour-overlay" aria-hidden="true" />}
      {!finished && rect && <div className="tour-spotlight" style={rect} aria-hidden="true" />}
      <div
        className={`tour-tooltip${finished ? ' tour-tooltip-finished' : ''}`}
        ref={tooltipRef}
        style={finished ? undefined : (tooltipPosition || { top: '50%', left: '16px' })}
      >
        {finished ? (
          <div className="tour-complete-content">
            <div className="tour-finished-mark" aria-hidden="true"><span>✓</span></div>
            <div className="tour-complete-eyebrow">{language === 'mm' ? 'လမ်းညွှန်ပြီးပါပြီ' : 'TOUR COMPLETE'}</div>
            <h2>{language === 'mm' ? 'အားလုံး အဆင်သင့်ဖြစ်ပါပြီ!' : "You're all set!"}</h2>
            <p>{language === 'mm' ? 'သင့်မီးဖိုချောင်ကို စီမံရန် အဆင်သင့်ဖြစ်ပါပြီ။ အချက်အလက်အိုင်ကွန်မှ ဤလမ်းညွှန်ကို အချိန်မရွေး ပြန်ဖွင့်နိုင်ပါသည်။' : 'Your kitchen is ready to manage. You can replay this tour anytime from the info icon.'}</p>
            <button type="button" className="tour-primary-button" onClick={onClose}>{language === 'mm' ? 'ပြီးပါပြီ' : 'Done'}</button>
          </div>
        ) : (
          <>
            <div className="tour-step-label">{stepIndex + 1} {language === 'mm' ? 'ခု / ' : 'of '}{tourSteps.length}</div>
            <h2>{step.title}</h2>
            <p>{step.description}</p>
            <div className="tour-progress" aria-label={`${language === 'mm' ? 'အဆင့်' : 'Step'} ${stepIndex + 1} ${language === 'mm' ? 'ခု / ' : 'of '}${tourSteps.length}`}>
              {tourSteps.map((item, index) => <span key={item.target} className={index === stepIndex ? 'active' : ''} />)}
            </div>
            <div className="tour-actions">
              <button type="button" className="tour-skip-button" onClick={onClose}>{language === 'mm' ? 'လမ်းညွှန် ကျော်ရန်' : 'Skip Tour'}</button>
              <div className="tour-forward-actions">
                <button type="button" className="tour-back-button" onClick={() => setStepIndex((index) => Math.max(index - 1, 0))} disabled={stepIndex === 0}>{language === 'mm' ? 'နောက်သို့' : 'Back'}</button>
                <button type="button" className="tour-primary-button" onClick={nextStep}>{stepIndex === tourSteps.length - 1 ? (language === 'mm' ? 'ပြီးဆုံးရန်' : 'Finish') : (language === 'mm' ? 'နောက်တစ်ဆင့်' : 'Next')}</button>
              </div>
            </div>
          </>
        )}
      </div>
      <style>{`:root { --tour-card: ${colors.cardBg}; --tour-text: ${colors.textPrimary}; --tour-muted: ${colors.textMuted}; --tour-border: ${colors.cardBorder}; --tour-accent: ${colors.primary}; --tour-overlay: ${isDark ? 'rgba(0,0,0,.72)' : 'rgba(35,25,18,.64)'}; }`}</style>
    </div>,
    document.body,
  );
}
