import React, { useEffect, useMemo, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppHeader from '../../components/AppHeader';
import { useAuth } from '../../context/AuthContext';
import { API_ENDPOINTS, buildHeaders } from '../../api/apiConfig';
import { colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

import EquipmentListScreen from './EquipmentListScreen';
import CreateIssueRequestScreen from './CreateIssueRequestScreen';
import IssueRequestApprovalScreen from './IssueRequestApprovalScreen';
import ReplenishmentRequestScreen from './ReplenishmentRequestScreen';
import ReceiptScreen from './ReceiptScreen';
import IssueScreen from './IssueScreen';
import ForecastApprovalScreen from './ForecastApprovalScreen';


const Tab = createBottomTabNavigator();

// Monochrome line-icon mapping for tabs (prototype icon set, via Ionicons)
const TAB_ICONS = {
  'Vật tư': 'cube-outline',
  'Tạo phiếu xin': 'document-text-outline',
  'Phê duyệt lĩnh': 'checkmark-circle-outline',
  'Phiếu dự trù': 'bar-chart-outline',
  'Nhập kho': 'arrow-down-circle-outline',
  'Xuất kho': 'arrow-up-circle-outline',
  'Duyệt dự trù': 'checkmark-done-circle-outline',
};

function tabIcon(name) {
  return ({ focused, color }) => (
    <Ionicons name={TAB_ICONS[name] || 'document-outline'} size={22} color={color} />
  );
}

function tabLabel(name) {
  return ({ focused, color }) => (
    <Text style={{ fontSize: 10, color, textAlign: 'center', fontFamily: focused ? fontFamily.bold : fontFamily.medium }} numberOfLines={1}>{name}</Text>
  );
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [permCodes, setPermCodes] = useState([]);
  const [loadingPerms, setLoadingPerms] = useState(true);

  useEffect(() => {
    if (!user?.id) { setLoadingPerms(false); return; }
    let cancelled = false;
    let initialDone = false;

    async function fetchPerms() {
      // Only show the full-screen spinner on the very first load.
      // Background refreshes (interval) silently update permissions
      // without unmounting the tab screens.
      if (!initialDone) setLoadingPerms(true);
      try {
        const r = await fetch(API_ENDPOINTS.MY_PERMISSIONS, { headers: buildHeaders(user.id) });
        if (!r.ok) { if (!cancelled) setPermCodes([]); return; }
        const d = await r.json();
        if (!cancelled) setPermCodes(Array.isArray(d?.permissionCodes) ? d.permissionCodes : []);
      } catch {
        if (!cancelled) setPermCodes([]);
      } finally {
        if (!cancelled) setLoadingPerms(false);
        initialDone = true;
      }
    }

    fetchPerms();
    const interval = setInterval(fetchPerms, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user?.id]);

  const permSet = useMemo(() => new Set((permCodes || []).map((x) => String(x || '').trim())), [permCodes]);
  const hasPerm = (code) => permSet.has(code);

  const screenOptions = {
    headerShown: false,
    tabBarStyle: {
      backgroundColor: colors.white,
      borderTopColor: colors.border,
      borderTopWidth: 1,
      height: 62 + insets.bottom,
      paddingBottom: 6 + insets.bottom,
      paddingTop: 6,
    },
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.textMuted,
  };

  // Tabs the current user can access (each tied to a permission, matching the
  // DB role_permissions seed). "Vật tư" requires MATERIAL.VIEW, so roles without
  // it (e.g. ADMIN, whose admin/RBAC functions are web-only) don't see it.
  const hasAnyTab =
    hasPerm('MATERIAL.VIEW') ||
    hasPerm('ISSUE_REQ.CREATE') ||
    hasPerm('ISSUE_REQ.APPROVE') ||
    hasPerm('SUPP_FORECAST.CREATE') ||
    hasPerm('RECEIPT.CREATE') ||
    hasPerm('ISSUE.CREATE') ||
    hasPerm('SUPP_FORECAST.APPROVE');

  if (loadingPerms) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <AppHeader />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!hasAnyTab) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <AppHeader />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Ionicons name="desktop-outline" size={48} color={colors.textMuted} />
          <Text style={{ marginTop: 16, fontSize: 16, color: colors.text, fontFamily: fontFamily.bold, textAlign: 'center' }}>
            Không có chức năng trên ứng dụng di động
          </Text>
          <Text style={{ marginTop: 8, fontSize: 13.5, color: colors.textMuted, fontFamily: fontFamily.regular, textAlign: 'center', lineHeight: 20 }}>
            Tài khoản của bạn (quản trị/phân quyền) được sử dụng trên phiên bản web. Vui lòng đăng nhập bản web để quản lý.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader />
      <Tab.Navigator screenOptions={screenOptions}>
        {hasPerm('MATERIAL.VIEW') && (
          <Tab.Screen
            name="Vật tư"
            component={EquipmentListScreen}
            options={{ tabBarIcon: tabIcon('Vật tư'), tabBarLabel: tabLabel('Vật tư') }}
          />
        )}

        {hasPerm('ISSUE_REQ.CREATE') && (
          <Tab.Screen
            name="Tạo phiếu xin"
            component={CreateIssueRequestScreen}
            options={{ tabBarIcon: tabIcon('Tạo phiếu xin'), tabBarLabel: tabLabel('Tạo phiếu xin') }}
          />
        )}

        {hasPerm('ISSUE_REQ.APPROVE') && (
          <Tab.Screen
            name="Phê duyệt lĩnh"
            component={IssueRequestApprovalScreen}
            options={{ tabBarIcon: tabIcon('Phê duyệt lĩnh'), tabBarLabel: tabLabel('Phê duyệt lĩnh') }}
          />
        )}

        {hasPerm('SUPP_FORECAST.CREATE') && (
          <Tab.Screen
            name="Phiếu dự trù"
            component={ReplenishmentRequestScreen}
            options={{ tabBarIcon: tabIcon('Phiếu dự trù'), tabBarLabel: tabLabel('Phiếu dự trù') }}
          />
        )}

        {hasPerm('RECEIPT.CREATE') && (
          <Tab.Screen
            name="Nhập kho"
            component={ReceiptScreen}
            options={{ tabBarIcon: tabIcon('Nhập kho'), tabBarLabel: tabLabel('Nhập kho') }}
          />
        )}

        {hasPerm('ISSUE.CREATE') && (
          <Tab.Screen
            name="Xuất kho"
            component={IssueScreen}
            options={{ tabBarIcon: tabIcon('Xuất kho'), tabBarLabel: tabLabel('Xuất kho') }}
          />
        )}

        {hasPerm('SUPP_FORECAST.APPROVE') && (
          <Tab.Screen
            name="Duyệt dự trù"
            component={ForecastApprovalScreen}
            options={{ tabBarIcon: tabIcon('Duyệt dự trù'), tabBarLabel: tabLabel('Duyệt dự trù') }}
          />
        )}


      </Tab.Navigator>
    </View>
  );
}
