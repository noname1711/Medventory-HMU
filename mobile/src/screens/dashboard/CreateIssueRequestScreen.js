import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { API_ENDPOINTS, buildHeaders } from '../../api/apiConfig';
import { storage } from '../../utils/storage';

const STATUS_MAP = {
  PENDING: { label: 'Chờ duyệt', color: '#F59E0B', bg: '#FEF3C7' },
  APPROVED: { label: 'Đã duyệt', color: '#10B981', bg: '#D1FAE5' },
  REJECTED: { label: 'Từ chối', color: '#EF4444', bg: '#FEE2E2' },
};

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

  const renderHistory = ({ item }) => {
    const status = STATUS_MAP[item.status] || { label: item.status, color: '#6B7280', bg: '#F3F4F6' };
    return (
      <TouchableOpacity
        style={styles.histCard}
        onPress={() => setSelectedRequest(item)}
      >
        <View style={styles.histTop}>
          <Text style={styles.histId}>#{item.id}</Text>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
        <Text style={styles.histDept} numberOfLines={1}>
          {item.subDepartmentName || item.subDepartment?.name || '—'}
        </Text>
        <Text style={styles.histDate}>
          {item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : '—'}
        </Text>
        {item.note ? <Text style={styles.histNote} numberOfLines={1}>Ghi chú: {item.note}</Text> : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabs}>
        {['create', 'history'].map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t === 'create' ? 'Tạo phiếu' : 'Lịch sử'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'create' ? (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Sub department */}
          <Text style={styles.label}>Phòng/Khoa xin lĩnh *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            {subDepartments.map((d) => (
              <TouchableOpacity
                key={d.id}
                style={[styles.chip, formData.subDepartmentId === String(d.id) && styles.chipActive]}
                onPress={() => setFormData((f) => ({ ...f, subDepartmentId: String(d.id) }))}
              >
                <Text style={[styles.chipText, formData.subDepartmentId === String(d.id) && styles.chipTextActive]} numberOfLines={1}>
                  {d.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Note */}
          <Text style={styles.label}>Ghi chú</Text>
          <TextInput
            style={[styles.input, { height: 72, textAlignVertical: 'top' }]}
            placeholder="Nhập ghi chú..."
            placeholderTextColor="#9BA3AF"
            value={formData.note}
            onChangeText={(v) => setFormData((f) => ({ ...f, note: v }))}
            multiline
          />

          {/* Detail rows */}
          <Text style={styles.label}>Danh sách vật tư</Text>
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
              <TextInput
                style={styles.input}
                placeholder="Tên vật tư"
                placeholderTextColor="#9BA3AF"
                value={detail.materialName}
                onChangeText={(v) => updateDetail(index, 'materialName', v)}
              />
              <TextInput
                style={styles.input}
                placeholder="Quy cách"
                placeholderTextColor="#9BA3AF"
                value={detail.spec}
                onChangeText={(v) => updateDetail(index, 'spec', v)}
              />
              <TextInput
                style={styles.input}
                placeholder="Số lượng yêu cầu *"
                placeholderTextColor="#9BA3AF"
                value={detail.qtyRequested}
                onChangeText={(v) => updateDetail(index, 'qtyRequested', v)}
                keyboardType="numeric"
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {units.slice(0, 8).map((u) => (
                  <TouchableOpacity
                    key={u.id}
                    style={[styles.chip, detail.unitId === String(u.id) && styles.chipActive]}
                    onPress={() => updateDetail(index, 'unitId', String(u.id))}
                  >
                    <Text style={[styles.chipText, detail.unitId === String(u.id) && styles.chipTextActive]}>
                      {u.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.addRowBtn} onPress={addDetailRow}>
            <Text style={styles.addRowText}>+ Thêm vật tư</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>Gửi phiếu xin lĩnh</Text>}
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <FlatList
          data={requestHistory}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderHistory}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={historyLoading} onRefresh={() => currentUser?.id && fetchHistory(currentUser.id)} />}
          ListEmptyComponent={<Text style={styles.emptyText}>Chưa có phiếu xin lĩnh nào</Text>}
        />
      )}

      {/* Detail modal */}
      <Modal visible={!!selectedRequest} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedRequest(null)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            {selectedRequest && (
              <ScrollView>
                <Text style={styles.modalTitle}>Chi tiết phiếu #{selectedRequest.id}</Text>
                <View style={styles.detailRow}><Text style={styles.detailKey}>Phòng/Khoa:</Text><Text style={styles.detailVal}>{selectedRequest.subDepartmentName || '—'}</Text></View>
                <View style={styles.detailRow}><Text style={styles.detailKey}>Trạng thái:</Text><Text style={[styles.detailVal, { color: STATUS_MAP[selectedRequest.status]?.color }]}>{STATUS_MAP[selectedRequest.status]?.label || selectedRequest.status}</Text></View>
                <View style={styles.detailRow}><Text style={styles.detailKey}>Ngày tạo:</Text><Text style={styles.detailVal}>{selectedRequest.createdAt ? new Date(selectedRequest.createdAt).toLocaleDateString('vi-VN') : '—'}</Text></View>
                {selectedRequest.note && <View style={styles.detailRow}><Text style={styles.detailKey}>Ghi chú:</Text><Text style={styles.detailVal}>{selectedRequest.note}</Text></View>}
                {selectedRequest.rejectReason && <View style={styles.detailRow}><Text style={styles.detailKey}>Lý do từ chối:</Text><Text style={[styles.detailVal, { color: '#EF4444' }]}>{selectedRequest.rejectReason}</Text></View>}
                <Text style={[styles.label, { marginTop: 12 }]}>Danh sách vật tư:</Text>
                {(selectedRequest.details || []).map((d, i) => (
                  <View key={i} style={styles.detailCard}>
                    <Text style={styles.detailTitle}>{d.materialName || `Vật tư #${i + 1}`}</Text>
                    <Text style={styles.metaText}>SL yêu cầu: {d.qtyRequested} {d.unitName || ''}</Text>
                    {d.qtyApproved != null && <Text style={styles.metaText}>SL duyệt: {d.qtyApproved}</Text>}
                  </View>
                ))}
                <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedRequest(null)}>
                  <Text style={styles.closeBtnText}>Đóng</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  tabs: { flexDirection: 'row', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E0E6EF' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 3, borderBottomColor: '#1565C0' },
  tabText: { fontSize: 14, color: '#6B7280' },
  tabTextActive: { color: '#1565C0', fontWeight: '700' },
  scroll: { padding: 16, paddingBottom: 40 },
  list: { padding: 12, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: {
    borderWidth: 1.5,
    borderColor: '#E0E6EF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1A1A2E',
    marginBottom: 10,
    backgroundColor: '#FFF',
  },
  chip: { borderWidth: 1.5, borderColor: '#E0E6EF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6 },
  chipActive: { backgroundColor: '#1565C0', borderColor: '#1565C0' },
  chipText: { fontSize: 13, color: '#6B7280' },
  chipTextActive: { color: '#FFF', fontWeight: '600' },
  detailCard: { backgroundColor: '#FFF', borderRadius: 10, padding: 14, marginBottom: 10, elevation: 1 },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  detailTitle: { fontSize: 14, fontWeight: '700', color: '#1565C0' },
  removeBtn: { fontSize: 13, color: '#EF4444' },
  addRowBtn: { borderWidth: 1.5, borderColor: '#1565C0', borderRadius: 10, borderStyle: 'dashed', paddingVertical: 12, alignItems: 'center', marginBottom: 16 },
  addRowText: { color: '#1565C0', fontWeight: '700', fontSize: 14 },
  submitBtn: { backgroundColor: '#1565C0', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginBottom: 20 },
  submitBtnDisabled: { opacity: 0.7 },
  submitText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  histCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 2 },
  histTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  histId: { fontSize: 15, fontWeight: '700', color: '#1565C0' },
  statusBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 12, fontWeight: '600' },
  histDept: { fontSize: 13, color: '#374151', marginBottom: 4 },
  histDate: { fontSize: 12, color: '#9CA3AF' },
  histNote: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  emptyText: { textAlign: 'center', color: '#9BA3AF', paddingVertical: 40, fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1565C0', marginBottom: 16, textAlign: 'center' },
  detailRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  detailKey: { fontSize: 13, color: '#6B7280', width: 110 },
  detailVal: { fontSize: 13, color: '#1A1A2E', flex: 1, fontWeight: '500' },
  metaText: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  closeBtn: { backgroundColor: '#F3F4F6', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  closeBtnText: { fontSize: 15, fontWeight: '600', color: '#374151' },
});
