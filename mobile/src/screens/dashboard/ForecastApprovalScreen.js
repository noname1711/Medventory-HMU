import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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

  useEffect(() => {
    storage.getUser().then((u) => {
      setCurrentUser(u);
      loadForecasts(u?.id);
    });
  }, []);

  useEffect(() => {
    if (currentUser?.id) loadForecasts(currentUser.id);
  }, [filterStatus]);

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

  const renderItem = ({ item }) => {
    const status = STATUS_MAP[item.status] || { label: item.status, color: '#6B7280', bg: '#F3F4F6' };
    return (
      <TouchableOpacity style={styles.card} onPress={() => setSelected(item)}>
        <View style={styles.cardTop}>
          <Text style={styles.cardId}>Dự trù #{item.id}</Text>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
        <Text style={styles.cardBy}>Người lập: {item.requestedByName || item.requestedBy?.fullName || '—'}</Text>
        <Text style={styles.cardDate}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : '—'}</Text>
        <Text style={styles.cardMeta}>{(item.details || []).length} vật tư</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}>
        {Object.entries(STATUS_MAP).map(([key, val]) => (
          <TouchableOpacity key={key} style={[styles.filterChip, filterStatus === key && styles.filterChipActive]} onPress={() => setFilterStatus(key)}>
            <Text style={[styles.filterText, filterStatus === key && styles.filterTextActive]}>{val.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color="#1565C0" /></View>
      ) : (
        <FlatList
          data={forecasts}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={styles.emptyText}>Không có phiếu dự trù nào</Text>}
        />
      )}

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
                    <TouchableOpacity style={[styles.approveBtn, actionLoading && { opacity: 0.7 }]} onPress={handleApprove} disabled={actionLoading}>
                      {actionLoading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.actionBtnText}>✓ Phê duyệt</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.rejectBtn, actionLoading && { opacity: 0.7 }]} onPress={() => setShowRejectModal(true)} disabled={actionLoading}>
                      <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>✕ Từ chối</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <TouchableOpacity style={styles.closeBtn} onPress={() => setSelected(null)}>
                  <Text style={styles.closeBtnText}>Đóng</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showRejectModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowRejectModal(false)}>
          <Pressable style={[styles.modalSheet, { maxHeight: '50%' }]} onPress={() => {}}>
            <Text style={styles.modalTitle}>Lý do từ chối</Text>
            <TextInput
              style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
              placeholder="Nhập lý do từ chối..."
              placeholderTextColor="#9BA3AF"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              autoFocus
            />
            <TouchableOpacity style={[styles.rejectConfirmBtn, actionLoading && { opacity: 0.7 }]} onPress={handleReject} disabled={actionLoading}>
              {actionLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>Xác nhận từ chối</Text>}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterRow: { backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E0E6EF' },
  filterChip: { borderWidth: 1.5, borderColor: '#E0E6EF', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8 },
  filterChipActive: { backgroundColor: '#1565C0', borderColor: '#1565C0' },
  filterText: { fontSize: 13, color: '#6B7280' },
  filterTextActive: { color: '#FFF', fontWeight: '700' },
  list: { padding: 12, paddingBottom: 40 },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardId: { fontSize: 15, fontWeight: '700', color: '#1565C0' },
  statusBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 12, fontWeight: '600' },
  cardBy: { fontSize: 13, color: '#374151', marginBottom: 2 },
  cardDate: { fontSize: 12, color: '#9CA3AF', marginBottom: 2 },
  cardMeta: { fontSize: 12, color: '#9CA3AF' },
  emptyText: { textAlign: 'center', color: '#9BA3AF', paddingVertical: 40, fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1565C0', marginBottom: 16, textAlign: 'center' },
  infoRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  infoKey: { fontSize: 13, color: '#6B7280', width: 100 },
  infoVal: { fontSize: 13, color: '#1A1A2E', flex: 1, fontWeight: '500' },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8 },
  detailItem: { backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10, marginBottom: 8 },
  detailName: { fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginBottom: 4 },
  detailMeta: { fontSize: 12, color: '#6B7280' },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  approveBtn: { flex: 1, backgroundColor: '#10B981', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  rejectBtn: { flex: 1, backgroundColor: '#FEE2E2', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  actionBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  closeBtn: { backgroundColor: '#F3F4F6', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  closeBtnText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  input: { borderWidth: 1.5, borderColor: '#E0E6EF', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1A1A2E', marginBottom: 14, backgroundColor: '#F8FAFC' },
  rejectConfirmBtn: { backgroundColor: '#EF4444', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  submitText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
