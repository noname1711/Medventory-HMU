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

const ROLES = ['lanhdao', 'thukho', 'canbo'];
const ROLE_LABELS = { lanhdao: 'Lãnh đạo', thukho: 'Thủ kho', canbo: 'Cán bộ' };

export default function AdminScreen() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ role: '', department: '' });
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    storage.getUser().then((u) => {
      setCurrentUser(u);
      loadUsers(u?.id);
    });
  }, []);

  async function loadUsers(userId) {
    setLoading(true);
    try {
      const r = await fetch(API_ENDPOINTS.USERS, { headers: buildHeaders(userId) });
      const d = await r.json();
      setUsers(Array.isArray(d) ? d : (d?.content || []));
    } catch { setUsers([]); }
    finally { setLoading(false); }
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUsers(currentUser?.id);
    setRefreshing(false);
  };

  const handleOpenEdit = (user) => {
    setSelected(user);
    setEditForm({ role: user.role || '', department: user.department?.name || user.department || '' });
    setEditModal(true);
  };

  const handleUpdate = async () => {
    if (!editForm.role) { Toast.show({ type: 'error', text1: 'Vui lòng chọn vai trò!' }); return; }
    setActionLoading(true);
    try {
      const r = await fetch(`${API_ENDPOINTS.USERS}/${selected.id}`, {
        method: 'PUT',
        headers: buildHeaders(currentUser?.id),
        body: JSON.stringify({ role: editForm.role }),
      });
      if (r.ok) {
        Toast.show({ type: 'success', text1: 'Cập nhật thành công!' });
        setEditModal(false);
        loadUsers(currentUser?.id);
      } else {
        const d = await r.json();
        Toast.show({ type: 'error', text1: d.error || 'Cập nhật thất bại!' });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Lỗi kết nối server!' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleActive = (user) => {
    Alert.alert(
      user.active !== false ? 'Vô hiệu hóa tài khoản' : 'Kích hoạt tài khoản',
      `Bạn có chắc muốn ${user.active !== false ? 'vô hiệu hóa' : 'kích hoạt'} tài khoản của ${user.fullName}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xác nhận',
          style: user.active !== false ? 'destructive' : 'default',
          onPress: async () => {
            try {
              const action = user.active !== false ? 'deactivate' : 'activate';
              const r = await fetch(`${API_ENDPOINTS.USERS}/${user.id}/${action}`, {
                method: 'POST',
                headers: buildHeaders(currentUser?.id),
              });
              if (r.ok) {
                Toast.show({ type: 'success', text1: 'Cập nhật trạng thái thành công!' });
                loadUsers(currentUser?.id);
              }
            } catch {
              Toast.show({ type: 'error', text1: 'Lỗi kết nối server!' });
            }
          },
        },
      ]
    );
  };

  const filtered = users.filter((u) => {
    const kw = search.toLowerCase();
    return (
      (u.fullName || '').toLowerCase().includes(kw) ||
      (u.email || '').toLowerCase().includes(kw) ||
      (u.department?.name || u.department || '').toLowerCase().includes(kw)
    );
  });

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(item.fullName || 'U')[0].toUpperCase()}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.userName}>{item.fullName || '—'}</Text>
          <Text style={styles.userEmail} numberOfLines={1}>{item.email || '—'}</Text>
          <Text style={styles.userDept} numberOfLines={1}>{item.department?.name || item.department || '—'}</Text>
        </View>
        <View style={[styles.roleBadge, { backgroundColor: getRoleColor(item.role) + '20' }]}>
          <Text style={[styles.roleText, { color: getRoleColor(item.role) }]}>{ROLE_LABELS[item.role] || item.role || '—'}</Text>
        </View>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.editBtn} onPress={() => handleOpenEdit(item)}>
          <Text style={styles.editBtnText}>✏️ Sửa vai trò</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, item.active === false && styles.toggleBtnActive]}
          onPress={() => handleToggleActive(item)}
        >
          <Text style={[styles.toggleBtnText, item.active === false && styles.toggleBtnTextActive]}>
            {item.active === false ? '✓ Kích hoạt' : '⊘ Khóa'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm theo tên, email, khoa..."
          placeholderTextColor="#9BA3AF"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <Text style={styles.countText}>{filtered.length} người dùng</Text>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color="#1565C0" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={styles.emptyText}>Không có người dùng nào</Text>}
        />
      )}

      {/* Edit Modal */}
      <Modal visible={editModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setEditModal(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>Chỉnh sửa vai trò</Text>
            {selected && (
              <Text style={styles.editSubtitle}>{selected.fullName}</Text>
            )}
            <Text style={styles.label}>Vai trò</Text>
            <View style={styles.roleRow}>
              {ROLES.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleChip, editForm.role === r && styles.roleChipActive]}
                  onPress={() => setEditForm((f) => ({ ...f, role: r }))}
                >
                  <Text style={[styles.roleChipText, editForm.role === r && styles.roleChipTextActive]}>{ROLE_LABELS[r]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.submitBtn, actionLoading && { opacity: 0.7 }]}
              onPress={handleUpdate}
              disabled={actionLoading}
            >
              {actionLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>Lưu thay đổi</Text>}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function getRoleColor(role) {
  if (role === 'lanhdao') return '#7C3AED';
  if (role === 'thukho') return '#2563EB';
  return '#059669';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchRow: { padding: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E0E6EF' },
  searchInput: { borderWidth: 1.5, borderColor: '#E0E6EF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, backgroundColor: '#F8FAFC', color: '#1A1A2E' },
  countText: { fontSize: 12, color: '#9CA3AF', paddingHorizontal: 14, paddingVertical: 6 },
  list: { paddingHorizontal: 12, paddingBottom: 40 },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#1565C0', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  avatarText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  cardInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  userEmail: { fontSize: 12, color: '#6B7280' },
  userDept: { fontSize: 12, color: '#9CA3AF' },
  roleBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 8 },
  roleText: { fontSize: 12, fontWeight: '600' },
  cardActions: { flexDirection: 'row', gap: 8 },
  editBtn: { flex: 1, backgroundColor: '#EFF6FF', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  editBtnText: { fontSize: 13, color: '#1565C0', fontWeight: '600' },
  toggleBtn: { flex: 1, backgroundColor: '#FEF2F2', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: '#ECFDF5' },
  toggleBtnText: { fontSize: 13, color: '#EF4444', fontWeight: '600' },
  toggleBtnTextActive: { color: '#10B981' },
  emptyText: { textAlign: 'center', color: '#9BA3AF', paddingVertical: 40, fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1565C0', marginBottom: 4, textAlign: 'center' },
  editSubtitle: { fontSize: 14, color: '#6B7280', marginBottom: 16, textAlign: 'center' },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 10 },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  roleChip: { borderWidth: 1.5, borderColor: '#E0E6EF', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  roleChipActive: { backgroundColor: '#1565C0', borderColor: '#1565C0' },
  roleChipText: { fontSize: 14, color: '#6B7280' },
  roleChipTextActive: { color: '#FFF', fontWeight: '700' },
  submitBtn: { backgroundColor: '#1565C0', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  submitText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
