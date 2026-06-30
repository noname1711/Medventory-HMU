// =========================================================
// SHARED UI KIT — mobile
// React Native port of the web's dashboard-ui.css `ui-*` classes,
// so mobile screens are composed the same way the web is and share
// the same structure (page frame -> titled sections -> stat cards,
// fields, buttons, badges, tabs).
// =========================================================
import React from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import { colors, radius, shadow, fontSize } from './tokens';
import { fontFamily } from './typography';

// ---- Page frame (web .ui-page-frame): the white titled container ----
export const PageFrame = React.memo(function PageFrame({ children, style }) {
  return <View style={[s.pageFrame, style]}>{children}</View>;
});

// ---- Page / section head (web .ui-page-head / .ui-card-header) ----
export const PageHead = React.memo(function PageHead({ title, subtitle, right }) {
  return (
    <View style={s.head}>
      <View style={{ flex: 1 }}>
        {!!title && <Text style={s.pageTitle}>{title}</Text>}
        {!!subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
});

// ---- Section / card (web .ui-section / .ui-card) ----
// `collapsible` makes the header tappable to expand/collapse the body.
export function Section({ title, subtitle, right, collapsible, defaultOpen = true, children, style }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const toggle = React.useCallback(() => setOpen((o) => !o), []);
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
        <TouchableOpacity activeOpacity={0.7} onPress={toggle}>{header}</TouchableOpacity>
      ) : header}
      {showBody && children}
    </View>
  );
}

// ---- Pagination (mobile list page nav) ----
export const Pagination = React.memo(function Pagination({ page, totalPages, onPrev, onNext }) {
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
});

// ---- Stat card (web .ui-stat-card.is-*) ----
const STAT_VARIANTS = {
  primary: { border: '#e7ebf2', accent: '#0f1c3f' },
  success: { border: '#e7ebf2', accent: '#15803d' },
  warning: { border: '#fde9c8', accent: '#b45309' },
  danger:  { border: '#fbd5d5', accent: '#b91c1c' },
  neutral: { border: '#e7ebf2', accent: colors.text },
};
export const StatCard = React.memo(function StatCard({ label, value, note, variant = 'neutral', style }) {
  const v = STAT_VARIANTS[variant] || STAT_VARIANTS.neutral;
  return (
    <View style={[s.statCard, { borderColor: v.border }, style]}>
      <Text style={[s.statValue, { color: v.accent }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
      {!!note && <Text style={[s.statNote, { color: v.accent }]}>{note}</Text>}
    </View>
  );
});

// ---- Form field (web .ui-field / .ui-label / .ui-input) ----
export const Field = React.memo(function Field({ label, help, children }) {
  return (
    <View style={s.field}>
      {!!label && <Text style={s.label}>{label}</Text>}
      {children}
      {!!help && <Text style={s.help}>{help}</Text>}
    </View>
  );
});

export const Input = React.memo(function Input(props) {
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      {...props}
      style={[s.input, props.multiline && s.textarea, props.style]}
    />
  );
});

export const Label = React.memo(function Label({ children, style }) {
  return <Text style={[s.label, style]}>{children}</Text>;
});

// ---- Button (web .ui-btn.ui-btn-*) ----
const BTN_VARIANTS = {
  primary:   { bg: colors.primary, fg: colors.white },
  secondary: { bg: '#6b7280',      fg: colors.white },
  danger:    { bg: colors.danger,  fg: colors.white },
  warning:   { bg: colors.warning, fg: colors.white },
};
export const Button = React.memo(function Button({ title, onPress, variant = 'primary', size, disabled, style, children }) {
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
});

// ---- Status / stock badge (web .ui-status-badge / .ui-stock-badge) ----
// Variants mirror what statusBadge() in status.js produces:
//   'warning'  → PENDING   (yellow)
//   'success'  → APPROVED  (green)
//   'danger'   → REJECTED  (red)
//   'info'     → default   (blue)
//   'neutral'  → fallback  (grey)
const BADGE_VARIANTS = {
  ok:       { bg: colors.successBg,  fg: colors.successText },
  success:  { bg: colors.successBg,  fg: colors.successText },
  approved: { bg: colors.successBg,  fg: colors.successText },
  warning:  { bg: colors.warningBg,  fg: colors.warningText },
  low:      { bg: colors.warningBg,  fg: colors.warningText },
  pending:  { bg: colors.warningBg,  fg: colors.warningText },
  danger:   { bg: colors.dangerBg,   fg: colors.dangerText  },
  zero:     { bg: colors.dangerBg,   fg: colors.dangerText  },
  rejected: { bg: colors.dangerBg,   fg: colors.dangerText  },
  info:     { bg: colors.infoBg,     fg: colors.infoText    },
  neutral:  { bg: '#f1f5f9',         fg: '#64748b'          },
};
export const Badge = React.memo(function Badge({ children, variant = 'info', style }) {
  const v = BADGE_VARIANTS[variant] || BADGE_VARIANTS.info;
  return (
    <View style={[s.badge, { backgroundColor: v.bg }, style]}>
      <Text style={[s.badgeText, { color: v.fg }]}>{children}</Text>
    </View>
  );
});

// ---- Segment control (prototype in-screen pill sub-nav) ----
export const SegmentControl = React.memo(function SegmentControl({ segments, active, onChange, style }) {
  return (
    <View style={[s.segmentRow, style]}>
      {segments.map((seg) => {
        const key   = typeof seg === 'string' ? seg : seg.key;
        const label = typeof seg === 'string' ? seg : seg.label;
        const on    = key === active;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => onChange(key)}
            activeOpacity={0.85}
            style={[s.segment, on && s.segmentActive]}
          >
            <Text style={[s.segmentText, on && s.segmentTextActive]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

// ---- Monospace code badge (prototype .mono code chips) ----
export const MonoBadge = React.memo(function MonoBadge({ children, style }) {
  return <Text style={[s.monoBadge, style]}>{children}</Text>;
});

// ---- Alert (web .ui-alert.is-*) ----
const ALERT_VARIANTS = {
  success: { bg: '#f0fdf4', fg: colors.successText, edge: '#22c55e' },
  error:   { bg: '#fef2f2', fg: colors.danger,      edge: colors.statRed },
  warning: { bg: '#fffbeb', fg: colors.warningText,  edge: colors.warning },
};
export const Alert = React.memo(function Alert({ children, variant = 'success' }) {
  const v = ALERT_VARIANTS[variant] || ALERT_VARIANTS.success;
  return (
    <View style={[s.alert, { backgroundColor: v.bg, borderLeftColor: v.edge }]}>
      <Text style={[s.alertText, { color: v.fg }]}>{children}</Text>
    </View>
  );
});

export const Empty = React.memo(function Empty({ children }) {
  return <Text style={s.empty}>{children}</Text>;
});

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
  pageTitle:    { fontSize: 20, fontFamily: fontFamily.black, color: colors.text },
  sectionTitle: { fontSize: fontSize.md, fontFamily: fontFamily.extrabold, color: colors.text },
  subtitle:     { marginTop: 4, color: colors.textSoft, fontSize: fontSize.sm, fontFamily: fontFamily.regular, lineHeight: 18 },
  section: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    ...shadow.soft,
    padding: 12,
    marginTop: 10,
  },
  sectionHead:          { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  sectionHeadCollapsed: { marginBottom: 0 },
  chevron: { fontSize: 16, color: colors.textSoft, paddingLeft: 4 },
  // Stat card
  statCard: {
    borderWidth: 1,
    borderRadius: 13,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.white,
  },
  statLabel: { color: colors.textSoft, fontSize: 10.5, fontFamily: fontFamily.medium, marginTop: 2 },
  statValue: { fontSize: 22, fontFamily: fontFamily.extrabold, lineHeight: 24 },
  statNote:  { marginTop: 2, fontSize: fontSize.xs, fontFamily: fontFamily.medium },
  // Field
  field: { marginBottom: 10 },
  label: { color: colors.label, fontSize: fontSize.base, fontFamily: fontFamily.bold, marginBottom: 6 },
  help:  { fontSize: fontSize.sm, color: colors.textSoft, marginTop: 4 },
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
  btn:         { minHeight: 44, borderRadius: radius.sm, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  btnSm:       { minHeight: 34, paddingHorizontal: 12 },
  btnDisabled: { opacity: 0.6 },
  btnText:     { fontSize: fontSize.base, fontFamily: fontFamily.bold },
  btnTextSm:   { fontSize: fontSize.sm },
  // Badge
  badge:     { alignSelf: 'flex-start', minWidth: 68, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.xs, alignItems: 'center' },
  badgeText: { fontSize: fontSize.sm, fontFamily: fontFamily.bold },
  // Segment control
  segmentRow:       { flexDirection: 'row', gap: 7, marginBottom: 14, flexWrap: 'wrap' },
  segment:          { paddingVertical: 8, paddingHorizontal: 18, borderRadius: 9, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  segmentActive:    { backgroundColor: colors.primary, borderColor: colors.primary },
  segmentText:      { fontSize: 13, fontFamily: fontFamily.bold, color: colors.textSoft },
  segmentTextActive: { color: colors.white },
  // Monospace code badge
  monoBadge: {
    fontSize: 11,
    color: colors.primary,
    fontFamily: fontFamily.bold,
    backgroundColor: '#eff4ff',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
  // Alert
  alert:     { padding: 14, borderRadius: radius.md, borderLeftWidth: 4, marginBottom: 12 },
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
  pagerBtn:         { minHeight: 36, paddingHorizontal: 14, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.white, justifyContent: 'center' },
  pagerBtnDisabled: { opacity: 0.45 },
  pagerText:        { fontSize: fontSize.base, fontFamily: fontFamily.bold, color: colors.primary },
  pagerTextDisabled: { color: colors.textMuted },
  pagerInfo:        { fontSize: fontSize.base, fontFamily: fontFamily.bold, color: colors.textSoft },
});

export default {
  PageFrame, PageHead, Section, StatCard, Field, Input, Label, Button, Badge,
  SegmentControl, MonoBadge, Alert, Empty, Pagination,
};
