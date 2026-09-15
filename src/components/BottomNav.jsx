import { NavLink } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faHome,
  faBox,
  faPlus,
  faUtensils,
  faUser,
} from '@fortawesome/free-solid-svg-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

export default function BottomNav() {
  const { colors, theme } = useTheme();
  const { t, language } = useLanguage();
  const navLabelSize = language === 'mm' ? '8px' : '10px';

  const navItems = [
    { path: '/', icon: faHome, label: t('home') },
    { path: '/storage', icon: faBox, label: t('storage') },
    { path: '/add', icon: faPlus, label: t('add'), isAdd: true },
    { path: '/recipes', icon: faUtensils, label: t('recipes') },
    { path: '/profile', icon: faUser, label: t('profile') },
  ];

  const isDark = theme === 'dark';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        padding: '0 8px',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div
        style={{
          background: isDark ? colors.cardBg : '#FDFBF9',
          borderTop: `1px solid ${isDark ? '#3A2D24' : '#E8DDD0'}`,
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          padding: '4px 0',
          maxWidth: '480px',
          width: '100%',
          height: '64px',
          borderRadius: '16px 16px 0 0',
          boxShadow: isDark 
            ? '0 -4px 20px rgba(0, 0, 0, 0.3)' 
            : '0 -4px 20px rgba(60, 50, 40, 0.06)',
          transition: 'background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
          position: 'relative',
        }}
      >
        {navItems.map((item) => {
          const activeColor = isDark ? colors.primary : '#8D6E3F';
          const inactiveColor = isDark ? colors.textMuted : '#8A7A6A';
          
          if (item.isAdd) {
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end
                data-tour={item.path === '/add' ? 'tour-add' : undefined}
                style={({ isActive }) => ({
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textDecoration: 'none',
                  color: isActive ? activeColor : inactiveColor,
                  marginTop: '-28px',
                  position: 'relative',
                })}
              >
                {({ isActive }) => (
                  <>
                    <div
                      style={{
                        background: activeColor,
                        color: '#ffffff',
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px',
                        boxShadow: isActive
                          ? `0 4px 20px ${isDark ? 'rgba(200, 164, 119, 0.4)' : 'rgba(141, 110, 63, 0.5)'}`
                          : `0 4px 16px ${isDark ? 'rgba(200, 164, 119, 0.25)' : 'rgba(141, 110, 63, 0.35)'}`,
                        transition: 'all 0.3s ease',
                        transform: isActive ? 'scale(1.05)' : 'scale(1)',
                      }}
                    >
                      <FontAwesomeIcon icon={item.icon} />
                    </div>
                    <span style={{ fontSize: navLabelSize, marginTop: '2px', color: isActive ? activeColor : inactiveColor, fontWeight: isActive ? '600' : '400', transition: 'color 0.3s ease', whiteSpace: 'nowrap' }}>
                      {item.label}
                    </span>
                  </>
                )}
              </NavLink>
            );
          }

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end
              data-tour={item.path === '/storage' ? 'tour-storage' : item.path === '/recipes' ? 'tour-recipes' : item.path === '/profile' ? 'tour-profile' : undefined}
              style={({ isActive }) => ({
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textDecoration: 'none',
                color: isActive ? activeColor : inactiveColor,
                padding: '4px 8px',
                position: 'relative',
                transition: 'all 0.2s ease',
                minWidth: '48px',
                flex: 1,
              })}
            >
              {({ isActive }) => (
                <>
                  {isActive && <div style={{ position: 'absolute', top: '-6px', width: '6px', height: '6px', borderRadius: '50%', background: activeColor, transition: 'background-color 0.3s ease' }} />}
                  <FontAwesomeIcon icon={item.icon} style={{ fontSize: '20px', transform: isActive ? 'scale(1.1)' : 'scale(1)', transition: 'transform 0.2s ease' }} />
                  <span style={{ fontSize: navLabelSize, marginTop: '2px', fontWeight: isActive ? '600' : '400', transition: 'color 0.3s ease', whiteSpace: 'nowrap' }}>
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}