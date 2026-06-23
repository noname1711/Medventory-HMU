import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Cổng của backend Spring Boot
const BACKEND_PORT = 8080;

// Nếu không tự dò được IP (vd. build production), dùng IP này làm dự phòng.
// Để trống nếu không cần.
const FALLBACK_HOST = '';

// Tự động lấy IP LAN của máy chạy server từ kết nối Expo.
// Nhờ vậy mọi thiết bị trong cùng mạng Wi-Fi đều truy cập được mà
// không cần sửa IP thủ công mỗi khi đổi mạng.
function resolveHost() {
  // hostUri ví dụ: "172.19.187.10:8081"
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    Constants.manifest?.debuggerHost ||
    '';

  const host = hostUri.split(':')[0];

  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return host;
  }

  // Trên Android emulator, localhost của máy là 10.0.2.2
  if (Platform.OS === 'android') return '10.0.2.2';

  return FALLBACK_HOST || 'localhost';
}

export const API_BASE_URL = `http://${resolveHost()}:${BACKEND_PORT}/api`;

export const API_ENDPOINTS = {
  // Auth
  LOGIN: `${API_BASE_URL}/auth/login`,
  REGISTER: `${API_BASE_URL}/auth/register`,
  DEPARTMENTS: `${API_BASE_URL}/auth/departments`,
  FORGOT_PASSWORD: `${API_BASE_URL}/auth/forgot-password`,
  RESET_PASSWORD: `${API_BASE_URL}/auth/reset-password`,
  MY_PERMISSIONS: `${API_BASE_URL}/auth/my-permissions`,

  // Inventory / Materials
  MATERIALS: `${API_BASE_URL}/materials`,
  INVENTORY_MATERIALS: `${API_BASE_URL}/inventory/materials`,
  UNITS: `${API_BASE_URL}/units`,

  // Issue Requests
  ISSUE_REQUESTS: `${API_BASE_URL}/issue-requests`,

  // Departments
  SUB_DEPARTMENTS: `${API_BASE_URL}/departments/sub-departments`,

  // Replenishment / Forecast
  REPLENISHMENTS: `${API_BASE_URL}/replenishments`,
  FORECASTS: `${API_BASE_URL}/forecasts`,

  // Receipt (Nhập kho)
  RECEIPTS: `${API_BASE_URL}/receipts`,

  // Issue (Xuất kho)
  ISSUES: `${API_BASE_URL}/issues`,

  // Notifications
  NOTIFICATIONS: `${API_BASE_URL}/notifications/my`,
  NOTIFICATION_READ: (id) => `${API_BASE_URL}/notifications/${id}/read`,
  NOTIFICATION_READ_ALL: `${API_BASE_URL}/notifications/read-all`,

  // Users (Admin)
  USERS: `${API_BASE_URL}/users`,

  // RBAC
  ROLES: `${API_BASE_URL}/roles`,
  PERMISSIONS: `${API_BASE_URL}/permissions`,
};

// Helper: tạo headers chung
export const buildHeaders = (userId = null) => {
  const headers = { 'Content-Type': 'application/json' };
  if (userId) headers['X-User-Id'] = String(userId);
  return headers;
};
