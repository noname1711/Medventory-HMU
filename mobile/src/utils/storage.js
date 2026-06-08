import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  CURRENT_USER: 'currentUser',
  REMEMBERED_EMAIL: 'rememberedEmail',
  REMEMBER_ME: 'rememberMe',
};

export const storage = {
  // User session
  async saveUser(user) {
    await AsyncStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
  },
  async getUser() {
    try {
      const raw = await AsyncStorage.getItem(KEYS.CURRENT_USER);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  async removeUser() {
    await AsyncStorage.removeItem(KEYS.CURRENT_USER);
  },

  // Remember me
  async saveRememberMe(email) {
    await AsyncStorage.setItem(KEYS.REMEMBERED_EMAIL, email);
    await AsyncStorage.setItem(KEYS.REMEMBER_ME, 'true');
  },
  async getRememberedEmail() {
    const flag = await AsyncStorage.getItem(KEYS.REMEMBER_ME);
    if (flag !== 'true') return null;
    return AsyncStorage.getItem(KEYS.REMEMBERED_EMAIL);
  },
  async clearRememberMe() {
    await AsyncStorage.multiRemove([KEYS.REMEMBERED_EMAIL, KEYS.REMEMBER_ME]);
  },

  // Clear all auth data on logout
  async clearAll() {
    await AsyncStorage.multiRemove(Object.values(KEYS));
  },
};

export const formatTimeAgo = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return 'Vừa xong';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return date.toLocaleDateString('vi-VN');
};
