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
  Section,
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
  PENDING: { label: 'Chờ duyệt', variant: 'pending' },
  APPROVED: { label: 'Đã duyệt', variant: 'approved' },
  REJECTED: { label: 'Từ chối', variant: 'rejected' },
};

const PAGE_SIZE = 8;

export default function IssueRequestApprovalScreen() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [selected, setSelected] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('PENDING');
  const [page, setPage] = useState(1);

  useEffect(() => {
    storage.getUser().then((u) => {
      setCurrentUser(u);
      loadRequests(u?.id);
    });
  }, []);

  async function loadRequests(userId) {
    setLoading(true);
    try {
      const url = `${API_ENDPOINTS.ISSUE_REQUESTS}?status=${filterStatus}`;
      const r = await fetch(url, { headers: buildHeaders(userId) });
      const d = await r.json();
      setRequests(Array.isArray(d) ? d : (d?.content || []));
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (currentUser?.id) loadRequests(currentUser.id);
  }, [filterStatus]);

  // Pagination — reset to page 1 whenever the filter changes
  useEffect(() => { setPage(1); }, [filterStatus]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRequests(currentUser?.id);
    setRefreshing(false);
  };

  const handleApprove = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      const r = await fetch(`${API_ENDPOINTS.ISSUE_REQUESTS}/${selected.id}/approve`, {
        method: 'POST',
        headers: buildHeaders(currentUser?.id),
        body: JSON.stringify({ approvedById: currentUser?.id }),
      });
      if (r.ok) {
        Toast.show({ type: 'success', text1: 'Đã phê duyệt phiếu xin lĩnh!' });
        setSelected(null);
        loadRequests(currentUser?.id);
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
      const r = await fetch(`${API_ENDPOINTS.ISSUE_REQUESTS}/${selected.id}/reject`, {
        method: 'POST',
        headers: buildHeaders(currentUser?.id),
        body: JSON.stringify({ rejectedById: currentUser?.id, rejectReason }),
      });
      if (r.ok) {
        Toast.show({ type: 'success', text1: 'Đã từ chối phiếu xin lĩnh!' });
        setSelected(null);
        setShowRejectModal(false);
        setRejectReason('');
        loadRequests(currentUser?.id);
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

  // KPI summary (web .ui-stat-grid)
  const total = requests.length;
  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;
  const processedCount = requests.filter((r) => r.status === 'APPROVED' || r.status === 'REJECTED').length;

  // Pagination over the current list
  const totalPages = Math.max(1, Math.ceil(requests.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paged = requests.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  const renderCard = (item) => {
    const status = STATUS_MAP[item.status] || { label: item.status, variant: 'info' };
    const count = (item.details || []).length;
    return (
      <Pressable key={String(item.id)} style={styles.card} onPress={() => setSelected(item)}>
        <View style={styles.cardTop}>
          <MonoBadge>#{item.id}</MonoBadge>
          <Badge variant={status.variant}>{status.label}</Badge>
        </View>
        <Text style={styles.cardDept} numberOfLines={1}>
          {item.subDepartmentName || item.subDepartment?.name || '—'}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {item.requestedByName || item.requestedBy?.fullName || '—'}
          {count ? ` · ${count} vật tư` : ''}
          {item.createdAt ? ` · ${new Date(item.createdAt).toLocaleDateString('vi-VN')}` : ''}
        </Text>
      </Pressable>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >

        {/* Status filter — segment pills */}
        <SegmentControl
          segments={Object.entries(STATUS_MAP).map(([key, val]) => ({ key, label: val.label }))}
          active={filterStatus}
          onChange={setFilterStatus}
        />

        {/* Requests list — cards */}
        <View>
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : requests.length === 0 ? (
            <Empty>Không có phiếu nào</Empty>
          ) : (
            <>
              {paged.map(renderCard)}
              <Pagination
                page={pageSafe}
                totalPages={totalPages}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
              />
            </>
          )}
        </View>

      {/* Detail + Action Modal */}
      <Modal visible={!!selected} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setSelected(null)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            {selected && (
              <ScrollView>
                <Text style={styles.modalTitle}>Chi tiết phiếu #{selected.id}</Text>

                <Section title="Thông tin chung">
                  {[
                    ['Phòng/Khoa', selected.subDepartmentName || '—'],
                    ['Người tạo', selected.requestedByName || '—'],
                    ['Ngày tạo', selected.createdAt ? new Date(selected.createdAt).toLocaleDateString('vi-VN') : '—'],
                    ['Ghi chú', selected.note || '—'],
                  ].map(([key, val]) => (
                    <View key={key} style={styles.infoRow}>
                      <Text style={styles.infoKey}>{key}:</Text>
                      <Text style={styles.infoVal}>{val}</Text>
                    </View>
                  ))}
                </Section>

                <Section title="Danh sách vật tư">
                  {(selected.details || []).map((d, i) => (
                    <View key={i} style={styles.detailItem}>
                      <Text style={styles.detailName}>{d.materialName || `Vật tư #${i + 1}`}</Text>
                      <Text style={styles.detailMeta}>SL: {d.qtyRequested} {d.unitName || ''}</Text>
                      {d.specification ? <Text style={styles.detailMeta}>Quy cách: {d.specification}</Text> : null}
                    </View>
                  ))}
                </Section>

                {selected.status === 'PENDING' && (
                  <View style={styles.actionRow}>
                    <Button
                      title="✓ Phê duyệt"
                      variant="primary"
                      onPress={handleApprove}
                      disabled={actionLoading}
                      style={styles.actionBtn}
                    >
                      {actionLoading ? <ActivityIndicator color={colors.white} size="small" /> : null}
                    </Button>
                    <Button
                      title="✕ Từ chối"
                      variant="danger"
                      onPress={() => setShowRejectModal(true)}
                      disabled={actionLoading}
                      style={styles.actionBtn}
                    />
                  </View>
                )}

                <Button
                  title="Đóng"
                  variant="secondary"
                  onPress={() => setSelected(null)}
                  style={{ marginTop: 12 }}
                />
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Reject reason modal */}
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
              title="Xác nhận từ chối"
              variant="danger"
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
  centered: { justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  // Request cards (prototype)
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
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontFamily: fontFamily.bold, color: colors.primary, marginBottom: 16, textAlign: 'center' },
  infoRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  infoKey: { fontSize: fontSize.sm, color: colors.textSoft, width: 100 },
  infoVal: { fontSize: fontSize.sm, color: colors.text, flex: 1, fontFamily: fontFamily.medium },
  detailItem: { backgroundColor: colors.bg, borderRadius: radius.md, padding: 10, marginBottom: 8 },
  detailName: { fontSize: fontSize.base, fontFamily: fontFamily.semibold, color: colors.text, marginBottom: 4 },
  detailMeta: { fontSize: fontSize.sm, color: colors.textSoft },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  actionBtn: { flex: 1 },
});
