import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { API_ENDPOINTS } from '../../api/apiConfig';

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTokenStep, setShowTokenStep] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (!showTokenStep) return;
    setCountdown(60);
    const timer = setInterval(() => {
      if (!isMounted.current) { clearInterval(timer); return; }
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (isMounted.current) setShowTokenStep(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [showTokenStep]);

  const handleSend = async () => {
    if (!email.trim()) {
      Toast.show({ type: 'error', text1: 'Vui lòng nhập email!' });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(API_ENDPOINTS.FORGOT_PASSWORD, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        Toast.show({ type: 'success', text1: 'Email đặt lại mật khẩu đã được gửi!' });
        setShowTokenStep(true);
      } else {
        Toast.show({ type: 'error', text1: data.message || 'Không tìm thấy email!' });
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
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Quay lại</Text>
        </TouchableOpacity>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quên mật khẩu</Text>

          {!showTokenStep ? (
            <>
              <Text style={styles.desc}>
                Nhập địa chỉ email đã đăng ký. Chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu.
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#9BA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                returnKeyType="done"
                onSubmitEditing={handleSend}
              />
              <TouchableOpacity
                style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                onPress={handleSend}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.submitText}>Gửi email đặt lại</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.successBox}>
              <Text style={styles.successIcon}>✉️</Text>
              <Text style={styles.successTitle}>Email đã được gửi!</Text>
              <Text style={styles.successDesc}>
                Vui lòng kiểm tra hộp thư của <Text style={styles.emailHighlight}>{email}</Text> để đặt lại mật khẩu.
              </Text>
              <View style={styles.countdownBox}>
                <Text style={styles.countdownText}>
                  Trang sẽ tự đóng sau {countdown}s
                </Text>
              </View>
              <TouchableOpacity
                style={styles.resendBtn}
                onPress={() => { setShowTokenStep(false); setEmail(''); }}
              >
                <Text style={styles.resendText}>Gửi lại email khác</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1565C0' },
  scroll: { flexGrow: 1, padding: 20, paddingTop: 48 },
  backBtn: { marginBottom: 16 },
  backText: { color: '#FFF', fontSize: 16 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 24, elevation: 6 },
  cardTitle: { fontSize: 20, fontWeight: '700', color: '#1565C0', marginBottom: 12, textAlign: 'center' },
  desc: { fontSize: 14, color: '#6B7280', marginBottom: 20, lineHeight: 20, textAlign: 'center' },
  input: {
    borderWidth: 1.5,
    borderColor: '#E0E6EF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1A1A2E',
    marginBottom: 20,
    backgroundColor: '#F8FAFC',
  },
  submitBtn: {
    backgroundColor: '#1565C0',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  successBox: { alignItems: 'center', paddingVertical: 12 },
  successIcon: { fontSize: 48, marginBottom: 12 },
  successTitle: { fontSize: 18, fontWeight: '700', color: '#16A34A', marginBottom: 8 },
  successDesc: { fontSize: 14, color: '#4B5563', textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  emailHighlight: { fontWeight: '700', color: '#1565C0' },
  countdownBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 16,
  },
  countdownText: { fontSize: 13, color: '#1565C0' },
  resendBtn: { paddingVertical: 10 },
  resendText: { fontSize: 14, color: '#1565C0', fontWeight: '600' },
});
