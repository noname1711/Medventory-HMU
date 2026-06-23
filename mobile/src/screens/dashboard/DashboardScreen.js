import React, { useEffect, useMemo, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
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
import AdminScreen from './AdminScreen';
import RBACScreen from './RBACScreen';

const Tab = createBottomTabNavigator();

// Icon mapping for tabs
const TAB_ICONS = {
  'Vật tư': '📦',
  'Tạo phiếu xin': '📋',
  'Phê duyệt lĩnh': '✅',
  'Phiếu dự trù': '📊',
  'Nhập kho': '⬇️',
  'Xuất kho': '⬆️',
  'Duyệt dự trù': '🔍',
  'Người dùng': '👥',
  'Phân quyền': '🔐',
};

function tabIcon(name) {
  return ({ focused }) => (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{TAB_ICONS[name] || '📋'}</Text>
  );
}

function tabLabel(name) {
  return ({ focused, color }) => (
    <Text style={{ fontSize: 10, color, textAlign: 'center', fontFamily: focused ? fontFamily.bold : fontFamily.medium }} numberOfLines={1}>{name}</Text>
  );
}

export default function DashboardScreen() {
  const { user, isAdmin } = useAuth();
  const insets = useSafeAreaInsets();
  const [permCodes, setPermCodes] = useState([]);
  const [loadingPerms, setLoadingPerms] = useState(true);

  useEffect(() => {
    if (!user?.id) { setLoadingPerms(false); return; }
    let cancelled = false;

    async function fetchPerms() {
      try {
        setLoadingPerms(true);
        const r = await fetch(API_ENDPOINTS.MY_PERMISSIONS, { headers: buildHeaders(user.id) });
        if (!r.ok) { if (!cancelled) setPermCodes([]); return; }
        const d = await r.json();
        if (!cancelled) setPermCodes(Array.isArray(d?.permissionCodes) ? d.permissionCodes : []);
      } catch {
        if (!cancelled) setPermCodes([]);
      } finally {
        if (!cancelled) setLoadingPerms(false);
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader />
      <Tab.Navigator screenOptions={screenOptions}>
        <Tab.Screen
          name="Vật tư"
          component={EquipmentListScreen}
          options={{ tabBarIcon: tabIcon('Vật tư'), tabBarLabel: tabLabel('Vật tư') }}
        />

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

        {(hasPerm('USERS.MANAGE') || isAdmin) && (
          <Tab.Screen
            name="Người dùng"
            component={AdminScreen}
            options={{ tabBarIcon: tabIcon('Người dùng'), tabBarLabel: tabLabel('Người dùng') }}
          />
        )}

        {hasPerm('PERMISSIONS.MANAGE') && (
          <Tab.Screen
            name="Phân quyền"
            component={RBACScreen}
            options={{ tabBarIcon: tabIcon('Phân quyền'), tabBarLabel: tabLabel('Phân quyền') }}
          />
        )}
      </Tab.Navigator>
    </View>
  );
}
