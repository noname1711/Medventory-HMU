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
import { colors, radius, shadow, fontSize } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

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
        {/* Card */}
        <View style={styles.card}>
          {/* Header (inside card, matches web .auth-header) */}
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
  container: { flex: 1, backgroundColor: colors.authBg },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 16 },
  header: { alignItems: 'center', marginBottom: 20 },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    ...shadow.soft,
  },
  logo: { width: 60, height: 60 },
  title: { fontSize: 22, fontFamily: fontFamily.extrabold, color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: fontSize.base, fontFamily: fontFamily.medium, color: colors.textSoft, marginBottom: 2 },
  subtext: { fontSize: 13, fontFamily: fontFamily.semibold, color: colors.primary },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 28,
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
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  eyeBtn: { padding: 10, marginLeft: 6 },
  eyeIcon: { fontSize: 18 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  checkRow: { flexDirection: 'row', alignItems: 'center' },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radius.xs,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.primary },
  checkmark: { color: colors.white, fontSize: 12, fontFamily: fontFamily.bold },
  rememberText: { fontSize: 13, fontFamily: fontFamily.medium, color: colors.label },
  forgotLink: { fontSize: 13, fontFamily: fontFamily.semibold, color: colors.primary },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 14,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: colors.white, fontSize: fontSize.md, fontFamily: fontFamily.semibold },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { fontSize: 13, fontFamily: fontFamily.regular, color: colors.textSoft },
  linkText: { fontSize: 13, fontFamily: fontFamily.semibold, color: colors.primary },
  version: { marginTop: 18, fontSize: fontSize.sm, fontFamily: fontFamily.regular, color: colors.textMuted },
});
