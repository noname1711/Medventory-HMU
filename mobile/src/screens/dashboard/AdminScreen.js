import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  StatCard,
  Field,
  Input,
  Label,
  Button,
  Badge,
  Empty,
  Pagination,
} from '../../theme/ui';

const ROLES = ['lanhdao', 'thukho', 'canbo'];
const ROLE_LABELS = { lanhdao: 'Lãnh đạo', thukho: 'Thủ kho', canbo: 'Cán bộ' };
const PAGE_SIZE = 8;

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
  const [page, setPage] = useState(1);

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

  // Pagination — reset to page 1 whenever the search changes
  useEffect(() => { setPage(1); }, [search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paged = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  // KPI counts (web .ui-stat-grid)
  const totalCount = users.length;
  const activeCount = users.filter((u) => u.active !== false).length;
  const inactiveCount = users.filter((u) => u.active === false).length;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <PageFrame>
        <PageHead title="Quản lý người dùng" subtitle={`${filtered.length} người dùng`} />

        {/* KPI stat cards (web .ui-stat-grid) */}
        <StatCard variant="primary" label="Tổng tài khoản" value={totalCount} note="Toàn bộ người dùng đang quản lý" />
        <StatCard variant="success" label="Đang hoạt động" value={activeCount} note="Tài khoản đang được kích hoạt" />
        <StatCard variant="danger" label="Đã khóa" value={inactiveCount} note="Tài khoản đang bị vô hiệu hóa" />

        {/* User list (web "Danh sách tài khoản" section) */}
        <Section title="Danh sách tài khoản">
          <Field label="Tìm kiếm">
            <Input
              placeholder="Tìm theo tên, email, khoa..."
              value={search}
              onChangeText={setSearch}
            />
          </Field>

          {filtered.length === 0 ? (
            <Empty>
              {search
                ? `Không tìm thấy người dùng phù hợp với "${search}"`
                : 'Không có người dùng nào'}
            </Empty>
          ) : (
            <>
              {paged.map((item) => (
                <View key={String(item.id)} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{(item.fullName || 'U')[0].toUpperCase()}</Text>
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={styles.userName} numberOfLines={1}>{item.fullName || '—'}</Text>
                      <Text style={styles.userEmail} numberOfLines={1}>{item.email || '—'}</Text>
                      <Text style={styles.userDept} numberOfLines={1}>{item.department?.name || item.department || '—'}</Text>
                    </View>
                  </View>
                  <View style={styles.badgeRow}>
                    <Badge variant="info">{ROLE_LABELS[item.role] || item.role || '—'}</Badge>
                    <Badge variant={item.active === false ? 'rejected' : 'approved'}>
                      {item.active === false ? 'Đã khóa' : 'Hoạt động'}
                    </Badge>
                  </View>
                  <View style={styles.cardActions}>
                    <Button
                      title="Sửa vai trò"
                      variant="secondary"
                      size="sm"
                      onPress={() => handleOpenEdit(item)}
                      style={styles.actionBtn}
                    />
                    <Button
                      title={item.active === false ? 'Kích hoạt' : 'Khóa'}
                      variant={item.active === false ? 'primary' : 'danger'}
                      size="sm"
                      onPress={() => handleToggleActive(item)}
                      style={styles.actionBtn}
                    />
                  </View>
                </View>
              ))}

              <Pagination
                page={pageSafe}
                totalPages={totalPages}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
              />
            </>
          )}
        </Section>
      </PageFrame>

      {/* Edit Modal */}
      <Modal visible={editModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setEditModal(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>Chỉnh sửa vai trò</Text>
            {selected && (
              <Text style={styles.editSubtitle}>{selected.fullName}</Text>
            )}
            <Label>Vai trò</Label>
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
            <Button
              title={actionLoading ? '' : 'Lưu thay đổi'}
              onPress={handleUpdate}
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
  content: { paddingBottom: 24 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  // User row card
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  avatarText: { color: colors.white, fontSize: 18, fontFamily: fontFamily.bold },
  cardInfo: { flex: 1 },
  userName: { fontSize: fontSize.base, fontFamily: fontFamily.bold, color: colors.text },
  userEmail: { fontSize: fontSize.sm, color: colors.textSoft },
  userDept: { fontSize: fontSize.sm, color: colors.textMuted },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: { flex: 1 },
  // Edit modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { fontSize: 18, fontFamily: fontFamily.bold, color: colors.primary, marginBottom: 4, textAlign: 'center' },
  editSubtitle: { fontSize: 14, color: colors.textSoft, marginBottom: 16, textAlign: 'center' },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20, marginTop: 6 },
  roleChip: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  roleChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  roleChipText: { fontSize: 14, color: colors.textSoft },
  roleChipTextActive: { color: colors.white, fontFamily: fontFamily.bold },
});
