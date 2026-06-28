import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { API_ENDPOINTS } from '../../api/apiConfig';
import { apiGet, apiSend } from '../../api/apiClient';
import { useAuth } from '../../context/AuthContext';
import { Badge, Button, Empty, MonoBadge, Section, SegmentControl } from '../../theme/ui';
import { colors, fontSize, radius } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------
const SPECIAL_PERMISSIONS = ['USERS.MANAGE', 'PERMISSIONS.MANAGE'];
const LOCKED_ROLE_CODE = 'ADMIN';
const TAB_ROLE = 'ROLE';
const TAB_USER = 'USER';

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
function getRoleColor(code) {
  if (!code) return colors.textSoft;
  const lower = code.toLowerCase();
  if (lower.includes('bgh') || lower.includes('lanhdao')) return '#7C3AED';
  if (lower.includes('thukho')) return colors.statBlue;
  return colors.statGreen;
}

function userLabel(user) {
  if (!user) return '';
  const name = user.fullName || user.name || user.email || `#${user.id}`;
  const role = user.roleName || user.role || '';
  const email = user.email ? ` (${user.email})` : '';
  return `${name}${role ? ` — ${role}` : ''}${email}`;
}

// ----------------------------------------------------------------
// Main component
// ----------------------------------------------------------------
export default function RBACScreen() {
  const { user } = useAuth();
  const userId = user?.id;

  // ---- Catalog ----
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  // ---- Active tab ----
  const [activeTab, setActiveTab] = useState(TAB_ROLE);

  // ---- Auto-approve ----
  const [autoApproveEnabled, setAutoApproveEnabled] = useState(false);
  const [autoApproveLoading, setAutoApproveLoading] = useState(false);
  const [autoApproveSaving, setAutoApproveSaving] = useState(false);

  // ---- Role tab ----
  const [selectedRoleCode, setSelectedRoleCode] = useState('');
  const [selectedRoleName, setSelectedRoleName] = useState('');
  const [assignedPermCodes, setAssignedPermCodes] = useState([]);
  const [editingPermSet, setEditingPermSet] = useState(new Set());
  const [rolePermsLoading, setRolePermsLoading] = useState(false);
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleModalVisible, setRoleModalVisible] = useState(false);

  // ---- User tab ----
  const [allUsers, setAllUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  const [userEffectiveCodes, setUserEffectiveCodes] = useState([]);
  const [userRoleDefaultCodes, setUserRoleDefaultCodes] = useState([]);
  const [userPermsLoading, setUserPermsLoading] = useState(false);
  const [userPickerVisible, setUserPickerVisible] = useState(false);

  // ----------------------------------------------------------------
  // Computed
  // ----------------------------------------------------------------
  const isRoleLocked = useMemo(
    () => String(selectedRoleCode).toUpperCase() === LOCKED_ROLE_CODE,
    [selectedRoleCode]
  );

  const assignedSet = useMemo(
    () => new Set((assignedPermCodes || []).filter((c) => !SPECIAL_PERMISSIONS.includes(c))),
    [assignedPermCodes]
  );

  const dirtyRole = useMemo(() => {
    if (assignedSet.size !== editingPermSet.size) return true;
    for (const c of assignedSet) { if (!editingPermSet.has(c)) return true; }
    return false;
  }, [editingPermSet, assignedSet]);

  const userRoleDefaultSet = useMemo(() => new Set(userRoleDefaultCodes || []), [userRoleDefaultCodes]);
  const userEffectiveSet = useMemo(
    () => new Set([...(userEffectiveCodes || []), ...(userRoleDefaultCodes || [])]),
    [userEffectiveCodes, userRoleDefaultCodes]
  );

  const selectablePermCount = useMemo(
    () => (permissions || []).filter((p) => !SPECIAL_PERMISSIONS.includes(p?.code)).length,
    [permissions]
  );

  // ----------------------------------------------------------------
  // Load helpers
  // ----------------------------------------------------------------
  const loadAutoApprove = useCallback(async () => {
    setAutoApproveLoading(true);
    const { ok, data } = await apiGet(API_ENDPOINTS.SETTINGS_AUTO_APPROVE, userId);
    if (ok && data != null) setAutoApproveEnabled(!!data.enabled);
    setAutoApproveLoading(false);
  }, [userId]);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    const [rRes, pRes] = await Promise.all([
      apiGet(API_ENDPOINTS.RBAC_ROLES, userId),
      apiGet(API_ENDPOINTS.RBAC_PERMISSIONS, userId),
    ]);
    const roleList = rRes.ok && Array.isArray(rRes.data) ? rRes.data : [];
    const permList = pRes.ok && Array.isArray(pRes.data) ? pRes.data : [];
    setRoles(roleList);
    setPermissions(permList);
    setCatalogLoading(false);

    // Auto-select first non-ADMIN role
    if (!selectedRoleCode && roleList.length > 0) {
      const first =
        roleList.find((r) => String(r.code).toUpperCase() !== LOCKED_ROLE_CODE) || roleList[0];
      if (first?.code) await loadRolePerms(String(first.code));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const loadRolePerms = useCallback(async (code) => {
    if (!code) return;
    setRolePermsLoading(true);
    const { ok, data } = await apiGet(API_ENDPOINTS.RBAC_ROLE_PERMS(code), userId);
    if (ok && data) {
      const roleCode = data.roleCode || code;
      const roleName = data.roleName || '';
      const assigned = Array.isArray(data.assignedPermissionCodes) ? data.assignedPermissionCodes : [];
      setSelectedRoleCode(roleCode);
      setSelectedRoleName(roleName);
      setAssignedPermCodes(assigned);
      setEditingPermSet(new Set(assigned.filter((c) => !SPECIAL_PERMISSIONS.includes(c))));
    } else {
      Toast.show({ type: 'error', text1: 'Không thể tải quyền của role' });
    }
    setRolePermsLoading(false);
  }, [userId]);

  const loadAllUsers = useCallback(async () => {
    setUsersLoading(true);
    const { ok, data } = await apiGet(API_ENDPOINTS.ADMIN_USERS_ALL, userId);
    if (ok && Array.isArray(data)) setAllUsers(data);
    setUsersLoading(false);
  }, [userId]);

  const loadUserPerms = useCallback(async (uid) => {
    if (!uid) return;
    setUserPermsLoading(true);
    const { ok, data } = await apiGet(API_ENDPOINTS.RBAC_USER_PERMS(uid), userId);
    if (ok && data) {
      setUserInfo({
        id: data.userId,
        fullName: data.fullName,
        email: data.email,
        roleCode: data.roleCode,
        roleName: data.roleName,
      });
      setUserEffectiveCodes(Array.isArray(data.effectivePermissionCodes) ? data.effectivePermissionCodes : []);
      setUserRoleDefaultCodes(Array.isArray(data.rolePermissionCodes) ? data.rolePermissionCodes : []);
    } else {
      Toast.show({ type: 'error', text1: 'Không thể tải quyền của người dùng' });
    }
    setUserPermsLoading(false);
  }, [userId]);

  // ----------------------------------------------------------------
  // Initial load
  // ----------------------------------------------------------------
  useEffect(() => {
    loadCatalog();
    loadAllUsers();
    loadAutoApprove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----------------------------------------------------------------
  // Auto-approve toggle
  // ----------------------------------------------------------------
  const handleAutoApproveToggle = async (next) => {
    setAutoApproveEnabled(next);
    setAutoApproveSaving(true);
    const { ok, data } = await apiSend('PUT', API_ENDPOINTS.SETTINGS_AUTO_APPROVE, { enabled: next }, userId);
    if (ok && data != null) {
      setAutoApproveEnabled(!!data.enabled);
      Toast.show({
        type: 'success',
        text1: data.enabled ? 'Đã bật tự động phê duyệt' : 'Đã tắt tự động phê duyệt',
      });
    } else {
      setAutoApproveEnabled(!next); // revert
      Toast.show({ type: 'error', text1: 'Không thể lưu thiết lập' });
    }
    setAutoApproveSaving(false);
  };

  // ----------------------------------------------------------------
  // Role tab actions
  // ----------------------------------------------------------------
  const handleRoleSelect = async (code) => {
    await loadRolePerms(code);
    setRoleModalVisible(true);
  };

  const toggleRolePerm = (code) => {
    if (SPECIAL_PERMISSIONS.includes(code)) {
      Toast.show({ type: 'error', text1: `Quyền ${code} chỉ dành cho Admin` });
      return;
    }
    setEditingPermSet((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const saveRolePerms = async () => {
    if (!selectedRoleCode || isRoleLocked) return;
    const arr = Array.from(editingPermSet);
    if (SPECIAL_PERMISSIONS.some((s) => arr.includes(s))) {
      Toast.show({ type: 'error', text1: 'Không thể thêm quyền đặc biệt vào role' });
      return;
    }
    setRoleSaving(true);
    const { ok, data } = await apiSend(
      'PUT',
      API_ENDPOINTS.RBAC_ROLE_PERMS(selectedRoleCode),
      { permissionCodes: arr },
      userId
    );
    if (ok && data) {
      const assigned = Array.isArray(data.assignedPermissionCodes) ? data.assignedPermissionCodes : [];
      setAssignedPermCodes(assigned);
      setEditingPermSet(new Set(assigned.filter((c) => !SPECIAL_PERMISSIONS.includes(c))));
      Toast.show({ type: 'success', text1: `Đã lưu quyền cho ${data.roleCode || selectedRoleCode}` });
    } else {
      Toast.show({ type: 'error', text1: 'Lưu quyền thất bại' });
    }
    setRoleSaving(false);
  };

  const resetRolePerms = () => {
    if (!selectedRoleCode || isRoleLocked) return;
    Alert.alert(
      'Đặt về mặc định?',
      `Quyền của role ${selectedRoleCode} sẽ quay về mặc định hệ thống.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đặt về mặc định',
          style: 'destructive',
          onPress: async () => {
            setRoleSaving(true);
            const { ok, data } = await apiSend(
              'POST',
              API_ENDPOINTS.RBAC_ROLE_PERMS_RESET(selectedRoleCode),
              {},
              userId
            );
            if (ok && data) {
              const assigned = Array.isArray(data.assignedPermissionCodes) ? data.assignedPermissionCodes : [];
              setAssignedPermCodes(assigned);
              setEditingPermSet(new Set(assigned.filter((c) => !SPECIAL_PERMISSIONS.includes(c))));
              Toast.show({ type: 'success', text1: 'Đã đặt về mặc định' });
            } else {
              Toast.show({ type: 'error', text1: 'Reset thất bại' });
            }
            setRoleSaving(false);
          },
        },
      ]
    );
  };

  // ----------------------------------------------------------------
  // User picker select
  // ----------------------------------------------------------------
  const handleUserSelect = async (u) => {
    const uid = String(u.id);
    setSelectedUserId(uid);
    setUserPickerVisible(false);
    await loadUserPerms(uid);
  };

  // ----------------------------------------------------------------
  // RENDER: Auto-approve section
  // ----------------------------------------------------------------
  const renderAutoApprove = () => {
    const disabled = autoApproveLoading || autoApproveSaving;
    return (
      <View style={styles.autoApproveCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.autoApproveTitle}>Tự động phê duyệt phiếu xin lĩnh</Text>
          <Text style={styles.autoApproveDesc}>
            Tự duyệt khi đủ tồn kho và hệ thống giữ chỗ vật tư thành công.
          </Text>
        </View>
        <View style={styles.switchWrap}>
          {autoApproveLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Switch
              value={autoApproveEnabled}
              onValueChange={handleAutoApproveToggle}
              disabled={disabled}
              trackColor={{ false: colors.borderStrong, true: '#93C5FD' }}
              thumbColor={autoApproveEnabled ? colors.primary : colors.textMuted}
            />
          )}
          <Text style={styles.switchLabel}>
            {autoApproveSaving ? 'Đang lưu...' : autoApproveEnabled ? 'Đang bật' : 'Đang tắt'}
          </Text>
        </View>
      </View>
    );
  };

  // ----------------------------------------------------------------
  // RENDER: Role tab
  // ----------------------------------------------------------------
  const renderRoleTab = () => {
    if (catalogLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }
    if (roles.length === 0) {
      return <Empty>Không có vai trò nào</Empty>;
    }

    return (
      <>
        {roles.map((role) => {
          const code = String(role.code || '');
          const locked = code.toUpperCase() === LOCKED_ROLE_CODE;
          const color = getRoleColor(code);
          return (
            <TouchableOpacity
              key={code}
              style={styles.roleCard}
              onPress={() => handleRoleSelect(code)}
              activeOpacity={0.85}
            >
              <View style={styles.roleLeft}>
                <View style={[styles.roleIcon, { backgroundColor: color + '20' }]}>
                  <Text style={[styles.roleIconText, { color }]}>
                    {(role.displayName || role.name || code || '?')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.roleName} numberOfLines={1}>
                    {role.displayName || role.name || code}
                  </Text>
                  <MonoBadge>{code}</MonoBadge>
                </View>
              </View>
              <View style={styles.roleRight}>
                {locked && <Badge variant="danger">Khóa</Badge>}
                <Text style={styles.roleArrow}>›</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </>
    );
  };

  // ----------------------------------------------------------------
  // RENDER: Role perm editor modal
  // ----------------------------------------------------------------
  const renderRoleModal = () => {
    const editingArr = Array.from(editingPermSet);
    const selectableCount = editingArr.filter((c) => !SPECIAL_PERMISSIONS.includes(c)).length;

    return (
      <Modal visible={roleModalVisible} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setRoleModalVisible(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  Quyền của: {selectedRoleName || selectedRoleCode}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {isRoleLocked
                    ? 'Role ADMIN bị khóa — chỉ xem'
                    : `${selectableCount} / ${selectablePermCount} quyền được chọn${dirtyRole ? ' · Chưa lưu' : ''}`}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setRoleModalVisible(false)} style={styles.modalClose}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Permission list */}
            {rolePermsLoading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 24 }} />
            ) : (
              <ScrollView style={styles.permScroll} showsVerticalScrollIndicator={false}>
                {permissions.map((perm) => {
                  const code = perm?.code || '';
                  const isSpecial = SPECIAL_PERMISSIONS.includes(code);
                  const checked = isSpecial
                    ? assignedPermCodes.includes(code)
                    : editingPermSet.has(code);
                  const disabled = isRoleLocked || roleSaving || isSpecial;
                  return (
                    <TouchableOpacity
                      key={code}
                      style={[
                        styles.permRow,
                        checked && styles.permRowChecked,
                        disabled && styles.permRowDisabled,
                      ]}
                      onPress={() => !disabled && toggleRolePerm(code)}
                      activeOpacity={disabled ? 1 : 0.75}
                    >
                      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                        {checked && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <View style={styles.permInfo}>
                        <View style={styles.permCodeRow}>
                          <Text style={styles.permCode}>{code}</Text>
                          {isSpecial && (
                            <View style={styles.specialBadge}>
                              <Text style={styles.specialBadgeText}>Chỉ Admin</Text>
                            </View>
                          )}
                        </View>
                        {perm.description ? (
                          <Text style={styles.permDesc} numberOfLines={2}>{perm.description}</Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Actions */}
            {!isRoleLocked && (
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnSecondary]}
                  onPress={resetRolePerms}
                  disabled={roleSaving}
                >
                  <Text style={styles.modalBtnSecText}>Về mặc định</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnPrimary, (!dirtyRole || roleSaving) && styles.modalBtnDisabled]}
                  onPress={saveRolePerms}
                  disabled={!dirtyRole || roleSaving}
                >
                  <Text style={styles.modalBtnPriText}>
                    {roleSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  // ----------------------------------------------------------------
  // RENDER: User tab
  // ----------------------------------------------------------------
  const renderUserTab = () => {
    const selectedUser = allUsers.find((u) => String(u.id) === String(selectedUserId));

    return (
      <>
        {/* User picker button */}
        <TouchableOpacity
          style={styles.userPickerBtn}
          onPress={() => setUserPickerVisible(true)}
          disabled={usersLoading}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.userPickerLabel}>Chọn người dùng</Text>
            <Text style={styles.userPickerValue} numberOfLines={1}>
              {selectedUser ? userLabel(selectedUser) : 'Nhấn để chọn...'}
            </Text>
          </View>
          <Text style={styles.roleArrow}>›</Text>
        </TouchableOpacity>

        {/* Note (read-only) */}
        <View style={styles.readOnlyNote}>
          <Text style={styles.readOnlyNoteText}>
            Chỉnh sửa quyền theo người dùng trên bản web.
          </Text>
        </View>

        {/* User info */}
        {userInfo && (
          <View style={styles.userInfoCard}>
            <Text style={styles.userInfoName}>{userInfo.fullName || '—'}</Text>
            <Text style={styles.userInfoMeta}>
              {userInfo.roleName || userInfo.roleCode || '—'}
              {userInfo.email ? `  ·  ${userInfo.email}` : ''}
            </Text>
          </View>
        )}

        {/* Permissions (read-only) */}
        {userPermsLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 24 }} />
        ) : selectedUserId ? (
          <>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: colors.infoBg, borderColor: colors.infoText }]} />
              <Text style={styles.legendText}>{userRoleDefaultSet.size} quyền mặc định theo vai trò</Text>
              <View style={[styles.legendDot, { backgroundColor: '#ede9fe', borderColor: '#7C3AED', marginLeft: 14 }]} />
              <Text style={styles.legendText}>
                {(userEffectiveCodes || []).filter((c) => !userRoleDefaultSet.has(c)).length} quyền cấp riêng
              </Text>
            </View>
            {permissions.length === 0 ? (
              <Empty>Không có quyền nào</Empty>
            ) : (
              permissions.map((perm) => {
                const code = perm?.code || '';
                const isDefault = userRoleDefaultSet.has(code);
                const isEffective = userEffectiveSet.has(code);
                const isExtra = isEffective && !isDefault;

                return (
                  <View
                    key={code}
                    style={[
                      styles.permRow,
                      isDefault && styles.permRowDefault,
                      isExtra && styles.permRowExtra,
                    ]}
                  >
                    <View style={[styles.checkbox, isEffective && styles.checkboxChecked, styles.checkboxReadOnly]}>
                      {isEffective && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <View style={styles.permInfo}>
                      <View style={styles.permCodeRow}>
                        <Text style={styles.permCode}>{code}</Text>
                        {isDefault && (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>Mặc định role</Text>
                          </View>
                        )}
                        {isExtra && (
                          <View style={styles.extraBadge}>
                            <Text style={styles.extraBadgeText}>Cấp riêng</Text>
                          </View>
                        )}
                      </View>
                      {perm.description ? (
                        <Text style={styles.permDesc} numberOfLines={2}>{perm.description}</Text>
                      ) : null}
                    </View>
                  </View>
                );
              })
            )}
          </>
        ) : (
          <Empty>Chọn người dùng để xem quyền</Empty>
        )}
      </>
    );
  };

  // ----------------------------------------------------------------
  // RENDER: User picker modal
  // ----------------------------------------------------------------
  const renderUserPickerModal = () => (
    <Modal visible={userPickerVisible} transparent animationType="slide">
      <Pressable style={styles.modalOverlay} onPress={() => setUserPickerVisible(false)}>
        <Pressable style={styles.modalSheet} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Chọn người dùng</Text>
            <TouchableOpacity onPress={() => setUserPickerVisible(false)} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          {usersLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 24 }} />
          ) : allUsers.length === 0 ? (
            <Empty>Không có người dùng nào</Empty>
          ) : (
            <FlatList
              data={allUsers}
              keyExtractor={(u) => String(u.id)}
              style={{ maxHeight: 420 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.userPickerItem,
                    String(item.id) === String(selectedUserId) && styles.userPickerItemActive,
                  ]}
                  onPress={() => handleUserSelect(item)}
                >
                  <Text style={styles.userPickerItemName} numberOfLines={1}>
                    {item.fullName || item.name || `#${item.id}`}
                  </Text>
                  <Text style={styles.userPickerItemMeta} numberOfLines={1}>
                    {item.roleName || item.role || ''}
                    {item.email ? `  ·  ${item.email}` : ''}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );

  // ----------------------------------------------------------------
  // Main render
  // ----------------------------------------------------------------
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Auto-approve */}
      {renderAutoApprove()}

      {/* Segment tabs */}
      <SegmentControl
        segments={[
          { key: TAB_ROLE, label: 'Phân quyền theo role' },
          { key: TAB_USER, label: 'Phân quyền theo user' },
        ]}
        active={activeTab}
        onChange={setActiveTab}
        style={styles.segmentControl}
      />

      {/* Tab content */}
      <View style={styles.tabContent}>
        {activeTab === TAB_ROLE ? renderRoleTab() : renderUserTab()}
      </View>

      {/* Modals */}
      {renderRoleModal()}
      {renderUserPickerModal()}
    </ScrollView>
  );
}

// ----------------------------------------------------------------
// Styles
// ----------------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 32, paddingHorizontal: 12, paddingTop: 14 },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 32 },

  // Auto-approve card
  autoApproveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 14,
    marginTop: 12,
    gap: 12,
  },
  autoApproveTitle: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
    color: colors.text,
    marginBottom: 3,
  },
  autoApproveDesc: {
    fontSize: fontSize.sm,
    color: colors.textSoft,
    lineHeight: 17,
  },
  switchWrap: { alignItems: 'center', gap: 4 },
  switchLabel: { fontSize: fontSize.xs, color: colors.textSoft, fontFamily: fontFamily.medium },

  // Segment
  segmentControl: { marginTop: 14 },

  // Tab content wrapper
  tabContent: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginTop: 4,
  },

  // Role cards
  roleCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#e7ebf2',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  roleLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  roleRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roleIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconText: { fontSize: 18, fontFamily: fontFamily.bold },
  roleName: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
    color: colors.text,
    marginBottom: 4,
  },
  roleArrow: {
    fontSize: 22,
    color: colors.textSoft,
    fontFamily: fontFamily.bold,
  },

  // User picker button
  userPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: 10,
    backgroundColor: colors.white,
  },
  userPickerLabel: {
    fontSize: fontSize.sm,
    color: colors.textSoft,
    fontFamily: fontFamily.medium,
    marginBottom: 2,
  },
  userPickerValue: {
    fontSize: fontSize.base,
    color: colors.text,
    fontFamily: fontFamily.bold,
  },

  // Read-only note
  readOnlyNote: {
    backgroundColor: colors.warningBg,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
    borderRadius: radius.sm,
    padding: 10,
    marginBottom: 12,
  },
  readOnlyNoteText: {
    fontSize: fontSize.sm,
    color: colors.warningText,
    fontFamily: fontFamily.medium,
  },

  // User info card
  userInfoCard: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: 12,
  },
  userInfoName: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
    color: colors.text,
    marginBottom: 2,
  },
  userInfoMeta: {
    fontSize: fontSize.sm,
    color: colors.textSoft,
    fontFamily: fontFamily.regular,
  },

  // Legend
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 4,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  legendText: {
    fontSize: fontSize.sm,
    color: colors.textSoft,
    fontFamily: fontFamily.medium,
  },

  // Permission rows (shared)
  permRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    gap: 10,
  },
  permRowChecked: { backgroundColor: '#f0f7ff' },
  permRowDisabled: { opacity: 0.5 },
  permRowDefault: { backgroundColor: '#f0f9ff' },
  permRowExtra: { backgroundColor: '#f5f3ff' },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    backgroundColor: colors.white,
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxReadOnly: { opacity: 0.8 },
  checkmark: { color: colors.white, fontSize: 13, fontFamily: fontFamily.bold },

  permInfo: { flex: 1 },
  permCodeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  permCode: {
    fontSize: 13,
    fontFamily: fontFamily.semibold,
    color: colors.text,
  },
  permDesc: {
    fontSize: fontSize.sm,
    color: colors.textSoft,
    marginTop: 2,
    lineHeight: 16,
  },

  // Permission badges
  specialBadge: {
    backgroundColor: colors.dangerBg,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  specialBadgeText: { fontSize: 10, color: colors.dangerText, fontFamily: fontFamily.bold },
  defaultBadge: {
    backgroundColor: colors.infoBg,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  defaultBadgeText: { fontSize: 10, color: colors.infoText, fontFamily: fontFamily.bold },
  extraBadge: {
    backgroundColor: '#ede9fe',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  extraBadgeText: { fontSize: 10, color: '#6d28d9', fontFamily: fontFamily.bold },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 10,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.bold,
    color: colors.primary,
  },
  modalSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSoft,
    marginTop: 2,
  },
  modalClose: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    color: colors.textSoft,
    fontFamily: fontFamily.bold,
  },
  permScroll: { maxHeight: 400 },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  modalBtnPrimary: { backgroundColor: colors.primary },
  modalBtnSecondary: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  modalBtnDisabled: { opacity: 0.5 },
  modalBtnPriText: { color: colors.white, fontSize: fontSize.base, fontFamily: fontFamily.bold },
  modalBtnSecText: { color: colors.text, fontSize: fontSize.base, fontFamily: fontFamily.bold },

  // User picker list
  userPickerItem: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  userPickerItemActive: { backgroundColor: colors.primarySoft },
  userPickerItemName: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
    color: colors.text,
  },
  userPickerItemMeta: {
    fontSize: fontSize.sm,
    color: colors.textSoft,
    marginTop: 2,
  },
});
