// =========================================================
// SHARED DESIGN TOKENS — mobile
// Ported 1:1 from the web design system (frontend dashboard-ui.css :root)
// so the mobile app stays visually in sync with the web UI.
// Single source of truth: change a value here, every screen follows.
// =========================================================

export const colors = {
  // Brand
  primary: '#1e40af',
  primaryHover: '#1e3a8a',
  primarySoft: '#dbeafe',

  // Text
  text: '#1e293b',
  textSoft: '#64748b',
  textMuted: '#9ca3af',
  label: '#374151',

  // Surfaces & borders
  border: '#e2e8f0',
  borderSoft: '#f3f4f6',
  borderStrong: '#d1d5db',
  bg: '#eef1f6',
  white: '#ffffff',

  // Auth page background (web .auth-page)
  authBg: '#eef1f6',

  // Focus ring
  focus: '#3b82f6',

  // Semantic
  success: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',

  // Status / badge backgrounds & text (web .ui-status-badge / .ui-alert)
  successBg: '#dcfce7',
  successText: '#166534',
  warningBg: '#fef3c7',
  warningText: '#92400e',
  dangerBg: '#fee2e2',
  dangerText: '#991b1b',
  infoBg: '#dbeafe',
  infoText: '#1e40af',

  // Stat card accents (web .ui-stat-*)
  statBlue: '#2563eb',
  statGreen: '#059669',
  statYellow: '#f59e0b',
  statRed: '#ef4444',
};

// Border radius scale (web --ui-radius-*)
export const radius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  pill: 999,
};

// Spacing scale (consistent with web paddings)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

// React Native shadow presets (approximate web box-shadows)
export const shadow = {
  // --ui-shadow-soft: 0 1px 3px rgba(0,0,0,0.1)
  soft: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  // --ui-shadow: 0 4px 14px rgba(15,23,42,0.06)
  card: {
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  // Auth card: 0 4px 24px rgba(30,64,175,0.1)
  auth: {
    shadowColor: '#1e40af',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
};

// Typography — font family is resolved at runtime (see theme/typography.js).
// Sizes mirror the web rem scale (1rem = 16px baseline).
export const fontSize = {
  xs: 11,
  sm: 12,
  base: 14,
  md: 15,
  lg: 18,
  xl: 23, // ~1.45rem page/card titles
  stat: 32, // ~2rem stat values
};

export default { colors, radius, spacing, shadow, fontSize };
