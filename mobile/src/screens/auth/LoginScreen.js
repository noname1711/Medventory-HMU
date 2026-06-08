import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
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
import { useAuth } from '../../context/AuthContext';
import { storage } from '../../utils/storage';
import { API_ENDPOINTS } from '../../api/apiConfig';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordRef = useRef(null);

  useEffect(() => {
    storage.getRememberedEmail().then((savedEmail) => {
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    });
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Toast.show({ type: 'error', text1: 'Vui lòng điền đầy đủ thông tin!' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(API_ENDPOINTS.LOGIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();

      if (data.success) {
        if (rememberMe) {
          await storage.saveRememberMe(email.trim());
        } else {
          await storage.clearRememberMe();
        }
        if (data.user) {
          await login(data.user);
        }
        Toast.show({ type: 'success', text1: data.message || 'Đăng nhập thành công!' });
      } else {
        Toast.show({ type: 'error', text1: data.message || 'Đăng nhập thất bại!' });
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
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Image
              source={require('../../../assets/icon.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>HMU Medical</Text>
          <Text style={styles.subtitle}>Hệ thống quản lý vật tư y tế</Text>
          <Text style={styles.subtext}>Bệnh viện Đại học Y Hà Nội</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Đăng nhập</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#9BA3AF"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />

          <View style={styles.inputRow}>
            <TextInput
              ref={passwordRef}
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Mật khẩu"
              placeholderTextColor="#9BA3AF"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword((v) => !v)}
            >
              <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          {/* Remember me & Forgot password */}
          <View style={styles.row}>
            <Pressable
              style={styles.checkRow}
              onPress={() => setRememberMe((v) => !v)}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.rememberText}>Ghi nhớ đăng nhập</Text>
            </Pressable>

            <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
              <Text style={styles.forgotLink}>Quên mật khẩu?</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitText}>Đăng nhập</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Chưa có tài khoản? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.linkText}>Đăng ký ngay</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.version}>Version 2.0</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1565C0' },
  scroll: { flexGrow: 1, alignItems: 'center', paddingVertical: 48, paddingHorizontal: 20 },
  header: { alignItems: 'center', marginBottom: 28 },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    elevation: 4,
  },
  logo: { width: 60, height: 60 },
  title: { fontSize: 24, fontWeight: '700', color: '#FFF', marginBottom: 4 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginBottom: 2 },
  subtext: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  card: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  cardTitle: { fontSize: 20, fontWeight: '700', color: '#1565C0', marginBottom: 20, textAlign: 'center' },
  input: {
    borderWidth: 1.5,
    borderColor: '#E0E6EF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1A1A2E',
    marginBottom: 14,
    backgroundColor: '#F8FAFC',
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  eyeBtn: { padding: 10, marginLeft: 6 },
  eyeIcon: { fontSize: 18 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  checkRow: { flexDirection: 'row', alignItems: 'center' },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#1565C0',
    borderRadius: 4,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#1565C0' },
  checkmark: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  rememberText: { fontSize: 13, color: '#4B5563' },
  forgotLink: { fontSize: 13, color: '#1565C0', fontWeight: '600' },
  submitBtn: {
    backgroundColor: '#1565C0',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { fontSize: 13, color: '#6B7280' },
  linkText: { fontSize: 13, color: '#1565C0', fontWeight: '600' },
  version: { marginTop: 20, fontSize: 12, color: 'rgba(255,255,255,0.5)' },
});
