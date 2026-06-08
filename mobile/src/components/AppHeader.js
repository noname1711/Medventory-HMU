import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { API_ENDPOINTS, buildHeaders } from '../api/apiConfig';
import { formatTimeAgo } from '../utils/storage';

export default function AppHeader({ title }) {
  const insets = useSafeAreaInsets();
  const { user, logout, getDisplayName, getDisplayRole } = useAuth();
  const [showNoti, setShowNoti] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notiItems, setNotiItems] = useState([]);
  const [notiLoading, setNotiLoading] = useState(false);

  const userId = user?.id;

  const fetchNotifications = useCallback(
    async ({ unreadOnly = false, size = 20 } = {}) => {
      if (!userId) return null;
      try {
        const qs = new URLSearchParams({ unreadOnly: String(unreadOnly), page: '0', size: String(size) });
        const r = await fetch(`${API_ENDPOINTS.NOTIFICATIONS}?${qs}`, {
          headers: buildHeaders(userId),
        });
        if (!r.ok) return null;
        return await r.json();
      } catch { return null; }
    },
    [userId]
  );

  useEffect(() => {
    if (!userId) return;
    fetchNotifications({ unreadOnly: true, size: 1 }).then((res) => {
      if (res?.summary?.unreadCount !== undefined) setUnreadCount(res.summary.unreadCount);
    });
  }, [userId, fetchNotifications]);

  const handleToggleNoti = async () => {
    const next = !showNoti;
    setShowNoti(next);
    if (next && userId) {
      setNotiLoading(true);
      const res = await fetchNotifications({ unreadOnly: false, size: 20 });
      setNotiLoading(false);
      if (res) {
        setNotiItems(res.notifications || []);
        if (res.summary?.unreadCount !== undefined) setUnreadCount(res.summary.unreadCount);
      }
    }
  };

  const markRead = async (id) => {
    if (!userId) return;
    try {
      await fetch(API_ENDPOINTS.NOTIFICATION_READ(id), { method: 'POST', headers: buildHeaders(userId) });
    } catch {}
  };

  const markAllRead = async () => {
    if (!userId) return;
    try {
      await fetch(API_ENDPOINTS.NOTIFICATION_READ_ALL, { method: 'POST', headers: buildHeaders(userId) });
      setNotiItems((prev) => prev.map((it) => ({ ...it, isRead: true })));
      setUnreadCount(0);
    } catch {}
  };

  const handleNotiClick = async (item) => {
    if (!item.isRead) {
      await markRead(item.id);
      setNotiItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, isRead: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setShowNoti(false);
  };

  const displayName = getDisplayName();
  const displayRole = getDisplayRole(user?.role);

  return (
    <>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.brand}>
          <Text style={styles.brandTitle}>{title || 'Medventory HMU'}</Text>
          <Text style={styles.brandSub}>Bệnh viện Đại học Y Hà Nội</Text>
        </View>

        <View style={styles.right}>
          {/* Bell */}
          <TouchableOpacity style={styles.iconBtn} onPress={handleToggleNoti}>
            <Text style={styles.bellIcon}>🔔</Text>
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Avatar */}
          <TouchableOpacity style={styles.avatarBtn} onPress={() => setShowProfile(true)}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(user?.fullName || 'U')[0].toUpperCase()}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Notification Panel */}
      <Modal visible={showNoti} transparent animationType="fade">
        <Pressable style={styles.notiOverlay} onPress={() => setShowNoti(false)}>
          <Pressable style={styles.notiPanel} onPress={() => {}}>
            <View style={styles.notiHeader}>
              <Text style={styles.notiTitle}>Thông báo</Text>
              {unreadCount > 0 && (
                <TouchableOpacity onPress={markAllRead}>
                  <Text style={styles.markAllText}>Đọc tất cả</Text>
                </TouchableOpacity>
              )}
            </View>
            {notiLoading ? (
              <ActivityIndicator color="#1565C0" style={{ padding: 20 }} />
            ) : notiItems.length === 0 ? (
              <Text style={styles.emptyNoti}>Không có thông báo nào</Text>
            ) : (
              <ScrollView style={{ maxHeight: 360 }}>
                {notiItems.map((it) => (
                  <TouchableOpacity
                    key={it.id}
                    style={[styles.notiItem, !it.isRead && styles.notiItemUnread]}
                    onPress={() => handleNotiClick(it)}
                  >
                    <View style={styles.notiItemTop}>
                      <Text style={styles.notiItemTitle} numberOfLines={1}>{it.title}</Text>
                      {!it.isRead && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={styles.notiItemBody} numberOfLines={2}>{it.content}</Text>
                    <Text style={styles.notiItemTime}>{formatTimeAgo(it.createdAt)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Profile Modal */}
      <Modal visible={showProfile} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowProfile(false)}>
          <Pressable style={styles.profileSheet} onPress={() => {}}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>{(user?.fullName || 'U')[0].toUpperCase()}</Text>
            </View>
            <Text style={styles.profileName}>{displayName}</Text>
            <Text style={styles.profileRole}>{displayRole}</Text>
            <View style={styles.profileDivider} />
            {[
              ['Email', user?.email || '—'],
              ['Khoa/Phòng', user?.department?.name || user?.department || '—'],
            ].map(([k, v]) => (
              <View key={k} style={styles.profileRow}>
                <Text style={styles.profileKey}>{k}:</Text>
                <Text style={styles.profileVal} numberOfLines={1}>{v}</Text>
              </View>
            ))}
            <View style={styles.profileDivider} />
            <TouchableOpacity style={styles.logoutBtn} onPress={() => { setShowProfile(false); logout(); }}>
              <Text style={styles.logoutText}>⎋ Đăng xuất</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowProfile(false)}>
              <Text style={styles.closeBtnText}>Đóng</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#1565C0',
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  brand: {},
  brandTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  brandSub: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { position: 'relative', padding: 6 },
  bellIcon: { fontSize: 20 },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  avatarBtn: {},
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  // Notification
  notiOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  notiPanel: {
    position: 'absolute',
    top: 90,
    right: 12,
    width: 300,
    backgroundColor: '#FFF',
    borderRadius: 14,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    overflow: 'hidden',
  },
  notiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  notiTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  markAllText: { fontSize: 12, color: '#1565C0', fontWeight: '600' },
  emptyNoti: { textAlign: 'center', color: '#9BA3AF', padding: 20 },
  notiItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  notiItemUnread: { backgroundColor: '#EFF6FF' },
  notiItemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  notiItemTitle: { fontSize: 13, fontWeight: '600', color: '#1A1A2E', flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1565C0', marginLeft: 6 },
  notiItemBody: { fontSize: 12, color: '#6B7280', lineHeight: 16 },
  notiItemTime: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  // Profile modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  profileSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, alignItems: 'center' },
  profileAvatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#1565C0', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  profileAvatarText: { color: '#FFF', fontSize: 28, fontWeight: '700' },
  profileName: { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },
  profileRole: { fontSize: 14, color: '#6B7280', marginTop: 2, marginBottom: 12 },
  profileDivider: { width: '100%', height: 1, backgroundColor: '#F3F4F6', marginVertical: 10 },
  profileRow: { flexDirection: 'row', width: '100%', paddingVertical: 8 },
  profileKey: { fontSize: 13, color: '#6B7280', width: 90 },
  profileVal: { fontSize: 13, color: '#1A1A2E', fontWeight: '500', flex: 1 },
  logoutBtn: { width: '100%', backgroundColor: '#FEF2F2', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  logoutText: { fontSize: 15, color: '#EF4444', fontWeight: '700' },
  closeBtn: { width: '100%', backgroundColor: '#F3F4F6', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  closeBtnText: { fontSize: 15, color: '#374151', fontWeight: '600' },
});
