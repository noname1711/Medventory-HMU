import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
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
import { colors, radius, fontSize } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import { PageFrame, PageHead, Section, Badge, Empty } from '../../theme/ui';

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
    >
      <PageFrame>
        <PageHead title="Phân quyền vai trò" />

        <Section title="Danh sách vai trò">
          {roles.length === 0 ? (
            <Empty>Không có vai trò nào</Empty>
          ) : (
            roles.map((item) => (
              <TouchableOpacity
                key={String(item.id)}
                style={styles.roleCard}
                onPress={() => openRole(item)}
              >
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
                <Badge variant="info">{(item.permissions || []).length} quyền</Badge>
              </TouchableOpacity>
            ))
          )}
        </Section>
      </PageFrame>

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
                          trackColor={{ false: colors.border, true: '#93C5FD' }}
                          thumbColor={hasPerm ? colors.primary : colors.textMuted}
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
    </ScrollView>
  );
}

function getRoleColor(code) {
  if (!code) return colors.textSoft;
  if (code.toLowerCase().includes('bgh') || code.toLowerCase().includes('lanhdao')) return '#7C3AED';
  if (code.toLowerCase().includes('thukho')) return colors.statBlue;
  return colors.statGreen;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 24 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  roleCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  roleLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  roleIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  roleIconText: { fontSize: 18, fontFamily: fontFamily.bold },
  roleName: { fontSize: fontSize.base, fontFamily: fontFamily.bold, color: colors.text },
  roleCode: { fontSize: fontSize.sm, color: colors.textMuted },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontFamily: fontFamily.bold, color: colors.primary, marginBottom: 16, textAlign: 'center' },
  permRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  permInfo: { flex: 1, marginRight: 12 },
  permCode: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.text },
  permDesc: { fontSize: 12, color: colors.textSoft, marginTop: 2 },
  closeBtn: { backgroundColor: colors.borderSoft, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  closeBtnText: { fontSize: 15, fontFamily: fontFamily.semibold, color: colors.label },
});
