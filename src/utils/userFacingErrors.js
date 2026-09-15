export const withConnectionHint = (message, action = 'try again') => {
  const text = message || `Could not ${action}.`;
  return `${text} Some users may need a VPN or a different network. Please ${action} in a moment.`;
};
