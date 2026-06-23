// =========================================================
// SHARED UI KIT — mobile
// React Native port of the web's dashboard-ui.css `ui-*` classes,
// so mobile screens are composed the same way the web is and share
// the same structure (page frame -> titled sections -> stat cards,
// fields, buttons, badges, tabs).
// =========================================================
import React from 'react';
import { Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import { colors, radius, shadow, fontSize } from './tokens';
import { fontFamily } from './typography';

// ---- Page frame (web .ui-page-frame): the white titled container ----
export function PageFrame({ children, style }) {
  return <View style={[s.pageFrame, style]}>{children}</View>;
}

// ---- Page / section head (web .ui-page-head / .ui-card-header) ----
export function PageHead({ title, subtitle, right }) {
  return (
    <View style={s.head}>
      <View style={{ flex: 1 }}>
        {!!title && <Text style={s.pageTitle}>{title}</Text>}
        {!!subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

// ---- Section / card (web .ui-section / .ui-card) ----
// `collapsible` makes the header tappable to expand/collapse the body.
export function Section({ title, subtitle, right, collapsible, defaultOpen = true, children, style }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const showBody = collapsible ? open : true;
  const hasHeader = title || right || collapsible;

  const header = hasHeader ? (
    <View style={[s.sectionHead, !showBody && s.sectionHeadCollapsed]}>
      <View style={{ flex: 1 }}>
        {!!title && <Text style={s.sectionTitle}>{title}</Text>}
        {!!subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
      </View>
      {collapsible ? <Text style={s.chevron}>{open ? '▾' : '▸'}</Text> : right}
    </View>
  ) : null;

  return (
    <View style={[s.section, style]}>
      {collapsible ? (
        <TouchableOpacity activeOpacity={0.7} onPress={() => setOpen((o) => !o)}>{header}</TouchableOpacity>
      ) : header}
      {showBody && children}
    </View>
  );
}

// ---- Pagination (mobile list page nav) ----
export function Pagination({ page, totalPages, onPrev, onNext }) {
  if (totalPages <= 1) return null;
  return (
    <View style={s.pager}>
      <TouchableOpacity onPress={onPrev} disabled={page <= 1}
        style={[s.pagerBtn, page <= 1 && s.pagerBtnDisabled]}>
        <Text style={[s.pagerText, page <= 1 && s.pagerTextDisabled]}>‹ Trước</Text>
      </TouchableOpacity>
      <Text style={s.pagerInfo}>Trang {page}/{totalPages}</Text>
      <TouchableOpacity onPress={onNext} disabled={page >= totalPages}
        style={[s.pagerBtn, page >= totalPages && s.pagerBtnDisabled]}>
        <Text style={[s.pagerText, page >= totalPages && s.pagerTextDisabled]}>Sau ›</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---- Stat card (web .ui-stat-card.is-*) ----
const STAT_VARIANTS = {
  primary: { border: 'rgba(30,64,175,0.18)', tint: '#eff6ff', accent: colors.primary },
  success: { border: 'rgba(22,163,74,0.18)', tint: '#f0fdf4', accent: colors.success },
  warning: { border: 'rgba(217,119,6,0.18)', tint: '#fffbeb', accent: colors.warning },
  danger: { border: 'rgba(220,38,38,0.18)', tint: '#fef2f2', accent: colors.danger },
  neutral: { border: colors.border, tint: '#f8fbff', accent: colors.text },
};
export function StatCard({ label, value, note, variant = 'neutral', style }) {
  const v = STAT_VARIANTS[variant] || STAT_VARIANTS.neutral;
  return (
    <View style={[s.statCard, { borderColor: v.border, backgroundColor: v.tint }, style]}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, { color: v.accent }]}>{value}</Text>
      {!!note && <Text style={[s.statNote, { color: v.accent }]}>{note}</Text>}
    </View>
  );
}

// ---- Form field (web .ui-field / .ui-label / .ui-input) ----
export function Field({ label, help, children }) {
  return (
    <View style={s.field}>
      {!!label && <Text style={s.label}>{label}</Text>}
      {children}
      {!!help && <Text style={s.help}>{help}</Text>}
    </View>
  );
}

export function Input(props) {
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      {...props}
      style={[s.input, props.multiline && s.textarea, props.style]}
    />
  );
}

export function Label({ children, style }) {
  return <Text style={[s.label, style]}>{children}</Text>;
}

// ---- Button (web .ui-btn.ui-btn-*) ----
const BTN_VARIANTS = {
  primary: { bg: colors.primary, fg: colors.white },
  secondary: { bg: '#6b7280', fg: colors.white },
  danger: { bg: colors.danger, fg: colors.white },
  warning: { bg: colors.warning, fg: colors.white },
};
export function Button({ title, onPress, variant = 'primary', size, disabled, style, children }) {
  const v = BTN_VARIANTS[variant] || BTN_VARIANTS.primary;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[
        s.btn,
        size === 'sm' && s.btnSm,
        { backgroundColor: v.bg },
        disabled && s.btnDisabled,
        style,
      ]}
    >
      {children || <Text style={[s.btnText, size === 'sm' && s.btnTextSm, { color: v.fg }]}>{title}</Text>}
    </TouchableOpacity>
  );
}

// ---- Status / stock badge (web .ui-status-badge / .ui-stock-badge) ----
const BADGE_VARIANTS = {
  ok: { bg: colors.successBg, fg: colors.successText },
  approved: { bg: colors.successBg, fg: colors.successText },
  low: { bg: colors.warningBg, fg: colors.warningText },
  pending: { bg: colors.warningBg, fg: colors.warningText },
  zero: { bg: colors.dangerBg, fg: colors.dangerText },
  danger: { bg: colors.dangerBg, fg: colors.dangerText },
  rejected: { bg: colors.dangerBg, fg: colors.dangerText },
  info: { bg: colors.infoBg, fg: colors.infoText },
};
export function Badge({ children, variant = 'info', style }) {
  const v = BADGE_VARIANTS[variant] || BADGE_VARIANTS.info;
  return (
    <View style={[s.badge, { backgroundColor: v.bg }, style]}>
      <Text style={[s.badgeText, { color: v.fg }]}>{children}</Text>
    </View>
  );
}

// ---- Tabs (web .ui-tabs / .ui-tab.is-active) ----
export function Tabs({ tabs, active, onChange }) {
  return (
    <View style={s.tabs}>
      {tabs.map((t) => {
        const key = typeof t === 'string' ? t : t.key;
        const label = typeof t === 'string' ? t : t.label;
        const on = key === active;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => onChange(key)}
            activeOpacity={0.8}
            style={[s.tab, on && s.tabActive]}
          >
            <Text style={[s.tabText, on && s.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ---- Alert (web .ui-alert.is-*) ----
const ALERT_VARIANTS = {
  success: { bg: '#f0fdf4', fg: colors.successText, edge: '#22c55e' },
  error: { bg: '#fef2f2', fg: colors.danger, edge: colors.statRed },
  warning: { bg: '#fffbeb', fg: colors.warningText, edge: colors.warning },
};
export function Alert({ children, variant = 'success' }) {
  const v = ALERT_VARIANTS[variant] || ALERT_VARIANTS.success;
  return (
    <View style={[s.alert, { backgroundColor: v.bg, borderLeftColor: v.edge }]}>
      <Text style={[s.alertText, { color: v.fg }]}>{children}</Text>
    </View>
  );
}

export function Empty({ children }) {
  return <Text style={s.empty}>{children}</Text>;
}

const s = StyleSheet.create({
  pageFrame: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    ...shadow.card,
    padding: 12,
    margin: 10,
  },
  head: { marginBottom: 10 },
  pageTitle: { fontSize: 20, fontFamily: fontFamily.black, color: colors.text },
  sectionTitle: { fontSize: fontSize.md, fontFamily: fontFamily.extrabold, color: colors.text },
  subtitle: { marginTop: 4, color: colors.textSoft, fontSize: fontSize.sm, fontFamily: fontFamily.regular, lineHeight: 18 },
  section: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    ...shadow.soft,
    padding: 12,
    marginTop: 10,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  sectionHeadCollapsed: { marginBottom: 0 },
  chevron: { fontSize: 16, color: colors.textSoft, paddingLeft: 4 },
  // Stat — compact
  statCard: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  statLabel: { color: colors.textSoft, fontSize: fontSize.sm, fontFamily: fontFamily.bold },
  statValue: { marginTop: 4, fontSize: 22, fontFamily: fontFamily.black, lineHeight: 26 },
  statNote: { marginTop: 4, fontSize: fontSize.xs, fontFamily: fontFamily.medium },
  // Field
  field: { marginBottom: 10 },
  label: { color: colors.label, fontSize: fontSize.base, fontFamily: fontFamily.bold, marginBottom: 6 },
  help: { fontSize: fontSize.sm, color: colors.textSoft, marginTop: 4 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.white,
    color: colors.text,
    fontSize: fontSize.base,
    fontFamily: fontFamily.regular,
  },
  textarea: { minHeight: 96, textAlignVertical: 'top' },
  // Button
  btn: { minHeight: 44, borderRadius: radius.sm, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  btnSm: { minHeight: 34, paddingHorizontal: 12 },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: fontSize.base, fontFamily: fontFamily.bold },
  btnTextSm: { fontSize: fontSize.sm },
  // Badge
  badge: { alignSelf: 'flex-start', minWidth: 68, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.xs, alignItems: 'center' },
  badgeText: { fontSize: fontSize.sm, fontFamily: fontFamily.bold },
  // Tabs
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  tab: {
    minHeight: 38,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    justifyContent: 'center',
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: fontSize.base, fontFamily: fontFamily.bold, color: colors.textSoft },
  tabTextActive: { color: colors.white },
  // Alert
  alert: { padding: 14, borderRadius: radius.md, borderLeftWidth: 4, marginBottom: 12 },
  alertText: { fontFamily: fontFamily.bold, fontSize: fontSize.base },
  // Empty
  empty: { textAlign: 'center', color: colors.textSoft, paddingVertical: 32, fontSize: fontSize.base, lineHeight: 22 },
  // Pagination
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pagerBtn: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.white,
    justifyContent: 'center',
  },
  pagerBtnDisabled: { opacity: 0.45 },
  pagerText: { fontSize: fontSize.base, fontFamily: fontFamily.bold, color: colors.primary },
  pagerTextDisabled: { color: colors.textMuted },
  pagerInfo: { fontSize: fontSize.base, fontFamily: fontFamily.bold, color: colors.textSoft },
});

export default {
  PageFrame, PageHead, Section, StatCard, Field, Input, Label, Button, Badge, Tabs, Alert, Empty,
};
