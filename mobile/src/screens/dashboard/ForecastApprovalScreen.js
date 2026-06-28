import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { API_ENDPOINTS, buildHeaders } from '../../api/apiConfig';
import { storage } from '../../utils/storage';
import { colors, radius, fontSize } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import {
  Field,
  Input,
  Button,
  Badge,
  SegmentControl,
  MonoBadge,
  Empty,
  Pagination,
} from '../../theme/ui';

const STATUS_MAP = {
  PENDING: { label: 'Chờ duyệt', color: colors.warning, bg: colors.warningBg, variant: 'pending' },
  APPROVED: { label: 'Đã duyệt', color: colors.success, bg: colors.successBg, variant: 'approved' },
  REJECTED: { label: 'Từ chối', color: colors.danger, bg: colors.dangerBg, variant: 'rejected' },
};

const PAGE_SIZE = 8;

export default function ForecastApprovalScreen() {
  const [forecasts, setForecasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [selected, setSelected] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('PENDING');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    storage.getUser().then((u) => {
      setCurrentUser(u);
      loadForecasts(u?.id);
    });
  }, []);

  useEffect(() => {
    if (currentUser?.id) loadForecasts(currentUser.id);
  }, [filterStatus]);

  // Reset to first page whenever the status filter changes
  useEffect(() => { setPage(1); }, [filterStatus]);

  async function loadForecasts(userId) {
    setLoading(true);
    try {
      const url = `${API_ENDPOINTS.FORECASTS}?status=${filterStatus}`;
      const r = await fetch(url, { headers: buildHeaders(userId) });
      const d = await r.json();
      setForecasts(Array.isArray(d) ? d : (d?.content || []));
    } catch { setForecasts([]); }
    finally { setLoading(false); }
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await loadForecasts(currentUser?.id);
    setRefreshing(false);
  };

  const handleApprove = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      const r = await fetch(`${API_ENDPOINTS.FORECASTS}/${selected.id}/approve`, {
        method: 'POST',
        headers: buildHeaders(currentUser?.id),
        body: JSON.stringify({ approvedById: currentUser?.id }),
      });
      if (r.ok) {
        Toast.show({ type: 'success', text1: 'Đã phê duyệt phiếu dự trù!' });
        setSelected(null);
        loadForecasts(currentUser?.id);
      } else {
        const d = await r.json();
        Toast.show({ type: 'error', text1: d.error || 'Phê duyệt thất bại!' });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Lỗi kết nối server!' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selected || !rejectReason.trim()) {
      Toast.show({ type: 'error', text1: 'Vui lòng nhập lý do từ chối!' });
      return;
    }
    setActionLoading(true);
    try {
      const r = await fetch(`${API_ENDPOINTS.FORECASTS}/${selected.id}/reject`, {
        method: 'POST',
        headers: buildHeaders(currentUser?.id),
        body: JSON.stringify({ rejectedById: currentUser?.id, rejectReason }),
      });
      if (r.ok) {
        Toast.show({ type: 'success', text1: 'Đã từ chối phiếu dự trù!' });
        setSelected(null);
        setShowRejectModal(false);
        setRejectReason('');
        loadForecasts(currentUser?.id);
      } else {
        const d = await r.json();
        Toast.show({ type: 'error', text1: d.error || 'Thao tác thất bại!' });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Lỗi kết nối server!' });
    } finally {
      setActionLoading(false);
    }
  };

  // Pagination over the loaded list
  const totalPages = Math.max(1, Math.ceil(forecasts.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paged = forecasts.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  const TAB_LABELS = {
    PENDING: STATUS_MAP.PENDING.label,
    APPROVED: STATUS_MAP.APPROVED.label,
    REJECTED: STATUS_MAP.REJECTED.label,
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >

        <SegmentControl
          segments={Object.keys(STATUS_MAP).map((key) => ({ key, label: TAB_LABELS[key] }))}
          active={filterStatus}
          onChange={setFilterStatus}
        />

        <View>
          {loading ? (
            <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
          ) : forecasts.length === 0 ? (
            <Empty>Không có phiếu dự trù nào</Empty>
          ) : (
            <>
              {paged.map((item) => {
                const status = STATUS_MAP[item.status] || { label: item.status, variant: 'info' };
                const count = (item.details || []).length;
                return (
                  <Pressable key={String(item.id)} style={styles.card} onPress={() => setSelected(item)}>
                    <View style={styles.cardTop}>
                      <MonoBadge>DT #{item.id}</MonoBadge>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </View>
                    <Text style={styles.cardDept} numberOfLines={1}>
                      {item.departmentName || item.subDepartmentName || 'Phiếu dự trù'}
                    </Text>
                    <Text style={styles.cardMeta} numberOfLines={1}>
                      {item.requestedByName || item.requestedBy?.fullName || '—'}
                      {item.createdAt ? ` · ${new Date(item.createdAt).toLocaleDateString('vi-VN')}` : ''}
                      {count ? ` · ${count} vật tư` : ''}
                    </Text>
                  </Pressable>
                );
              })}
              <Pagination
                page={pageSafe}
                totalPages={totalPages}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
              />
            </>
          )}
        </View>

      {/* Chi tiết dự trù */}
      <Modal visible={!!selected} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setSelected(null)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            {selected && (
              <ScrollView>
                <Text style={styles.modalTitle}>Phiếu dự trù #{selected.id}</Text>
                {[
                  ['Người lập', selected.requestedByName || '—'],
                  ['Ngày tạo', selected.createdAt ? new Date(selected.createdAt).toLocaleDateString('vi-VN') : '—'],
                  ['Ghi chú', selected.note || '—'],
                ].map(([k, v]) => (
                  <View key={k} style={styles.infoRow}><Text style={styles.infoKey}>{k}:</Text><Text style={styles.infoVal}>{v}</Text></View>
                ))}
                <Text style={[styles.sectionLabel, { marginTop: 12 }]}>Danh sách vật tư:</Text>
                {(selected.details || []).map((d, i) => (
                  <View key={i} style={styles.detailItem}>
                    <Text style={styles.detailName}>{d.materialName}</Text>
                    <Text style={styles.detailMeta}>SL yêu cầu: {d.qtyRequested} {d.unitName || ''}</Text>
                    {d.reason && <Text style={styles.detailMeta}>Lý do: {d.reason}</Text>}
                  </View>
                ))}
                {selected.status === 'PENDING' && (
                  <View style={styles.actionRow}>
                    <Button
                      style={styles.actionBtn}
                      variant="primary"
                      title={actionLoading ? '' : '✓ Phê duyệt'}
                      onPress={handleApprove}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <ActivityIndicator color={colors.white} size="small" /> : null}
                    </Button>
                    <Button
                      style={styles.actionBtn}
                      variant="danger"
                      title="✕ Từ chối"
                      onPress={() => setShowRejectModal(true)}
                      disabled={actionLoading}
                    />
                  </View>
                )}
                <Button
                  style={{ marginTop: 12 }}
                  variant="secondary"
                  title="Đóng"
                  onPress={() => setSelected(null)}
                />
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Lý do từ chối */}
      <Modal visible={showRejectModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowRejectModal(false)}>
          <Pressable style={[styles.modalSheet, { maxHeight: '50%' }]} onPress={() => {}}>
            <Text style={styles.modalTitle}>Lý do từ chối</Text>
            <Field label="Lý do từ chối">
              <Input
                placeholder="Nhập lý do từ chối..."
                value={rejectReason}
                onChangeText={setRejectReason}
                multiline
                autoFocus
              />
            </Field>
            <Button
              variant="danger"
              title={actionLoading ? '' : 'Xác nhận từ chối'}
              onPress={handleReject}
              disabled={actionLoading}
            >
              {actionLoading ? <ActivityIndicator color={colors.white} /> : null}
            </Button>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 24, paddingHorizontal: 10 },
  centered: { justifyContent: 'center', alignItems: 'center', paddingVertical: 32 },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#e7ebf2',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  cardDept: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.text },
  cardMeta: { fontSize: 12, color: '#94a3b8', marginTop: 3 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontFamily: fontFamily.bold, color: colors.primary, marginBottom: 16, textAlign: 'center' },
  infoRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  infoKey: { fontSize: fontSize.base, color: colors.textSoft, width: 100 },
  infoVal: { fontSize: fontSize.base, color: colors.text, flex: 1, fontFamily: fontFamily.medium },
  sectionLabel: { fontSize: fontSize.base, fontFamily: fontFamily.bold, color: colors.label, marginBottom: 8 },
  detailItem: { backgroundColor: colors.bg, borderRadius: radius.sm, padding: 10, marginBottom: 8 },
  detailName: { fontSize: fontSize.base, fontFamily: fontFamily.semibold, color: colors.text, marginBottom: 4 },
  detailMeta: { fontSize: fontSize.sm, color: colors.textSoft },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  actionBtn: { flex: 1 },
});
