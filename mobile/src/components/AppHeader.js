import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { API_ENDPOINTS, buildHeaders } from '../api/apiConfig';
import { formatTimeAgo } from '../utils/storage';
import { colors, radius, shadow, fontSize } from '../theme/tokens';
import { fontFamily } from '../theme/typography';

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

  const initials = (user?.fullName || 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

  return (
    <>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        {/* Logo + title */}
        <View style={styles.brand}>
          <View style={styles.logoCircle}>
            <Image source={require('../../assets/logo.jpg')} style={styles.logoImg} />
          </View>
          <View>
            <Text style={styles.brandTitle}>{title || 'Medventory HMU'}</Text>
            <Text style={styles.brandSub}>{displayRole || 'Bệnh viện Đại học Y Hà Nội'}</Text>
          </View>
        </View>

        <View style={styles.right}>
          {/* Bell */}
          <TouchableOpacity style={styles.iconBtn} onPress={handleToggleNoti}>
            <Ionicons name="notifications-outline" size={20} color="#fff" />
            {unreadCount > 0 && <View style={styles.badge} />}
          </TouchableOpacity>

          {/* Avatar */}
          <TouchableOpacity style={styles.avatarBtn} onPress={() => setShowProfile(true)}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
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
              <ActivityIndicator color={colors.primary} style={{ padding: 20 }} />
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
    backgroundColor: '#1e40af',
    paddingHorizontal: 18,
    paddingBottom: 14,
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  logoCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  logoImg: { width: 36, height: 36, resizeMode: 'cover' },
  brandTitle: { fontSize: fontSize.base, fontFamily: fontFamily.extrabold, color: '#fff', lineHeight: 19 },
  brandSub: { fontSize: fontSize.xs, fontFamily: fontFamily.regular, color: 'rgba(255,255,255,0.8)', marginTop: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: {
    position: 'relative',
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    backgroundColor: '#ef4444',
    borderRadius: 4,
  },
  avatarBtn: {},
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#1e40af', fontSize: fontSize.sm, fontFamily: fontFamily.black },
  // Notification
  notiOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  notiPanel: {
    position: 'absolute',
    top: 90,
    right: 12,
    width: 320,
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
    overflow: 'hidden',
  },
  notiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: colors.borderSoft, backgroundColor: colors.bg },
  notiTitle: { fontSize: fontSize.base, fontFamily: fontFamily.extrabold, color: colors.text },
  markAllText: { fontSize: fontSize.sm, color: colors.primary, fontFamily: fontFamily.extrabold },
  emptyNoti: { textAlign: 'center', color: colors.textMuted, padding: 20, fontFamily: fontFamily.regular },
  notiItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  notiItemUnread: { backgroundColor: colors.white },
  notiItemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  notiItemTitle: { fontSize: 13, fontFamily: fontFamily.bold, color: colors.text, flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginLeft: 6 },
  notiItemBody: { fontSize: fontSize.sm, fontFamily: fontFamily.regular, color: '#4b5563', lineHeight: 16 },
  notiItemTime: { fontSize: fontSize.xs, fontFamily: fontFamily.regular, color: colors.textMuted, marginTop: 4 },
  // Profile modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  profileSheet: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, alignItems: 'center' },
  profileAvatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  profileAvatarText: { color: colors.white, fontSize: 28, fontFamily: fontFamily.black },
  profileName: { fontSize: fontSize.lg, fontFamily: fontFamily.extrabold, color: colors.text },
  profileRole: { fontSize: fontSize.base, fontFamily: fontFamily.regular, color: colors.textSoft, marginTop: 2, marginBottom: 12 },
  profileDivider: { width: '100%', height: 1, backgroundColor: colors.borderSoft, marginVertical: 10 },
  profileRow: { flexDirection: 'row', width: '100%', paddingVertical: 8 },
  profileKey: { fontSize: 13, fontFamily: fontFamily.semibold, color: colors.textSoft, width: 90 },
  profileVal: { fontSize: 13, fontFamily: fontFamily.medium, color: colors.text, flex: 1 },
  logoutBtn: { width: '100%', backgroundColor: '#fef2f2', borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  logoutText: { fontSize: fontSize.md, color: colors.danger, fontFamily: fontFamily.bold },
  closeBtn: { width: '100%', backgroundColor: colors.borderSoft, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  closeBtnText: { fontSize: fontSize.md, color: colors.label, fontFamily: fontFamily.semibold },
});
