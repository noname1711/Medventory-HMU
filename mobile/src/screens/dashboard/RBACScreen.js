import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { API_ENDPOINTS, buildHeaders } from '../../api/apiConfig';
import { storage } from '../../utils/storage';

export default function RBACScreen() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [selected, setSelected] = useState(null);
  const [rolePerms, setRolePerms] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    storage.getUser().then((u) => {
      setCurrentUser(u);
      loadData(u?.id);
    });
  }, []);

  async function loadData(userId) {
    setLoading(true);
    try {
      const [rRes, pRes] = await Promise.all([
        fetch(API_ENDPOINTS.ROLES, { headers: buildHeaders(userId) }),
        fetch(API_ENDPOINTS.PERMISSIONS, { headers: buildHeaders(userId) }),
      ]);
      const rData = await rRes.json();
      const pData = await pRes.json();
      setRoles(Array.isArray(rData) ? rData : []);
      setPermissions(Array.isArray(pData) ? pData : []);
    } catch { setRoles([]); setPermissions([]); }
    finally { setLoading(false); }
  }

  const openRole = async (role) => {
    setSelected(role);
    try {
      const r = await fetch(`${API_ENDPOINTS.ROLES}/${role.id}/permissions`, {
        headers: buildHeaders(currentUser?.id),
      });
      const d = await r.json();
      setRolePerms(Array.isArray(d) ? d.map((p) => p.id || p.code) : []);
    } catch {
      setRolePerms(role.permissions?.map((p) => p.id || p.code) || []);
    }
  };

  const togglePerm = async (permId) => {
    const has = rolePerms.includes(permId);
    const newPerms = has ? rolePerms.filter((id) => id !== permId) : [...rolePerms, permId];
    setRolePerms(newPerms);

    setActionLoading(true);
    try {
      const r = await fetch(`${API_ENDPOINTS.ROLES}/${selected.id}/permissions`, {
        method: 'PUT',
        headers: buildHeaders(currentUser?.id),
        body: JSON.stringify({ permissionIds: newPerms }),
      });
      if (!r.ok) {
        setRolePerms(has ? newPerms.concat(permId) : newPerms.filter((id) => id !== permId));
        Toast.show({ type: 'error', text1: 'Cập nhật quyền thất bại!' });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Lỗi kết nối server!' });
    } finally {
      setActionLoading(false);
    }
  };

  const renderRole = ({ item }) => (
    <TouchableOpacity style={styles.roleCard} onPress={() => openRole(item)}>
      <View style={styles.roleLeft}>
        <View style={[styles.roleIcon, { backgroundColor: getRoleColor(item.code) + '20' }]}>
          <Text style={[styles.roleIconText, { color: getRoleColor(item.code) }]}>
            {(item.displayName || item.name || item.code || '?')[0].toUpperCase()}
          </Text>
        </View>
        <View>
          <Text style={styles.roleName}>{item.displayName || item.name || item.code}</Text>
          <Text style={styles.roleCode}>{item.code}</Text>
        </View>
      </View>
      <Text style={styles.permCount}>{(item.permissions || []).length} quyền</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color="#1565C0" /></View>
      ) : (
        <FlatList
          data={roles}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderRole}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Text style={styles.sectionTitle}>Danh sách vai trò</Text>
          }
          ListEmptyComponent={<Text style={styles.emptyText}>Không có vai trò nào</Text>}
        />
      )}

      {/* Permission editor modal */}
      <Modal visible={!!selected} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setSelected(null)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            {selected && (
              <>
                <Text style={styles.modalTitle}>
                  Quyền của: {selected.displayName || selected.name || selected.code}
                </Text>
                <ScrollView style={{ maxHeight: 400 }}>
                  {permissions.map((perm) => {
                    const permId = perm.id || perm.code;
                    const hasPerm = rolePerms.includes(permId);
                    return (
                      <View key={permId} style={styles.permRow}>
                        <View style={styles.permInfo}>
                          <Text style={styles.permCode}>{perm.code}</Text>
                          {perm.description && <Text style={styles.permDesc} numberOfLines={1}>{perm.description}</Text>}
                        </View>
                        <Switch
                          value={hasPerm}
                          onValueChange={() => togglePerm(permId)}
                          trackColor={{ false: '#E0E6EF', true: '#93C5FD' }}
                          thumbColor={hasPerm ? '#1565C0' : '#9CA3AF'}
                          disabled={actionLoading}
                        />
                      </View>
                    );
                  })}
                </ScrollView>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setSelected(null)}>
                  <Text style={styles.closeBtnText}>Đóng</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function getRoleColor(code) {
  if (!code) return '#6B7280';
  if (code.toLowerCase().includes('bgh') || code.toLowerCase().includes('lanhdao')) return '#7C3AED';
  if (code.toLowerCase().includes('thukho')) return '#2563EB';
  return '#059669';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 12, paddingBottom: 40 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginBottom: 12 },
  roleCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  roleLeft: { flexDirection: 'row', alignItems: 'center' },
  roleIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  roleIconText: { fontSize: 18, fontWeight: '700' },
  roleName: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  roleCode: { fontSize: 12, color: '#9CA3AF' },
  permCount: { fontSize: 13, color: '#1565C0', fontWeight: '600' },
  emptyText: { textAlign: 'center', color: '#9BA3AF', paddingVertical: 40, fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1565C0', marginBottom: 16, textAlign: 'center' },
  permRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  permInfo: { flex: 1, marginRight: 12 },
  permCode: { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  permDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  closeBtn: { backgroundColor: '#F3F4F6', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  closeBtnText: { fontSize: 15, fontWeight: '600', color: '#374151' },
});
