import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { API_ENDPOINTS } from '../../api/apiConfig';
import { apiGet, apiSend } from '../../api/apiClient';
import { useAuth } from '../../context/AuthContext';
import DetailModal from '../../components/DetailModal';
import { colors, radius, fontSize } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import {
  Section,
  StatCard,
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

const SEGMENTS = [
  { key: 'pending', label: 'Chờ duyệt' },
  { key: 'processed', label: 'Đã xử lý' },
];

function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d) ? String(s) : d.toLocaleDateString('vi-VN');
}

export default function IssueRequestApprovalScreen() {
  const { user } = useAuth();

  // Data for each tab
  const [pendingRequests, setPendingRequests] = useState([]);
  const [processedRequests, setProcessedRequests] = useState([]);

  // Stat counts from API response
  const [stats, setStats] = useState({ pendingCount: 0, approvedCount: 0, rejectedCount: 0 });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Segment: 'pending' | 'processed'
  const [activeTab, setActiveTab] = useState('pending');
  const [page, setPage] = useState(1);

  // Detail modal
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Reject note modal (inline via Field+Input in detail modal footer)
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // ─── Fetch both tabs ───────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [pendingRes, processedRes] = await Promise.all([
        apiGet(API_ENDPOINTS.ISSUE_REQ_LEADER_PENDING, user.id),
        apiGet(API_ENDPOINTS.ISSUE_REQ_LEADER_PROCESSED, user.id),
      ]);

      if (pendingRes.ok && pendingRes.data?.success) {
        setPendingRequests(pendingRes.data.requests || []);
        setStats((prev) => ({ ...prev, pendingCount: pendingRes.data.pendingCount ?? 0 }));
      } else {
        setPendingRequests([]);
      }

      if (processedRes.ok && processedRes.data?.success) {
        setProcessedRequests(processedRes.data.requests || []);
        setStats((prev) => ({
          ...prev,
          approvedCount: processedRes.data.approvedCount ?? 0,
          rejectedCount: processedRes.data.rejectedCount ?? 0,
        }));
      } else {
        setProcessedRequests([]);
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Lỗi kết nối server!' });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Refetch only the active tab (after approve/reject)
  const refetchActiveTab = useCallback(async () => {
    if (!user?.id) return;
    try {
      if (activeTab === 'pending') {
        const res = await apiGet(API_ENDPOINTS.ISSUE_REQ_LEADER_PENDING, user.id);
        if (res.ok && res.data?.success) {
          setPendingRequests(res.data.requests || []);
          setStats((prev) => ({ ...prev, pendingCount: res.data.pendingCount ?? 0 }));
        }
      } else {
        const res = await apiGet(API_ENDPOINTS.ISSUE_REQ_LEADER_PROCESSED, user.id);
        if (res.ok && res.data?.success) {
          setProcessedRequests(res.data.requests || []);
          setStats((prev) => ({
            ...prev,
            approvedCount: res.data.approvedCount ?? 0,
            rejectedCount: res.data.rejectedCount ?? 0,
          }));
        }
      }
    } catch {
      // silent
    }
  }, [user?.id, activeTab]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Reset page when tab changes
  useEffect(() => { setPage(1); }, [activeTab]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  // ─── Row tap → load detail ─────────────────────────────────────────────────
  const handleRowPress = async (item) => {
    setDetailData({ header: item, details: item.details || [] });
    setDetailVisible(true);
    setShowRejectInput(false);
    setRejectNote('');

    if (!user?.id) return;
    setDetailLoading(true);
    try {
      const res = await apiGet(API_ENDPOINTS.ISSUE_REQ_DETAIL(item.id), user.id);
      if (res.ok && res.data?.success) {
        setDetailData(res.data);
      }
    } catch {
      // keep the snapshot data
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailVisible(false);
    setDetailData(null);
    setShowRejectInput(false);
    setRejectNote('');
  };

  // ─── Approve ───────────────────────────────────────────────────────────────
  const handleApprove = async () => {
    const id = detailData?.header?.id ?? detailData?.id;
    if (!id) return;
    setActionLoading(true);
    try {
      const res = await apiSend('POST', API_ENDPOINTS.ISSUE_REQ_APPROVE(id), { note: '' }, user.id);
      if (res.ok) {
        Toast.show({ type: 'success', text1: 'Đã phê duyệt phiếu xin lĩnh!' });
        closeDetail();
        await refetchActiveTab();
      } else {
        const msg = res.data?.message || res.data?.error || 'Phê duyệt thất bại!';
        Toast.show({ type: 'error', text1: msg });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Lỗi kết nối server!' });
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Reject ────────────────────────────────────────────────────────────────
  const handleReject = async () => {
    if (!rejectNote.trim()) {
      Toast.show({ type: 'error', text1: 'Vui lòng nhập lý do từ chối!' });
      return;
    }
    const id = detailData?.header?.id ?? detailData?.id;
    if (!id) return;
    setActionLoading(true);
    try {
      const res = await apiSend('POST', API_ENDPOINTS.ISSUE_REQ_REJECT(id), { note: rejectNote.trim() }, user.id);
      if (res.ok) {
        Toast.show({ type: 'success', text1: 'Đã từ chối phiếu xin lĩnh!' });
        closeDetail();
        await refetchActiveTab();
      } else {
        const msg = res.data?.message || res.data?.error || 'Thao tác thất bại!';
        Toast.show({ type: 'error', text1: msg });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Lỗi kết nối server!' });
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Current list + pagination ────────────────────────────────────────────
  const requests = activeTab === 'pending' ? pendingRequests : processedRequests;
  const totalPages = Math.max(1, Math.ceil(requests.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paged = requests.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  // ─── DetailModal props ─────────────────────────────────────────────────────
  const header = detailData?.header || detailData || {};
  const statusLabel = STATUS_MAP[header.status]?.label || header.statusName || header.status || '—';
  const detailInfo = [
    { label: 'Mã phiếu', value: header.id ? `#${header.id}` : '—' },
    { label: 'Người tạo', value: header.createdByName || header.requestedByName || '—' },
    { label: 'Khoa/Bộ môn', value: header.departmentName || header.subDepartmentName || '—' },
    { label: 'Ngày tạo', value: fmtDate(header.requestedAt || header.createdAt) },
    { label: 'Trạng thái', value: statusLabel },
    ...(header.note ? [{ label: 'Ghi chú', value: header.note }] : []),
  ];

  const detailColumns = [
    { key: 'materialCode', label: 'Mã', flex: 0.8 },
    { key: 'materialName', label: 'Tên vật tư', flex: 2 },
    { key: 'unitName', label: 'ĐVT', flex: 0.7 },
    { key: 'qtyRequested', label: 'SL', flex: 0.6 },
  ];

  const detailRows = (detailData?.details || []).map((d) => ({
    materialCode: d.materialCode || '—',
    materialName: d.materialName || '—',
    unitName: d.unitName || '—',
    qtyRequested: String(d.qtyRequested ?? '—'),
  }));

  const isPendingHeader = header.status === 'PENDING' ||
    (typeof header.status === 'number' && header.status === 0) ||
    String(header.statusBadge || '').toLowerCase().includes('pending');

  // ─── Card renderer ────────────────────────────────────────────────────────
  const renderCard = (item) => {
    const status = STATUS_MAP[item.status] || { label: item.statusName || item.status, variant: 'neutral' };
    const count = (item.details || []).length;
    return (
      <Pressable key={String(item.id)} style={styles.card} onPress={() => handleRowPress(item)}>
        <View style={styles.cardTop}>
          <MonoBadge>#{item.id}</MonoBadge>
          <Badge variant={status.variant}>{status.label}</Badge>
        </View>
        <Text style={styles.cardDept} numberOfLines={1}>
          {item.departmentName || item.subDepartmentName || '—'}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {item.createdByName || item.requestedByName || '—'}
          {count ? ` · ${count} vật tư` : ''}
          {item.requestedAt || item.createdAt
            ? ` · ${fmtDate(item.requestedAt || item.createdAt)}`
            : ''}
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
      {/* Stat cards */}
      <View style={styles.statRow}>
        <StatCard label="Chờ duyệt" value={stats.pendingCount} variant="warning" style={styles.stat} />
        <StatCard label="Đã duyệt" value={stats.approvedCount} variant="success" style={styles.stat} />
        <StatCard label="Từ chối" value={stats.rejectedCount} variant="danger" style={styles.stat} />
      </View>

      {/* Segment */}
      <SegmentControl
        segments={SEGMENTS}
        active={activeTab}
        onChange={setActiveTab}
      />

      {/* List */}
      <View>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : requests.length === 0 ? (
          <Empty>
            {activeTab === 'pending' ? 'Không có phiếu nào chờ duyệt' : 'Chưa có lịch sử phê duyệt'}
          </Empty>
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

      {/* Detail modal */}
      <DetailModal
        visible={detailVisible}
        title={header.id ? `Chi tiết phiếu #${header.id}` : 'Chi tiết phiếu'}
        info={detailInfo}
        columns={detailColumns}
        rows={detailRows}
        onClose={closeDetail}
        footer={isPendingHeader ? (
          detailLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : showRejectInput ? (
            <>
              <Field label="Lý do từ chối">
                <Input
                  placeholder="Nhập lý do từ chối..."
                  value={rejectNote}
                  onChangeText={setRejectNote}
                  multiline
                />
              </Field>
              <View style={styles.actionRow}>
                <Button
                  title="Xác nhận từ chối"
                  variant="danger"
                  onPress={handleReject}
                  disabled={actionLoading}
                  style={styles.actionBtn}
                />
                <Button
                  title="Hủy"
                  variant="secondary"
                  onPress={() => { setShowRejectInput(false); setRejectNote(''); }}
                  disabled={actionLoading}
                  style={styles.actionBtn}
                />
              </View>
            </>
          ) : (
            <View style={styles.actionRow}>
              <Button
                title="✓ Phê duyệt"
                variant="primary"
                onPress={handleApprove}
                disabled={actionLoading}
                style={styles.actionBtn}
              />
              <Button
                title="✕ Từ chối"
                variant="danger"
                onPress={() => setShowRejectInput(true)}
                disabled={actionLoading}
                style={styles.actionBtn}
              />
            </View>
          )
        ) : undefined}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 24, paddingHorizontal: 10 },
  centered: { justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },

  // Stat row
  statRow: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 8 },
  stat: { flex: 1 },

  // Request cards
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

  actionRow: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1 },
});
