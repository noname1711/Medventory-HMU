import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { API_ENDPOINTS } from '../api/apiConfig';
import { apiGet } from '../api/apiClient';
import { colors, radius } from '../theme/tokens';
import { fontFamily } from '../theme/typography';

const mapEntity = (m) => ({
  id: m.id, name: m.name, code: m.code || '', spec: m.spec || '',
  unitId: m.unit?.id ?? m.unitId ?? '', unit: { id: m.unit?.id ?? m.unitId ?? '' },
  manufacturer: m.manufacturer || '', category: m.category || '',
});

export default function MaterialPicker({ visible, onClose, onSelect }) {
  const [kw, setKw] = useState('');
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!visible) return undefined;
    const t = setTimeout(async () => {
      const url = `${API_ENDPOINTS.MATERIALS_SEARCH}?keyword=${encodeURIComponent(kw || '')}&limit=20`;
      const { ok, data } = await apiGet(url);
      setItems(ok && Array.isArray(data) ? data.map(mapEntity) : []);
    }, 250);
    return () => clearTimeout(t);
  }, [kw, visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Chọn vật tư</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.close}>Đóng</Text></TouchableOpacity>
          </View>
          <TextInput style={styles.search} placeholder="Tìm theo tên hoặc mã..." value={kw} onChangeText={setKw} autoFocus />
          <FlatList
            data={items}
            keyExtractor={(it) => String(it.id)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.row} onPress={() => { onSelect(item); onClose(); }}>
                <Text style={styles.name}>{item.name}</Text>
                {!!item.code && <Text style={styles.code}>{item.code}</Text>}
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.empty}>Không tìm thấy vật tư</Text>}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '80%', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 15, fontFamily: fontFamily.bold, color: colors.text },
  close: { color: colors.primary, fontFamily: fontFamily.semibold },
  search: { height: 44, borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, marginBottom: 10, backgroundColor: colors.white, color: colors.text, fontFamily: fontFamily.regular },
  row: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  name: { fontSize: 13.5, fontFamily: fontFamily.semibold, color: colors.text },
  code: { fontSize: 11, color: colors.primary, fontFamily: fontFamily.bold, marginTop: 2 },
  empty: { textAlign: 'center', color: colors.textMuted, paddingVertical: 24, fontFamily: fontFamily.regular },
});
