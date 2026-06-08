// Web browser / Expo web: dùng localhost
// Android emulator: dùng 10.0.2.2
// Thiết bị thật: dùng IP LAN của máy, ví dụ 'http://192.168.1.10:8080/api'
export const API_BASE_URL = 'http://10.161.190.71:8080/api';

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
