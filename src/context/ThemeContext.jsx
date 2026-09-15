import React, { createContext, useContext, useState, useEffect } from 'react';

// Color Palette - Cozy Warm Theme
export const COLORS = {
  light: {
    // Main Background (Cozy cream-beige)
    background: '#F1E8DD',
    
    // Primary Surfaces
    cardBg: '#FDFBF9',
    cardBorder: 'rgba(60, 60, 67, 0.06)',
    
    // Secondary Backgrounds (Warm layers)
    warmCream: '#FAF5EF',
    warmTan: '#F5EDE4',
    warmBeige: '#F0E8DC',
    warmBg: '#F8F2EA',
    
    // Accent/Gold (Warm bronze and amber)
    primary: '#8D6E3F',
    primaryHover: '#7A5D34',
    primaryLight: '#D4C5B0',
    amber: '#D97706',
    amberHover: '#B85E00',
    amberLight: '#FDE68A',
    gold: '#B8955D',
    
    // Text (Warm dark browns)
    textPrimary: '#2C241A',
    textSecondary: '#3D2E1F',
    textMuted: '#8A7A6A',
    textWarm: '#6B5A4A',
    textLight: '#A89B8D',
    
    // Borders (Soft warm beiges)
    borderLight: '#E8DDD0',
    borderMedium: '#DED2C4',
    borderDark: '#C9BBA8',
    
    // Status (Soft, warm versions)
    success: '#3D8B5E',
    successBg: 'rgba(61, 139, 94, 0.08)',
    successLight: '#E8F5EE',
    error: '#B84A3A',
    errorBg: 'rgba(184, 74, 58, 0.06)',
    errorLight: '#FDE8E5',
    warning: '#D97706',
    warningBg: 'rgba(217, 119, 6, 0.08)',
    warningLight: '#FEF3E7',
    info: '#5B7F8A',
    infoBg: 'rgba(91, 127, 138, 0.08)',
    
    // Components
    shadow: 'rgba(60, 50, 40, 0.06)',
    shadowHover: 'rgba(60, 50, 40, 0.10)',
    overlay: 'rgba(44, 36, 26, 0.35)',
    toggleBg: '#D5C8BA',
    toggleKnob: '#FFFFFF',
    inputBg: '#FFFFFF',
    inputBorder: 'rgba(60, 50, 40, 0.10)',
    badgeBg: 'rgba(60, 50, 40, 0.06)',
    
    // Special cozy accents
    warmGlow: 'rgba(141, 110, 63, 0.04)',
    warmHighlight: 'rgba(141, 110, 63, 0.08)',
  },
  dark: {
    // Main Background (Refined warm dark)
    background: '#17120F',
    
    // Primary Surfaces
    cardBg: '#241C17',
    cardElevated: '#2C221B',
    cardBorder: 'rgba(255, 255, 255, 0.04)',
    
    // Secondary Backgrounds (Warm dark layers)
    warmCream: '#2A2520',
    warmTan: '#302A25',
    warmBeige: '#352F2A',
    warmBg: '#1E1916',
    
    // Accent/Gold (Refined warmer gold)
    primary: '#C8A477',
    primaryHover: '#D9B98A',
    primaryLight: '#8D7A66',
    amber: '#E8B45B',
    amberHover: '#F0C46A',
    amberLight: '#FDE68A',
    gold: '#B8955D',
    
    // Text (Refined warmer creams)
    textPrimary: '#F3E9E1',
    textSecondary: '#E8DDD0',
    textMuted: '#B09D8C',
    textWarm: '#C9BBA8',
    textLight: '#8A7A6A',
    
    // Borders (Refined warm dark)
    borderLight: '#3A2D24',
    borderMedium: '#4A3A30',
    borderDark: '#5A483C',
    
    // Status (Refined warmer versions)
    success: '#78B889',
    successBg: 'rgba(120, 184, 137, 0.12)',
    successLight: 'rgba(120, 184, 137, 0.20)',
    error: '#E87868',
    errorBg: 'rgba(232, 120, 104, 0.12)',
    errorLight: 'rgba(232, 120, 104, 0.20)',
    warning: '#E8B45B',
    warningBg: 'rgba(232, 180, 91, 0.12)',
    warningLight: 'rgba(232, 180, 91, 0.20)',
    info: '#7FACB8',
    infoBg: 'rgba(127, 172, 184, 0.12)',
    
    // Components
    shadow: 'rgba(0, 0, 0, 0.30)',
    shadowHover: 'rgba(0, 0, 0, 0.40)',
    overlay: 'rgba(0, 0, 0, 0.60)',
    toggleBg: '#3D3530',
    toggleKnob: '#F3E9E1',
    inputBg: '#2C221B',
    inputBorder: 'rgba(255, 255, 255, 0.06)',
    badgeBg: 'rgba(255, 255, 255, 0.06)',
    
    // Special cozy accents
    warmGlow: 'rgba(200, 164, 119, 0.04)',
    warmHighlight: 'rgba(200, 164, 119, 0.08)',
  }
};

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('appTheme');
    if (saved) return saved;
    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  const [colors, setColors] = useState(COLORS[theme]);

  useEffect(() => {
    setColors(COLORS[theme]);
    localStorage.setItem('appTheme', theme);
    
    // Apply theme to document
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.body.style.background = COLORS.dark.background;
      document.body.style.color = COLORS.dark.textPrimary;
    } else {
      document.documentElement.removeAttribute('data-theme');
      document.body.style.background = COLORS.light.background;
      document.body.style.color = COLORS.light.textPrimary;
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const value = {
    theme,
    colors,
    toggleTheme,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};