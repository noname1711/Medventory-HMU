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
  USER_INFO: (email) => `${API_BASE_URL}/auth/user-info?email=${encodeURIComponent(email)}`,

  // Materials / inventory / units
  MATERIALS: `${API_BASE_URL}/materials`,
  MATERIALS_SEARCH: `${API_BASE_URL}/materials/search`,
  INVENTORY_MATERIALS: `${API_BASE_URL}/inventory/materials`,
  UNITS: `${API_BASE_URL}/units`,
  SUB_DEPARTMENTS: `${API_BASE_URL}/departments/sub-departments`,
  DEPARTMENTS_ALL: `${API_BASE_URL}/departments`,

  // Issue requests (phiếu xin lĩnh)
  ISSUE_REQ_LEADER_PENDING: `${API_BASE_URL}/issue-requests/leader/pending`,
  ISSUE_REQ_LEADER_PROCESSED: `${API_BASE_URL}/issue-requests/leader/processed`,
  ISSUE_REQ_DETAIL: (id) => `${API_BASE_URL}/issue-requests/${id}/detail`,
  ISSUE_REQ_APPROVE: (id) => `${API_BASE_URL}/issue-requests/${id}/approve`,
  ISSUE_REQ_REJECT: (id) => `${API_BASE_URL}/issue-requests/${id}/reject`,
  ISSUE_REQ_MINE: `${API_BASE_URL}/issue-requests/canbo/my-requests`,
  ISSUE_REQ_CREATE: `${API_BASE_URL}/issue-requests/canbo/create`,

  // Supp forecast (dự trù)
  SUPP_FORECAST_CREATE: `${API_BASE_URL}/supp-forecast`,
  SUPP_FORECAST_MINE: `${API_BASE_URL}/supp-forecast/my`,
  SUPP_FORECAST_PREVIOUS: `${API_BASE_URL}/supp-forecast/previous`,
  SUPP_FORECAST_DETAIL: (id) => `${API_BASE_URL}/supp-forecast/${id}`,
  SUPP_FORECAST_BGH_PENDING: `${API_BASE_URL}/supp-forecast/bgh/pending`,
  SUPP_FORECAST_BGH_PROCESSED: `${API_BASE_URL}/supp-forecast/bgh/processed`,
  SUPP_FORECAST_BGH_STATS: `${API_BASE_URL}/supp-forecast/bgh/stats`,
  SUPP_FORECAST_APPROVE: `${API_BASE_URL}/supp-forecast/approve`,

  // Receipts (nhập kho)
  RECEIPTS_FEED: `${API_BASE_URL}/receipts/feed`,
  RECEIPT_CREATE: `${API_BASE_URL}/receipts/create`,
  RECEIPT_DETAIL: (id) => `${API_BASE_URL}/receipts/${id}/detail`,

  // Issues (xuất kho)
  ISSUES_FEED: `${API_BASE_URL}/issues/feed`,
  ISSUES_ELIGIBLE: `${API_BASE_URL}/issues/eligible-requests-with-reasons`,
  ISSUE_PREVIEW: `${API_BASE_URL}/issues/preview`,
  ISSUE_CREATE_FROM_REQ: `${API_BASE_URL}/issues/create-from-issue-req`,
  ISSUE_DETAIL: (id) => `${API_BASE_URL}/issues/${id}/detail`,

  // Admin users
  ADMIN_USERS: `${API_BASE_URL}/admin/users`,
  ADMIN_USERS_ALL: `${API_BASE_URL}/admin/users/all`,
  ADMIN_USER_APPROVE: (id) => `${API_BASE_URL}/admin/users/${id}/approve`,
  ADMIN_USER_REJECT: (id) => `${API_BASE_URL}/admin/users/${id}/reject`,
  ADMIN_USER_ROLE: (id) => `${API_BASE_URL}/admin/users/${id}/role`,
  ADMIN_USER_DELETE: (id) => `${API_BASE_URL}/admin/users/${id}`,

  // RBAC
  RBAC_ROLES: `${API_BASE_URL}/admin/rbac/roles`,
  RBAC_PERMISSIONS: `${API_BASE_URL}/admin/rbac/permissions`,
  RBAC_ROLE_PERMS: (code) => `${API_BASE_URL}/admin/rbac/roles/${code}/permissions`,
  RBAC_ROLE_PERMS_RESET: (code) => `${API_BASE_URL}/admin/rbac/roles/${code}/permissions/reset`,
  RBAC_USER_PERMS: (id) => `${API_BASE_URL}/admin/rbac/users/${id}/permissions`,
  SETTINGS_AUTO_APPROVE: `${API_BASE_URL}/admin/settings/issue-req-auto-approve`,

  // Notifications
  NOTIFICATIONS: `${API_BASE_URL}/notifications/my`,
  NOTIFICATION_READ: (id) => `${API_BASE_URL}/notifications/${id}/read`,
  NOTIFICATION_READ_ALL: `${API_BASE_URL}/notifications/read-all`,
};

// Helper: tạo headers chung
export const buildHeaders = (userId = null) => {
  const headers = { 'Content-Type': 'application/json' };
  if (userId) headers['X-User-Id'] = String(userId);
  return headers;
};
