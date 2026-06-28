import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { API_ENDPOINTS } from '../../api/apiConfig';
import { apiGet, apiSend } from '../../api/apiClient';
import { useAuth } from '../../context/AuthContext';
import { colors, radius, fontSize } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import {
  StatCard,
  Input,
  Label,
  Button,
  Badge,
  Empty,
  Pagination,
  SegmentControl,
} from '../../theme/ui';

const ROLES = ['lanhdao', 'thukho', 'canbo'];
const ROLE_LABELS = { lanhdao: 'Lãnh đạo', thukho: 'Thủ kho', canbo: 'Cán bộ' };
const PAGE_SIZE = 8;

const STATUS_SEGMENTS = [
  { key: 'pending', label: 'Chờ duyệt' },
  { key: 'approved', label: 'Đã duyệt' },
];

export default function AdminScreen() {
  const { user } = useAuth();

  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [users, setUsers] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ totalUsers: 0, pendingUsers: 0, approvedUsers: 0 });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selected, setSelected] = useState(null);
  const [editModal, setEditModal] = useState(false);
  const [editRole, setEditRole] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Debounce keyword
  const debounceRef = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // Reset page when status changes
  useEffect(() => { setPage(1); }, [status]);

  const fetchUsers = useCallback(async (pageOverride) => {
    if (!user) return;
    const p0 = (pageOverride ?? page) - 1; // 1-based UI → 0-based server
    const url = `${API_ENDPOINTS.ADMIN_USERS}?status=${status}&keyword=${encodeURIComponent(debouncedSearch)}&page=${p0}&size=${PAGE_SIZE}`;
    const { ok, data } = await apiGet(url, user.id);
    if (ok && data) {
      setUsers(Array.isArray(data.items) ? data.items : []);
      setTotalPages(data.totalPages ?? 1);
      setStats({
        totalUsers: data.totalUsers ?? 0,
        pendingUsers: data.pendingUsers ?? 0,
        approvedUsers: data.approvedUsers ?? 0,
      });
    } else {
      setUsers([]);
    }
  }, [user, status, debouncedSearch, page]);

  useEffect(() => {
    setLoading(true);
    fetchUsers().finally(() => setLoading(false));
  }, [fetchUsers]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
  };

  // ── Actions ────────────────────────────────────────────────────────────────
  const doApprove = (id, name) => {
    Alert.alert('Duyệt tài khoản', `Duyệt tài khoản của ${name}?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Duyệt',
        onPress: async () => {
          setActionLoading(true);
          const { ok } = await apiSend('POST', API_ENDPOINTS.ADMIN_USER_APPROVE(id), {}, user.id);
          setActionLoading(false);
          if (ok) {
            Toast.show({ type: 'success', text1: 'Đã duyệt tài khoản!' });
            fetchUsers();
          } else {
            Toast.show({ type: 'error', text1: 'Duyệt thất bại!' });
          }
        },
      },
    ]);
  };

  const doReject = (id, name) => {
    Alert.alert('Từ chối tài khoản', `Từ chối tài khoản của ${name}?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Từ chối',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          const { ok } = await apiSend('POST', API_ENDPOINTS.ADMIN_USER_REJECT(id), {}, user.id);
          setActionLoading(false);
          if (ok) {
            Toast.show({ type: 'success', text1: 'Đã từ chối tài khoản!' });
            fetchUsers();
          } else {
            Toast.show({ type: 'error', text1: 'Từ chối thất bại!' });
          }
        },
      },
    ]);
  };

  const doDelete = (id, name) => {
    Alert.alert('Xóa tài khoản', `Xóa tài khoản của ${name}? Hành động này không thể hoàn tác.`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          const { ok } = await apiSend('DELETE', API_ENDPOINTS.ADMIN_USER_DELETE(id), null, user.id);
          setActionLoading(false);
          if (ok) {
            Toast.show({ type: 'success', text1: 'Đã xóa tài khoản!' });
            fetchUsers();
          } else {
            Toast.show({ type: 'error', text1: 'Xóa thất bại!' });
          }
        },
      },
    ]);
  };

  const handleOpenEdit = (item) => {
    setSelected(item);
    setEditRole(item.role || '');
    setEditModal(true);
  };

  const handleSaveRole = async () => {
    if (!editRole) { Toast.show({ type: 'error', text1: 'Vui lòng chọn vai trò!' }); return; }
    setActionLoading(true);
    const { ok } = await apiSend('PUT', API_ENDPOINTS.ADMIN_USER_ROLE(selected.id), { role: editRole }, user.id);
    setActionLoading(false);
    if (ok) {
      Toast.show({ type: 'success', text1: 'Cập nhật vai trò thành công!' });
      setEditModal(false);
      fetchUsers();
    } else {
      Toast.show({ type: 'error', text1: 'Cập nhật vai trò thất bại!' });
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
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
      {/* Status segment */}
      <SegmentControl
        segments={STATUS_SEGMENTS}
        active={status}
        onChange={(key) => setStatus(key)}
        style={styles.segment}
      />

      {/* KPI stat row */}
      <View style={styles.statRow}>
        <StatCard variant="primary" label="Tổng tài khoản" value={stats.totalUsers} style={styles.statItem} />
        <StatCard variant="warning" label="Chờ duyệt" value={stats.pendingUsers} style={styles.statItem} />
        <StatCard variant="success" label="Đã duyệt" value={stats.approvedUsers} style={styles.statItem} />
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Input
          placeholder="Tìm theo tên, email, khoa..."
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* User list */}
      <View>
        {users.length === 0 ? (
          <Empty>
            {search
              ? `Không tìm thấy người dùng phù hợp với "${search}"`
              : status === 'pending'
                ? 'Không có tài khoản chờ duyệt'
                : 'Không có tài khoản đã duyệt'}
          </Empty>
        ) : (
          <>
            {users.map((item) => (
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
                  <Badge variant={item.status === 'approved' ? 'approved' : 'pending'}>
                    {item.status === 'approved' ? 'Đã duyệt' : 'Chờ duyệt'}
                  </Badge>
                </View>

                <View style={styles.cardActions}>
                  {status === 'pending' && (
                    <>
                      <Button
                        title="Duyệt"
                        variant="primary"
                        size="sm"
                        onPress={() => doApprove(item.id, item.fullName)}
                        style={styles.actionBtn}
                      />
                      <Button
                        title="Từ chối"
                        variant="danger"
                        size="sm"
                        onPress={() => doReject(item.id, item.fullName)}
                        style={styles.actionBtn}
                      />
                    </>
                  )}
                  {status === 'approved' && (
                    <Button
                      title="Sửa vai trò"
                      variant="secondary"
                      size="sm"
                      onPress={() => handleOpenEdit(item)}
                      style={styles.actionBtn}
                    />
                  )}
                  <Button
                    title="Xóa"
                    variant="danger"
                    size="sm"
                    onPress={() => doDelete(item.id, item.fullName)}
                    style={styles.actionBtn}
                  />
                </View>
              </View>
            ))}

            <Pagination
              page={page}
              totalPages={totalPages}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
            />
          </>
        )}
      </View>

      {/* Edit Role Modal */}
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
                  style={[styles.roleChip, editRole === r && styles.roleChipActive]}
                  onPress={() => setEditRole(r)}
                >
                  <Text style={[styles.roleChipText, editRole === r && styles.roleChipTextActive]}>
                    {ROLE_LABELS[r]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Button
              title={actionLoading ? '' : 'Lưu thay đổi'}
              onPress={handleSaveRole}
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
  content: { paddingBottom: 24, paddingHorizontal: 10, paddingTop: 14 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  segment: { marginBottom: 12 },
  statRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statItem: { flex: 1 },
  searchWrap: { marginBottom: 12 },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#e7ebf2',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#eff4ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: { color: colors.primary, fontSize: 16, fontFamily: fontFamily.extrabold },
  cardInfo: { flex: 1 },
  userName: { fontSize: fontSize.base, fontFamily: fontFamily.bold, color: colors.text },
  userEmail: { fontSize: fontSize.sm, color: colors.textSoft },
  userDept: { fontSize: fontSize.sm, color: colors.textMuted },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  actionBtn: { flex: 1, minWidth: 80 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalTitle: { fontSize: 18, fontFamily: fontFamily.bold, color: colors.primary, marginBottom: 4, textAlign: 'center' },
  editSubtitle: { fontSize: 14, color: colors.textSoft, marginBottom: 16, textAlign: 'center' },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20, marginTop: 6 },
  roleChip: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  roleChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  roleChipText: { fontSize: 14, color: colors.textSoft },
  roleChipTextActive: { color: colors.white, fontFamily: fontFamily.bold },
});
