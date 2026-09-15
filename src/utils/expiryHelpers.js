/**
 * Get expiry status for an item
 * @param {string} expiryDate - ISO date string (YYYY-MM-DD)
 * @param {number} warningDays - Days before expiry to show warning (default: 7)
 * @returns {Object} Status object with label, color, status, daysLeft
 */
export const getExpiryStatus = (expiryDate, warningDays = 7) => {
  if (!expiryDate) {
    return { 
      label: 'No expiry', 
      color: '#8e8e93', 
      status: 'none', 
      daysLeft: null,
      shortLabel: 'None',
      isExpired: false,
      isExpiring: false,
      isUrgent: false,
    };
  }

  const now = new Date();
  const expiry = new Date(expiryDate + 'T00:00:00');
  const daysLeft = Math.ceil((expiry - now) / 86400000);

  if (daysLeft < 0) {
    return { 
      label: `Expired ${Math.abs(daysLeft)}d ago`, 
      color: '#c0392b', 
      status: 'expired',
      daysLeft: daysLeft,
      shortLabel: 'Expired',
      isExpired: true,
      isExpiring: false,
      isUrgent: false,
    };
  }
  if (daysLeft === 0) {
    return { 
      label: 'Expires today', 
      color: '#d97706', 
      status: 'today',
      daysLeft: daysLeft,
      shortLabel: 'Today',
      isExpired: false,
      isExpiring: true,
      isUrgent: true,
    };
  }
  if (daysLeft === 1) {
    return { 
      label: 'Expires tomorrow', 
      color: '#d97706', 
      status: 'tomorrow',
      daysLeft: daysLeft,
      shortLabel: 'Tomorrow',
      isExpired: false,
      isExpiring: true,
      isUrgent: true,
    };
  }
  if (daysLeft <= 3) {
    return { 
      label: `${daysLeft} days left`, 
      color: '#d97706', 
      status: 'urgent',
      daysLeft: daysLeft,
      shortLabel: `${daysLeft}d`,
      isExpired: false,
      isExpiring: true,
      isUrgent: true,
    };
  }
  if (daysLeft <= warningDays) {
    return { 
      label: `${daysLeft} days left`, 
      color: '#8d6e3f', 
      status: 'warning',
      daysLeft: daysLeft,
      shortLabel: `${daysLeft}d`,
      isExpired: false,
      isExpiring: true,
      isUrgent: false,
    };
  }
  return { 
    label: 'Fresh', 
    color: '#2d7d46', 
    status: 'fresh',
    daysLeft: daysLeft,
    shortLabel: 'Fresh',
    isExpired: false,
    isExpiring: false,
    isUrgent: false,
  };
};

/**
 * Get urgency color for an expiry date
 * @param {string} expiryDate - ISO date string (YYYY-MM-DD)
 * @returns {string} Color hex code
 */
export const getUrgencyColor = (expiryDate) => {
  if (!expiryDate) return '#8e8e93';
  const daysLeft = Math.ceil((new Date(expiryDate + 'T00:00:00') - new Date()) / 86400000);
  if (daysLeft < 0) return '#c0392b';
  if (daysLeft <= 1) return '#d97706';
  if (daysLeft <= 3) return '#d97706';
  if (daysLeft <= 7) return '#8d6e3f';
  return '#2d7d46';
};

/**
 * Check if an item needs urgent attention (within 3 days or expired)
 * @param {string} expiryDate - ISO date string (YYYY-MM-DD)
 * @returns {boolean}
 */
export const needsUrgentAttention = (expiryDate) => {
  if (!expiryDate) return false;
  const daysLeft = Math.ceil((new Date(expiryDate + 'T00:00:00') - new Date()) / 86400000);
  return daysLeft <= 3 && daysLeft >= 0;
};

/**
 * Check if an item needs attention (expiring within 7 days or expired)
 * @param {string} expiryDate - ISO date string (YYYY-MM-DD)
 * @param {number} warningDays - Days before expiry to show warning (default: 7)
 * @returns {boolean}
 */
export const needsAttention = (expiryDate, warningDays = 7) => {
  if (!expiryDate) return false;
  const daysLeft = Math.ceil((new Date(expiryDate + 'T00:00:00') - new Date()) / 86400000);
  return daysLeft <= warningDays && daysLeft >= 0;
};

/**
 * Check if an item is expired
 * @param {string} expiryDate - ISO date string (YYYY-MM-DD)
 * @returns {boolean}
 */
export const isExpired = (expiryDate) => {
  if (!expiryDate) return false;
  const daysLeft = Math.ceil((new Date(expiryDate + 'T00:00:00') - new Date()) / 86400000);
  return daysLeft < 0;
};