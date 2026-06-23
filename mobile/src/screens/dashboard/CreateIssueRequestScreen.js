import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { API_ENDPOINTS, buildHeaders } from '../../api/apiConfig';
import { storage } from '../../utils/storage';
import { colors, radius, fontSize } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import {
  PageFrame,
  PageHead,
  Section,
  Field,
  Input,
  Button,
  Badge,
  Empty,
  Tabs,
  Pagination,
} from '../../theme/ui';

const STATUS_MAP = {
  PENDING: { label: 'Chờ duyệt', variant: 'pending' },
  APPROVED: { label: 'Đã duyệt', variant: 'approved' },
  REJECTED: { label: 'Từ chối', variant: 'rejected' },
};

const PAGE_SIZE = 8;

export default function CreateIssueRequestScreen() {
  const [activeTab, setActiveTab] = useState('create');
  const [currentUser, setCurrentUser] = useState(null);
  const [units, setUnits] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [subDepartments, setSubDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [requestHistory, setRequestHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [page, setPage] = useState(1);

  const [formData, setFormData] = useState({
    subDepartmentId: '',
    note: '',
    details: [createDetailRow()],
  });

  function createDetailRow() {
    return {
      materialId: null,
      materialName: '',
      spec: '',
      unitId: '',
      qtyRequested: '',
      proposedCode: '',
      proposedManufacturer: '',
      category: '',
    };
  }

  useEffect(() => {
    loadInit();
  }, []);

  async function loadInit() {
    const user = await storage.getUser();
    setCurrentUser(user);
    await Promise.all([fetchUnits(), fetchMaterials(), fetchSubDepartments()]);
    if (user?.id) fetchHistory(user.id);
  }

  async function fetchUnits() {
    try {
      const r = await fetch(API_ENDPOINTS.UNITS);
      setUnits(Array.isArray(await r.json()) ? await r.clone().json() : []);
    } catch { setUnits([]); }
  }

  async function fetchMaterials() {
    try {
      const r = await fetch(API_ENDPOINTS.MATERIALS);
      const d = await r.json();
      setMaterials(Array.isArray(d) ? d : []);
    } catch { setMaterials([]); }
  }

  async function fetchSubDepartments() {
    try {
      const r = await fetch(API_ENDPOINTS.SUB_DEPARTMENTS);
      const d = await r.json();
      setSubDepartments(Array.isArray(d) ? d : []);
    } catch { setSubDepartments([]); }
  }

  async function fetchHistory(userId) {
    setHistoryLoading(true);
    try {
      const r = await fetch(`${API_ENDPOINTS.ISSUE_REQUESTS}?requestedById=${userId}`, {
        headers: buildHeaders(userId),
      });
      const d = await r.json();
      setRequestHistory(Array.isArray(d) ? d : (d?.content || []));
    } catch {
      setRequestHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  const updateDetail = (index, key, value) => {
    setFormData((f) => {
      const details = [...f.details];
      details[index] = { ...details[index], [key]: value };
      return { ...f, details };
    });
  };

  const addDetailRow = () => {
    setFormData((f) => ({ ...f, details: [...f.details, createDetailRow()] }));
  };

  const removeDetailRow = (index) => {
    setFormData((f) => {
      const details = f.details.filter((_, i) => i !== index);
      return { ...f, details: details.length ? details : [createDetailRow()] };
    });
  };

  const handleSubmit = async () => {
    if (!formData.subDepartmentId) {
      Toast.show({ type: 'error', text1: 'Vui lòng chọn phòng/khoa!' });
      return;
    }
    const hasItem = formData.details.some((d) => d.qtyRequested && Number(d.qtyRequested) > 0);
    if (!hasItem) {
      Toast.show({ type: 'error', text1: 'Vui lòng thêm ít nhất 1 vật tư!' });
      return;
    }
    setLoading(true);
    try {
      const payload = {
        subDepartmentId: Number(formData.subDepartmentId),
        requestedById: currentUser?.id,
        note: formData.note,
        details: formData.details
          .filter((d) => d.qtyRequested && Number(d.qtyRequested) > 0)
          .map((d) => ({
            materialId: d.materialId || null,
            materialName: d.materialName,
            specification: d.spec,
            unitId: d.unitId ? Number(d.unitId) : null,
            qtyRequested: Number(d.qtyRequested),
            proposedCode: d.proposedCode,
            proposedManufacturer: d.proposedManufacturer,
            category: d.category,
          })),
      };
      const r = await fetch(API_ENDPOINTS.ISSUE_REQUESTS, {
        method: 'POST',
        headers: buildHeaders(currentUser?.id),
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (r.ok) {
        Toast.show({ type: 'success', text1: 'Tạo phiếu xin lĩnh thành công!' });
        setFormData({ subDepartmentId: '', note: '', details: [createDetailRow()] });
        setActiveTab('history');
        if (currentUser?.id) fetchHistory(currentUser.id);
      } else {
        Toast.show({ type: 'error', text1: d.error || 'Tạo phiếu thất bại!' });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Lỗi kết nối server!' });
    } finally {
      setLoading(false);
    }
  };

  // History pagination — reset to page 1 when the list changes
  useEffect(() => { setPage(1); }, [requestHistory.length]);
  const totalPages = Math.max(1, Math.ceil(requestHistory.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pagedHistory = requestHistory.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={historyLoading}
          onRefresh={() => currentUser?.id && fetchHistory(currentUser.id)}
        />
      }
    >
      <PageFrame>
        <PageHead title="Tạo phiếu xin lĩnh" />

        <Tabs
          tabs={[
            { key: 'create', label: 'Tạo phiếu xin lĩnh' },
            { key: 'history', label: `Lịch sử đã gửi (${requestHistory.length})` },
          ]}
          active={activeTab}
          onChange={setActiveTab}
        />

        {activeTab === 'create' ? (
          <Section title="Phiếu xin lĩnh">
            {/* Sub department */}
            <Field label="Phòng/Khoa xin lĩnh *">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {subDepartments.map((d) => {
                  const on = formData.subDepartmentId === String(d.id);
                  return (
                    <TouchableOpacity
                      key={d.id}
                      style={[styles.chip, on && styles.chipActive]}
                      onPress={() => setFormData((f) => ({ ...f, subDepartmentId: String(d.id) }))}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextActive]} numberOfLines={1}>
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
                value={formData.note}
                onChangeText={(v) => setFormData((f) => ({ ...f, note: v }))}
                multiline
              />
            </Field>

            {/* Detail rows */}
            <Field label="Danh sách vật tư" />
            {formData.details.map((detail, index) => (
              <View key={index} style={styles.detailCard}>
                <View style={styles.detailHeader}>
                  <Text style={styles.detailTitle}>Vật tư #{index + 1}</Text>
                  {formData.details.length > 1 && (
                    <TouchableOpacity onPress={() => removeDetailRow(index)}>
                      <Text style={styles.removeBtn}>✕ Xóa</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Input
                  placeholder="Tên vật tư"
                  value={detail.materialName}
                  onChangeText={(v) => updateDetail(index, 'materialName', v)}
                  style={styles.detailInput}
                />
                <Input
                  placeholder="Quy cách"
                  value={detail.spec}
                  onChangeText={(v) => updateDetail(index, 'spec', v)}
                  style={styles.detailInput}
                />
                <Input
                  placeholder="Số lượng yêu cầu *"
                  value={detail.qtyRequested}
                  onChangeText={(v) => updateDetail(index, 'qtyRequested', v)}
                  keyboardType="numeric"
                  style={styles.detailInput}
                />
                <View style={styles.chipRowWrap}>
                  {units.slice(0, 8).map((u) => {
                    const on = detail.unitId === String(u.id);
                    return (
                      <TouchableOpacity
                        key={u.id}
                        style={[styles.chip, on && styles.chipActive]}
                        onPress={() => updateDetail(index, 'unitId', String(u.id))}
                      >
                        <Text style={[styles.chipText, on && styles.chipTextActive]}>{u.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}

            <Button title="+ Thêm vật tư" variant="secondary" onPress={addDetailRow} style={{ marginBottom: 12 }} />

            <Button title={loading ? '' : 'Gửi phiếu xin lĩnh'} onPress={handleSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color={colors.white} /> : null}
            </Button>
          </Section>
        ) : (
          <Section title="Lịch sử phiếu xin lĩnh đã gửi">
            {requestHistory.length === 0 ? (
              <Empty>Chưa có phiếu xin lĩnh nào</Empty>
            ) : (
              <>
                {pagedHistory.map((item) => {
                  const status = STATUS_MAP[item.status] || { label: item.status, variant: 'info' };
                  return (
                    <TouchableOpacity
                      key={String(item.id)}
                      style={styles.histRow}
                      onPress={() => setSelectedRequest(item)}
                    >
                      <View style={styles.histInfo}>
                        <Text style={styles.histId}>#{item.id}</Text>
                        <Text style={styles.histDept} numberOfLines={1}>
                          {item.subDepartmentName || item.subDepartment?.name || '—'}
                        </Text>
                        <Text style={styles.histDate}>
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : '—'}
                        </Text>
                        {item.note ? <Text style={styles.histNote} numberOfLines={1}>Ghi chú: {item.note}</Text> : null}
                      </View>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TouchableOpacity>
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
          </Section>
        )}
      </PageFrame>

      {/* Detail modal */}
      <Modal visible={!!selectedRequest} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedRequest(null)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            {selectedRequest && (
              <ScrollView>
                <Text style={styles.modalTitle}>Chi tiết phiếu #{selectedRequest.id}</Text>
                <View style={styles.detailRow}><Text style={styles.detailKey}>Phòng/Khoa:</Text><Text style={styles.detailVal}>{selectedRequest.subDepartmentName || '—'}</Text></View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Trạng thái:</Text>
                  <Badge variant={(STATUS_MAP[selectedRequest.status] || { variant: 'info' }).variant}>
                    {STATUS_MAP[selectedRequest.status]?.label || selectedRequest.status}
                  </Badge>
                </View>
                <View style={styles.detailRow}><Text style={styles.detailKey}>Ngày tạo:</Text><Text style={styles.detailVal}>{selectedRequest.createdAt ? new Date(selectedRequest.createdAt).toLocaleDateString('vi-VN') : '—'}</Text></View>
                {selectedRequest.note && <View style={styles.detailRow}><Text style={styles.detailKey}>Ghi chú:</Text><Text style={styles.detailVal}>{selectedRequest.note}</Text></View>}
                {selectedRequest.rejectReason && <View style={styles.detailRow}><Text style={styles.detailKey}>Lý do từ chối:</Text><Text style={[styles.detailVal, { color: colors.danger }]}>{selectedRequest.rejectReason}</Text></View>}
                <Text style={[styles.sheetLabel, { marginTop: 12 }]}>Danh sách vật tư:</Text>
                {(selectedRequest.details || []).map((d, i) => (
                  <View key={i} style={styles.detailCard}>
                    <Text style={styles.detailTitle}>{d.materialName || `Vật tư #${i + 1}`}</Text>
                    <Text style={styles.metaText}>SL yêu cầu: {d.qtyRequested} {d.unitName || ''}</Text>
                    {d.qtyApproved != null && <Text style={styles.metaText}>SL duyệt: {d.qtyApproved}</Text>}
                  </View>
                ))}
                <Button title="Đóng" variant="secondary" onPress={() => setSelectedRequest(null)} style={{ marginTop: 16 }} />
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 24 },
  chipRow: { gap: 8, paddingVertical: 2 },
  chipRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
  detailCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, marginBottom: 10, backgroundColor: colors.white },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  detailTitle: { fontSize: fontSize.base, fontFamily: fontFamily.bold, color: colors.primary },
  detailInput: { marginBottom: 8 },
  removeBtn: { fontSize: fontSize.sm, color: colors.danger, fontFamily: fontFamily.semibold },
  // History rows
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  histInfo: { flex: 1 },
  histId: { fontSize: fontSize.md, fontFamily: fontFamily.bold, color: colors.primary, marginBottom: 2 },
  histDept: { fontSize: fontSize.sm, color: colors.label, marginBottom: 2 },
  histDate: { fontSize: fontSize.xs, color: colors.textMuted },
  histNote: { fontSize: fontSize.xs, color: colors.textSoft, marginTop: 4 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontFamily: fontFamily.bold, color: colors.primary, marginBottom: 16, textAlign: 'center' },
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  detailKey: { fontSize: fontSize.sm, color: colors.textSoft, width: 110 },
  detailVal: { fontSize: fontSize.sm, color: colors.text, flex: 1, fontFamily: fontFamily.medium },
  sheetLabel: { color: colors.label, fontSize: fontSize.base, fontFamily: fontFamily.bold, marginBottom: 6 },
  metaText: { fontSize: fontSize.xs, color: colors.textSoft, marginTop: 2 },
});
