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
import { normaliseStatus, statusBadge } from '../../utils/status';
import DetailModal from '../../components/DetailModal';
import { colors, radius, fontSize } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import {
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
  PENDING:  { label: 'Chờ duyệt', variant: 'warning' },
  APPROVED: { label: 'Đã duyệt',  variant: 'success' },
  REJECTED: { label: 'Từ chối',   variant: 'danger'  },
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


export default function ForecastApprovalScreen() {
  const { user } = useAuth();

  const [pendingList, setPendingList] = useState([]);
  const [processedList, setProcessedList] = useState([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [activeTab, setActiveTab] = useState('pending');
  const [page, setPage] = useState(1);

  // Detail modal
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Approve / Reject state
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // ─── Fetch stats ────────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    if (!user?.id) return;
    const res = await apiGet(`${API_ENDPOINTS.SUPP_FORECAST_BGH_STATS}?bghId=${user.id}`, user.id);
    if (res.ok && res.data) {
      const d = res.data;
      setStats({
        pending: d.pending ?? d.pendingCount ?? 0,
        approved: d.approved ?? d.approvedCount ?? 0,
        rejected: d.rejected ?? d.rejectedCount ?? 0,
        total: d.total ?? d.totalCount ?? 0,
      });
    }
  }, [user?.id]);

  // ─── Fetch lists ─────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [pendingRes, processedRes] = await Promise.all([
        apiGet(`${API_ENDPOINTS.SUPP_FORECAST_BGH_PENDING}?bghId=${user.id}`, user.id),
        apiGet(`${API_ENDPOINTS.SUPP_FORECAST_BGH_PROCESSED}?bghId=${user.id}`, user.id),
      ]);

      const extract = (res) => {
        if (!res.ok || !res.data) return [];
        const d = res.data;
        if (Array.isArray(d)) return d;
        if (Array.isArray(d.items)) return d.items;
        if (Array.isArray(d.content)) return d.content;
        if (Array.isArray(d.data)) return d.data;
        return [];
      };

      setPendingList(extract(pendingRes));
      setProcessedList(extract(processedRes));
      await fetchStats();
    } catch {
      Toast.show({ type: 'error', text1: 'Lỗi kết nối server!' });
    } finally {
      setLoading(false);
    }
  }, [user?.id, fetchStats]);

  // Refetch active tab only (after action)
  const refetchActive = useCallback(async () => {
    if (!user?.id) return;
    try {
      const url =
        activeTab === 'pending'
          ? `${API_ENDPOINTS.SUPP_FORECAST_BGH_PENDING}?bghId=${user.id}`
          : `${API_ENDPOINTS.SUPP_FORECAST_BGH_PROCESSED}?bghId=${user.id}`;
      const res = await apiGet(url, user.id);
      const extract = (r) => {
        if (!r.ok || !r.data) return [];
        const d = r.data;
        if (Array.isArray(d)) return d;
        if (Array.isArray(d.items)) return d.items;
        if (Array.isArray(d.content)) return d.content;
        if (Array.isArray(d.data)) return d.data;
        return [];
      };
      if (activeTab === 'pending') setPendingList(extract(res));
      else setProcessedList(extract(res));
      await fetchStats();
    } catch {
      // silent
    }
  }, [user?.id, activeTab, fetchStats]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
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
      const res = await apiGet(`${API_ENDPOINTS.SUPP_FORECAST_DETAIL(item.id)}?userId=${user.id}`, user.id);
      if (res.ok && res.data) {
        // The detail endpoint may return the object directly or wrapped
        const d = res.data;
        const header = d.id ? d : (d.forecast || d.header || item);
        const details = Array.isArray(d.details) ? d.details : (Array.isArray(d) ? [] : []);
        setDetailData({ header, details });
      }
    } catch {
      // keep snapshot
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
      const body = {
        forecastId: id,
        action: 1,
        note: 'Đã phê duyệt',
        approverId: user.id,
      };
      const res = await apiSend('POST', API_ENDPOINTS.SUPP_FORECAST_APPROVE, body, user.id);
      if (res.ok) {
        Toast.show({ type: 'success', text1: 'Đã phê duyệt phiếu dự trù!' });
        closeDetail();
        await refetchActive();
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
      const body = {
        forecastId: id,
        action: 2,
        note: rejectNote.trim(),
        approverId: user.id,
      };
      const res = await apiSend('POST', API_ENDPOINTS.SUPP_FORECAST_APPROVE, body, user.id);
      if (res.ok) {
        Toast.show({ type: 'success', text1: 'Đã từ chối phiếu dự trù!' });
        closeDetail();
        await refetchActive();
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

  // ─── Pagination ────────────────────────────────────────────────────────────
  const list = activeTab === 'pending' ? pendingList : processedList;
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paged = list.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  // ─── DetailModal props ─────────────────────────────────────────────────────
  const header = detailData?.header || detailData || {};
  const normStatus = normaliseStatus(header.status);
  const statusLabel = STATUS_MAP[normStatus]?.label || header.statusName || String(header.status || '—');

  const detailInfo = [
    { label: 'Mã phiếu', value: header.id ? `#${header.id}` : '—' },
    { label: 'Khoa/Bộ môn', value: header.department?.name || header.departmentName || '—' },
    { label: 'Năm học', value: header.academicYear || '—' },
    { label: 'Người tạo', value: header.createdBy?.fullName || header.createdByName || '—' },
    { label: 'Ngày tạo', value: fmtDate(header.createdAt) },
    { label: 'Trạng thái', value: statusLabel },
    ...(header.approvalBy ? [{ label: 'Người duyệt', value: header.approvalBy?.fullName || '—' }] : []),
    ...(header.approvalAt ? [{ label: 'Ngày duyệt', value: fmtDate(header.approvalAt) }] : []),
    ...(header.approvalNote ? [{ label: 'Ghi chú xử lý', value: header.approvalNote }] : []),
  ];

  const detailColumns = [
    { key: 'stt', label: 'STT', flex: 0.5 },
    { key: 'materialName', label: 'Vật tư', flex: 2 },
    { key: 'currentStock', label: 'Tồn kho', flex: 0.9 },
    { key: 'prevYearQty', label: 'Năm trước', flex: 0.9 },
    { key: 'thisYearQty', label: 'Dự trù', flex: 0.8 },
  ];

  const detailRows = (detailData?.details || []).map((d) => ({
    materialName: d.material?.name || d.materialName || '—',
    currentStock: String(d.currentStock ?? '—'),
    prevYearQty: String(d.prevYearQty ?? '—'),
    thisYearQty: String(d.thisYearQty ?? '—'),
    justification: d.justification || '—',
  }));

  const isPending = normStatus === 'PENDING';

  // ─── Card renderer ─────────────────────────────────────────────────────────
  const renderCard = (item) => {
    const ns = normaliseStatus(item.status);
    const status = STATUS_MAP[ns] || { label: String(item.status || '—'), variant: 'neutral' };
    const count = (item.details || []).length;
    return (
      <Pressable key={String(item.id)} style={styles.card} onPress={() => handleRowPress(item)}>
        <View style={styles.cardTop}>
          <MonoBadge>DT #{item.id}</MonoBadge>
          <Badge variant={status.variant}>{status.label}</Badge>
        </View>
        <Text style={styles.cardDept} numberOfLines={1}>
          {item.department?.name || item.departmentName || 'Phiếu dự trù'}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {item.createdBy?.fullName || item.createdByName || '—'}
          {item.academicYear ? ` · ${item.academicYear}` : ''}
          {item.createdAt ? ` · ${fmtDate(item.createdAt)}` : ''}
          {count ? ` · ${count} vật tư` : ''}
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
        <StatCard label="Chờ duyệt" value={stats.pending} variant="warning" style={styles.stat} />
        <StatCard label="Đã duyệt" value={stats.approved} variant="success" style={styles.stat} />
        <StatCard label="Từ chối" value={stats.rejected} variant="danger" style={styles.stat} />
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
        ) : list.length === 0 ? (
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
        title={header.id ? `Phiếu dự trù #${header.id}` : 'Chi tiết dự trù'}
        info={detailInfo}
        columns={detailColumns}
        rows={detailRows}
        onClose={closeDetail}
        footer={isPending ? (
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
  content: { paddingBottom: 24, paddingHorizontal: 10, paddingTop: 14 },
  centered: { justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },

  statRow: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 8 },
  stat: { flex: 1 },

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
