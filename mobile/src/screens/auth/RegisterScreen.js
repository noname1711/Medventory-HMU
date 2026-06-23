import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { API_ENDPOINTS } from '../../api/apiConfig';
import { colors, radius, shadow, fontSize } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

const ROLES = [
  { label: 'Lãnh đạo', value: 'Lãnh đạo' },
  { label: 'Thủ kho', value: 'Thủ kho' },
  { label: 'Cán bộ khác', value: 'Cán bộ' },
];

export default function RegisterScreen({ navigation }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [role, setRole] = useState('');
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState([]);
  const [filteredDepts, setFilteredDepts] = useState([]);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deptSearch, setDeptSearch] = useState('');

  useEffect(() => {
    fetch(API_ENDPOINTS.DEPARTMENTS)
      .then((r) => r.json())
      .then((data) => {
        setDepartments(Array.isArray(data) ? data : []);
        setFilteredDepts(Array.isArray(data) ? data : []);
      })
      .catch(() => Toast.show({ type: 'error', text1: 'Không thể tải danh sách khoa' }));
  }, []);

  useEffect(() => {
    if (!deptSearch.trim()) {
      setFilteredDepts(departments);
    } else {
      const terms = deptSearch.toLowerCase().split(/\s+/);
      setFilteredDepts(
        departments.filter((d) => terms.every((t) => d.name.toLowerCase().includes(t)))
      );
    }
  }, [deptSearch, departments]);

  const handleRegister = async () => {
    if (!fullName || !email || !password || !confirmPassword || !dateOfBirth || !role || !department) {
      Toast.show({ type: 'error', text1: 'Vui lòng điền đầy đủ thông tin!' });
      return;
    }
    if (password !== confirmPassword) {
      Toast.show({ type: 'error', text1: 'Mật khẩu xác nhận không khớp!' });
      return;
    }
    const isValid = departments.some((d) => d.name === department);
    if (!isValid) {
      Toast.show({ type: 'error', text1: 'Vui lòng chọn khoa hợp lệ!' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(API_ENDPOINTS.REGISTER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password, confirmPassword, dateOfBirth, department, role }),
      });
      const data = await res.json();
      if (data.success) {
        Toast.show({ type: 'success', text1: data.message || 'Đăng ký thành công!' });
        navigation.navigate('Login');
      } else {
        Toast.show({ type: 'error', text1: data.message || 'Đăng ký thất bại!' });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Lỗi kết nối đến server!' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Back button */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Quay lại</Text>
        </TouchableOpacity>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Đăng ký tài khoản</Text>

          <TextInput
            style={styles.input}
            placeholder="Họ và tên"
            placeholderTextColor="#9BA3AF"
            value={fullName}
            onChangeText={setFullName}
          />

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#9BA3AF"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <TextInput
            style={styles.input}
            placeholder="Ngày sinh (dd/mm/yyyy)"
            placeholderTextColor="#9BA3AF"
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
          />

          {/* Role picker */}
          <TouchableOpacity
            style={styles.picker}
            onPress={() => setShowRoleModal(true)}
          >
            <Text style={role ? styles.pickerText : styles.pickerPlaceholder}>
              {role || 'Chọn vai trò...'}
            </Text>
            <Text style={styles.pickerArrow}>▼</Text>
          </TouchableOpacity>

          {/* Department picker */}
          <TouchableOpacity
            style={styles.picker}
            onPress={() => setShowDeptModal(true)}
          >
            <Text style={department ? styles.pickerText : styles.pickerPlaceholder} numberOfLines={1}>
              {department || 'Chọn khoa / phòng...'}
            </Text>
            <Text style={styles.pickerArrow}>▼</Text>
          </TouchableOpacity>

          {/* Password */}
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Mật khẩu"
              placeholderTextColor="#9BA3AF"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword((v) => !v)}>
              <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.inputRow, { marginTop: 14 }]}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Xác nhận mật khẩu"
              placeholderTextColor="#9BA3AF"
              secureTextEntry={!showConfirmPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirmPassword((v) => !v)}>
              <Text style={styles.eyeIcon}>{showConfirmPassword ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitText}>Đăng ký tài khoản</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Đã có tài khoản? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.linkText}>Đăng nhập</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Role Modal */}
      <Modal visible={showRoleModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowRoleModal(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Chọn vai trò</Text>
            {ROLES.map((r) => (
              <TouchableOpacity
                key={r.value}
                style={styles.modalItem}
                onPress={() => { setRole(r.value); setShowRoleModal(false); }}
              >
                <Text style={styles.modalItemText}>{r.label}</Text>
                {role === r.value && <Text style={styles.checkIcon}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Department Modal */}
      <Modal visible={showDeptModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowDeptModal(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Chọn khoa / phòng</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm kiếm khoa..."
              placeholderTextColor="#9BA3AF"
              value={deptSearch}
              onChangeText={setDeptSearch}
              autoFocus
            />
            <FlatList
              data={filteredDepts}
              keyExtractor={(item) => String(item.id)}
              style={{ maxHeight: 300 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setDepartment(item.name);
                    setShowDeptModal(false);
                    setDeptSearch('');
                  }}
                >
                  <Text style={styles.modalItemText} numberOfLines={2}>{item.name}</Text>
                  {department === item.name && <Text style={styles.checkIcon}>✓</Text>}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>Không tìm thấy khoa phù hợp</Text>
              }
            />
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.authBg },
  scroll: { flexGrow: 1, padding: 16, paddingTop: 40 },
  backBtn: { marginBottom: 14 },
  backText: { color: colors.primary, fontSize: fontSize.md, fontFamily: fontFamily.semibold },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    ...shadow.auth,
  },
  cardTitle: { fontSize: fontSize.lg, fontFamily: fontFamily.bold, color: colors.text, marginBottom: 18, textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: fontSize.base,
    fontFamily: fontFamily.regular,
    color: colors.text,
    marginBottom: 14,
    backgroundColor: colors.white,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 0 },
  eyeBtn: { padding: 10, marginLeft: 6 },
  eyeIcon: { fontSize: 18 },
  picker: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    backgroundColor: colors.white,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerText: { fontSize: fontSize.base, fontFamily: fontFamily.regular, color: colors.text, flex: 1 },
  pickerPlaceholder: { fontSize: fontSize.base, fontFamily: fontFamily.regular, color: colors.textMuted, flex: 1 },
  pickerArrow: { fontSize: 12, color: colors.textSoft },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 14,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: colors.white, fontSize: fontSize.md, fontFamily: fontFamily.semibold },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { fontSize: 13, fontFamily: fontFamily.regular, color: colors.textSoft },
  linkText: { fontSize: 13, fontFamily: fontFamily.semibold, color: colors.primary },
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
    maxHeight: '80%',
  },
  modalTitle: { fontSize: fontSize.lg, fontFamily: fontFamily.bold, color: colors.text, marginBottom: 14, textAlign: 'center' },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: fontSize.base,
    fontFamily: fontFamily.regular,
    color: colors.text,
    marginBottom: 10,
    backgroundColor: colors.white,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  modalItemText: { fontSize: fontSize.base, fontFamily: fontFamily.regular, color: colors.text, flex: 1 },
  checkIcon: { fontSize: 16, color: colors.primary, fontFamily: fontFamily.bold },
  emptyText: { textAlign: 'center', color: colors.textMuted, paddingVertical: 20 },
});
