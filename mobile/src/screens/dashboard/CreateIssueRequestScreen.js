import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { API_ENDPOINTS } from '../../api/apiConfig';
import { apiGet, apiSend } from '../../api/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useServerHistory } from '../../hooks/useServerHistory';
import MaterialPicker from '../../components/MaterialPicker';
import DetailModal from '../../components/DetailModal';
import { colors, radius, fontSize } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import {
  Section,
  Field,
  Input,
  Button,
  Badge,
  Empty,
  SegmentControl,
  MonoBadge,
  Pagination,
} from '../../theme/ui';

const STATUS_MAP = {
  PENDING: { label: 'Chờ duyệt', variant: 'pending' },
  APPROVED: { label: 'Đã duyệt', variant: 'approved' },
  REJECTED: { label: 'Từ chối', variant: 'rejected' },
};

const PAGE_SIZE = 8;

function createDetailRow() {
  return {
    materialId: null,
    materialName: '',
    spec: '',
    unitId: '',
    qtyRequested: '',
    materialCode: '',
    manufacturer: '',
    category: '',
  };
}

export default function CreateIssueRequestScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('create');
  const [subDepartments, setSubDepartments] = useState([]);
  const [loading, setLoading] = useState(false);

  // Create form state
  const [subDepartmentId, setSubDepartmentId] = useState('');
  const [note, setNote] = useState('');
  const [details, setDetails] = useState([createDetailRow()]);

  // MaterialPicker state — which row is picking
  const [pickerRowIndex, setPickerRowIndex] = useState(null);

  // History detail modal
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Server-side history
  const buildHistoryUrl = useCallback(
    ({ keyword, page0, size }) =>
      `${API_ENDPOINTS.ISSUE_REQ_MINE}?keyword=${encodeURIComponent(keyword)}&page=${page0}&size=${size}`,
    []
  );

  const {
    items: historyItems,
    page: histPage,
    setPage: setHistPage,
    totalPages: histTotalPages,
    totalCount: histTotalCount,
    keyword: histKeyword,
    setKeyword: setHistKeyword,
    loading: histLoading,
    reload: reloadHistory,
  } = useServerHistory({
    buildUrl: buildHistoryUrl,
    userId: user?.id,
    pageSize: PAGE_SIZE,
    active: activeTab === 'history',
  });

  // Load sub-departments on mount
  useEffect(() => {
    async function fetchSubDepts() {
      const { ok, data } = await apiGet(API_ENDPOINTS.SUB_DEPARTMENTS, user?.id);
      setSubDepartments(ok && Array.isArray(data) ? data : []);
    }
    if (user?.id) fetchSubDepts();
  }, [user?.id]);

  // ─── Detail rows helpers ──────────────────────────────────────────────────
  const updateDetail = (index, key, value) => {
    setDetails((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  };

  const addDetailRow = () => setDetails((prev) => [...prev, createDetailRow()]);

  const removeDetailRow = (index) => {
    setDetails((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length ? next : [createDetailRow()];
    });
  };

  // Called when MaterialPicker selects an item
  const handleMaterialSelect = (dto) => {
    if (pickerRowIndex == null) return;
    updateDetail(pickerRowIndex, 'materialId', dto.id);
    updateDetail(pickerRowIndex, 'materialName', dto.name || '');
    updateDetail(pickerRowIndex, 'spec', dto.spec || '');
    updateDetail(pickerRowIndex, 'unitId', dto.unitId ?? dto.unit?.id ?? '');
    updateDetail(pickerRowIndex, 'materialCode', dto.code || '');
    updateDetail(pickerRowIndex, 'manufacturer', dto.manufacturer || '');
    updateDetail(pickerRowIndex, 'category', dto.category || '');
  };

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!subDepartmentId) {
      Toast.show({ type: 'error', text1: 'Vui lòng chọn phòng/khoa!' });
      return;
    }
    const validDetails = details.filter(
      (d) => d.materialId && Number(d.qtyRequested) > 0
    );
    if (validDetails.length === 0) {
      Toast.show({ type: 'error', text1: 'Vui lòng thêm ít nhất 1 vật tư!' });
      return;
    }

    setLoading(true);
    const body = {
      subDepartmentId: subDepartmentId || null,
      note,
      details: validDetails.map((d) => ({
        materialId: d.materialId,
        materialName: d.materialName,
        spec: d.spec,
        unitId: Number(d.unitId),
        qtyRequested: Number(d.qtyRequested),
        proposedCode: d.materialCode,
        proposedManufacturer: d.manufacturer,
        category: d.category,
      })),
    };

    const { ok, data } = await apiSend('POST', API_ENDPOINTS.ISSUE_REQ_CREATE, body, user?.id);
    setLoading(false);

    if (ok) {
      Toast.show({ type: 'success', text1: data?.message || 'Tạo phiếu xin lĩnh thành công!' });
      // Reset form
      setSubDepartmentId('');
      setNote('');
      setDetails([createDetailRow()]);
      // Switch to history and reload
      setActiveTab('history');
      reloadHistory();
    } else {
      Toast.show({ type: 'error', text1: data?.message || data?.error || 'Tạo phiếu thất bại!' });
    }
  };

  // ─── History row tap → fetch detail ──────────────────────────────────────
  const handleRowTap = async (item) => {
    setDetailLoading(true);
    const { ok, data } = await apiGet(API_ENDPOINTS.ISSUE_REQ_DETAIL(item.id), user?.id);
    setDetailLoading(false);
    if (ok && data) {
      setSelectedRequest(data);
    } else {
      // Fallback: show what we already have from the list
      setSelectedRequest(item);
    }
  };

  // ─── DetailModal props builder ────────────────────────────────────────────
  const buildDetailModal = () => {
    if (!selectedRequest) return null;
    const status = STATUS_MAP[selectedRequest.status] || { label: selectedRequest.status, variant: 'info' };
    const info = [
      { label: 'Mã phiếu', value: String(selectedRequest.id || '—') },
      {
        label: 'Ngày gửi',
        value: selectedRequest.requestedAt
          ? new Date(selectedRequest.requestedAt).toLocaleDateString('vi-VN')
          : '—',
      },
      { label: 'Phòng/Khoa', value: selectedRequest.subDepartmentName || '—' },
      { label: 'Ghi chú', value: selectedRequest.note || '—' },
      { label: 'Trạng thái', value: status.label },
    ];
    if (selectedRequest.rejectReason) {
      info.push({ label: 'Lý do từ chối', value: selectedRequest.rejectReason });
    }
    const columns = [
      { key: 'materialName', label: 'Tên vật tư', flex: 2 },
      { key: 'qtyRequested', label: 'SL xin', flex: 1 },
      { key: 'unitName', label: 'Đơn vị', flex: 1 },
    ];
    const rows = (selectedRequest.details || []).map((d) => ({
      materialName: d.materialName || d.material?.name || '—',
      qtyRequested: String(d.qtyRequested ?? '—'),
      unitName: d.unitName || d.unit?.name || '—',
    }));
    return { info, columns, rows, status };
  };

  const modalData = buildDetailModal();

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={histLoading && activeTab === 'history'}
          onRefresh={() => activeTab === 'history' && reloadHistory()}
        />
      }
    >
      <SegmentControl
        segments={[
          { key: 'create', label: 'Tạo phiếu' },
          { key: 'history', label: `Lịch sử (${histTotalCount})` },
        ]}
        active={activeTab}
        onChange={setActiveTab}
      />

      {/* ── Create tab ───────────────────────────────────────────────────── */}
      {activeTab === 'create' ? (
        <Section>
          {/* Sub-department picker */}
          <Field label="Phòng/Khoa xin lĩnh *">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {subDepartments.map((d) => {
                const active = subDepartmentId === String(d.id);
                return (
                  <TouchableOpacity
                    key={d.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setSubDepartmentId(String(d.id))}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                      {d.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Field>

          {/* Note */}
          <Field label="Ghi chú">
            <Input
              placeholder="Nhập ghi chú..."
              value={note}
              onChangeText={setNote}
              multiline
            />
          </Field>

          {/* Material detail rows */}
          <Field label="Danh sách vật tư" />
          {details.map((detail, index) => (
            <View key={index} style={styles.detailCard}>
              <View style={styles.detailHeader}>
                <Text style={styles.detailTitle}>Vật tư #{index + 1}</Text>
                {details.length > 1 && (
                  <TouchableOpacity onPress={() => removeDetailRow(index)}>
                    <Text style={styles.removeBtn}>✕ Xóa</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Material picker button */}
              <TouchableOpacity
                style={styles.pickerBtn}
                onPress={() => setPickerRowIndex(index)}
                activeOpacity={0.8}
              >
                <Text style={detail.materialId ? styles.pickerBtnTextFilled : styles.pickerBtnTextPlaceholder} numberOfLines={1}>
                  {detail.materialId ? detail.materialName : 'Chọn vật tư từ danh mục...'}
                </Text>
                <Text style={styles.pickerBtnIcon}>▼</Text>
              </TouchableOpacity>

              {/* Show spec / manufacturer if filled */}
              {!!detail.spec && (
                <Text style={styles.metaRow}>Quy cách: {detail.spec}</Text>
              )}
              {!!detail.manufacturer && (
                <Text style={styles.metaRow}>Hãng SX: {detail.manufacturer}</Text>
              )}

              {/* Qty */}
              <Input
                placeholder="Số lượng xin cấp *"
                value={detail.qtyRequested}
                onChangeText={(v) => updateDetail(index, 'qtyRequested', v.replace(/[^\d]/g, ''))}
                keyboardType="numeric"
                style={styles.detailInput}
              />
            </View>
          ))}

          <TouchableOpacity onPress={addDetailRow} style={styles.addRowBtn} activeOpacity={0.8}>
            <Text style={styles.addRowText}>＋ Thêm vật tư</Text>
          </TouchableOpacity>

          <Button
            title={loading ? '' : 'Gửi phiếu xin lĩnh'}
            onPress={handleSubmit}
            disabled={loading}
            style={{ marginTop: 10 }}
          >
            {loading ? <ActivityIndicator color={colors.white} /> : null}
          </Button>
        </Section>
      ) : (
        /* ── History tab ──────────────────────────────────────────────────── */
        <View>
          {/* Search box */}
          <View style={styles.searchWrap}>
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm theo mã phiếu / ghi chú..."
              value={histKeyword}
              onChangeText={setHistKeyword}
              clearButtonMode="while-editing"
            />
          </View>

          {histLoading ? (
            <View style={styles.centerLoader}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : historyItems.length === 0 ? (
            <Empty>
              {histTotalCount === 0 ? 'Chưa có phiếu xin lĩnh nào' : 'Không tìm thấy kết quả'}
            </Empty>
          ) : (
            <>
              {historyItems.map((item) => {
                const status = STATUS_MAP[item.status] || { label: item.status, variant: 'info' };
                const count = (item.details || []).length;
                return (
                  <TouchableOpacity
                    key={String(item.id)}
                    style={styles.histCard}
                    onPress={() => handleRowTap(item)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.histTop}>
                      <MonoBadge>#{item.id}</MonoBadge>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </View>
                    <Text style={styles.histNote} numberOfLines={1}>
                      {item.note || '—'}
                    </Text>
                    <Text style={styles.histDate}>
                      Gửi{' '}
                      {item.requestedAt
                        ? new Date(item.requestedAt).toLocaleDateString('vi-VN')
                        : '—'}
                      {count ? ` · ${count} vật tư` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <Pagination
                page={histPage}
                totalPages={histTotalPages}
                onPrev={() => setHistPage((p) => Math.max(1, p - 1))}
                onNext={() => setHistPage((p) => Math.min(histTotalPages, p + 1))}
              />
            </>
          )}
        </View>
      )}

      {/* MaterialPicker modal */}
      <MaterialPicker
        visible={pickerRowIndex != null}
        onClose={() => setPickerRowIndex(null)}
        onSelect={(dto) => {
          handleMaterialSelect(dto);
          setPickerRowIndex(null);
        }}
      />

      {/* Detail modal */}
      {modalData && (
        <DetailModal
          visible={!!selectedRequest}
          title={`Chi tiết phiếu #${selectedRequest?.id}`}
          info={modalData.info}
          columns={modalData.columns}
          rows={modalData.rows}
          onClose={() => setSelectedRequest(null)}
        />
      )}

      {/* Loading overlay for detail fetch */}
      {detailLoading && (
        <View style={styles.detailLoadingOverlay}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 24, paddingHorizontal: 10 },

  // Chip row (sub-department selector)
  chipRow: { gap: 8, paddingVertical: 2 },
  chip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.base, color: colors.textSoft, fontFamily: fontFamily.medium },
  chipTextActive: { color: colors.white, fontFamily: fontFamily.bold },

  // Detail card
  detailCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 10,
    backgroundColor: colors.white,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailTitle: { fontSize: fontSize.base, fontFamily: fontFamily.bold, color: colors.primary },
  detailInput: { marginBottom: 8 },
  removeBtn: { fontSize: fontSize.sm, color: colors.danger, fontFamily: fontFamily.semibold },

  // Material picker button
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    backgroundColor: colors.bg,
  },
  pickerBtnTextFilled: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.text,
    fontFamily: fontFamily.medium,
  },
  pickerBtnTextPlaceholder: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
  },
  pickerBtnIcon: { fontSize: 11, color: colors.textSoft, marginLeft: 6 },
  metaRow: { fontSize: fontSize.xs, color: colors.textSoft, marginBottom: 4, fontFamily: fontFamily.regular },

  // Add row dashed button
  addRowBtn: {
    paddingVertical: 11,
    borderRadius: 11,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#c7d2e0',
    backgroundColor: '#f8fafd',
    alignItems: 'center',
  },
  addRowText: { fontSize: 13, fontFamily: fontFamily.bold, color: colors.primary },

  // History search
  searchWrap: { marginBottom: 10 },
  searchInput: {
    height: 44,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    backgroundColor: colors.white,
    color: colors.text,
    fontSize: fontSize.base,
    fontFamily: fontFamily.regular,
  },

  // History cards
  histCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#e7ebf2',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  histTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  histNote: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.text },
  histDate: { fontSize: 12, color: '#94a3b8', marginTop: 2 },

  // Loading states
  centerLoader: { alignItems: 'center', paddingVertical: 32 },
  detailLoadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
});
