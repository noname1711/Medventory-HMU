import React from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { colors, radius, shadow, fontSize, spacing } from '../theme/tokens';
import { fontFamily } from '../theme/typography';
import { Empty } from '../theme/ui';

/**
 * DetailModal — read-only detail view.
 *
 * Props:
 *   visible   {boolean}
 *   title     {string}               — modal header title
 *   info      {Array<{label,value}>} — key-value info block shown above the table
 *   columns   {Array<{key,label}>}   — table column definitions
 *   rows      {Array<object>}        — table row data (each row keyed by column.key)
 *   onClose   {function}
 *   footer    {ReactNode}            — optional node pinned at the bottom of the sheet (e.g. action buttons)
 */
export default function DetailModal({ visible, title, info = [], columns = [], rows = [], onClose, footer }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* ── Header ── */}
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={2}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>Đóng</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            {/* ── Info block ── */}
            {info.length > 0 && (
              <View style={styles.infoBlock}>
                {info.map(({ label, value }, idx) => (
                  <View key={idx} style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{label}</Text>
                    <Text style={styles.infoValue}>{value ?? '—'}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* ── Line table ── */}
            {columns.length > 0 && (
              <View style={styles.tableSection}>
                {/* Table header */}
                <View style={styles.tableHead}>
                  {columns.map((col) => (
                    <Text key={col.key} style={[styles.thCell, { flex: col.flex ?? 1 }]}>
                      {col.label}
                    </Text>
                  ))}
                </View>

                {/* Table rows */}
                {rows.length === 0 ? (
                  <Empty>Không có dữ liệu</Empty>
                ) : (
                  rows.map((row, idx) => (
                    <View key={idx} style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}>
                      {columns.map((col) => (
                        <Text key={col.key} style={[styles.tdCell, { flex: col.flex ?? 1 }]}>
                          {col.key === 'stt' ? String(idx + 1) : (row[col.key] ?? '—')}
                        </Text>
                      ))}
                    </View>
                  ))
                )}
              </View>
            )}
          </ScrollView>

          {/* ── Optional footer (e.g. action buttons) pinned inside the sheet ── */}
          {footer != null && (
            <View style={styles.footer}>
              {footer}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    ...shadow.card,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    flex: 1,
    fontSize: fontSize.md,
    fontFamily: fontFamily.extrabold,
    color: colors.text,
    marginRight: spacing.md,
  },
  closeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
  },
  closeText: {
    color: colors.primary,
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
  },

  // ── Body ──
  body: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  // ── Footer ──
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },

  // ── Info block ──
  infoBlock: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  infoLabel: {
    width: 120,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bold,
    color: colors.textSoft,
    flexShrink: 0,
  },
  infoValue: {
    flex: 1,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    color: colors.text,
    flexWrap: 'wrap',
  },

  // ── Table ──
  tableSection: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: colors.primarySoft,
    paddingVertical: 9,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  thCell: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bold,
    color: colors.primary,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 9,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  tableRowAlt: {
    backgroundColor: '#f8fafc',
  },
  tdCell: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: colors.text,
  },
});
