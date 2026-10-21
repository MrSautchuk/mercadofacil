// src/components/EditItemModal.js
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const EditItemModal = ({
  visible,
  item,
  itemName,
  onChangeItemName,
  itemQuantity,
  onChangeItemQuantity,
  itemBrand,
  onChangeItemBrand,
  onSave,
  onClose,
  isSaving,
  theme,
  isDarkMode,
}) => {
  if (!item) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={[styles.sheet, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.iconBox, { backgroundColor: theme.cardSubBg }]}>
                <Ionicons name="pencil-outline" size={18} color={theme.accentLime} />
              </View>
              <Text style={[styles.title, { color: theme.textMain }]}>Editar Item da Lista</Text>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={theme.textDim} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.description, { color: theme.textMuted }]}>
            Ajuste o nome, defina a quantidade necessária e especifique a marca desejada para a auditoria de encartes.
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Campo 1: Nome do Produto */}
            <Text style={[styles.fieldLabel, { color: theme.accentLime }]}>NOME DO PRODUTO</Text>
            <View style={[styles.inputBox, { backgroundColor: theme.inputBg, borderColor: theme.borderSubtle }]}>
              <TextInput
                style={[styles.input, { color: theme.textMain }]}
                placeholder="Nome do produto..."
                placeholderTextColor={theme.textDim}
                value={itemName}
                onChangeText={onChangeItemName}
                autoCapitalize="sentences"
                returnKeyType="next"
              />
              {itemName.length > 0 && (
                <TouchableOpacity onPress={() => onChangeItemName('')} style={{ padding: 4 }}>
                  <Ionicons name="close-circle" size={18} color={theme.textDim} />
                </TouchableOpacity>
              )}
            </View>

            {/* Campo 2: Quantidade (Unidades, Kg) */}
            <Text style={[styles.fieldLabel, { color: theme.accentLime }]}>QUANTIDADE (UNIDADES, KG)</Text>
            <View style={[styles.inputBox, { backgroundColor: theme.inputBg, borderColor: theme.borderSubtle }]}>
              <Ionicons name="calculator-outline" size={18} color={theme.textDim} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.input, { color: theme.textMain }]}
                placeholder="Ex: 1, 2, 5"
                placeholderTextColor={theme.textDim}
                value={itemQuantity}
                onChangeText={onChangeItemQuantity}
                keyboardType="numeric"
                returnKeyType="next"
              />
            </View>

            {/* Campo 3: Preferência de Marca */}
            <View style={styles.brandWarningBox}>
              <Text style={styles.brandWarningText}>
                ⚠️ Deixe em branco caso prefira que a IA busque pelo item mais barato do encarte, independente da marca.
              </Text>
            </View>

            <Text style={[styles.fieldLabel, { color: theme.accentLime }]}>PREFERÊNCIA DE MARCA</Text>
            <View style={[styles.inputBox, { backgroundColor: theme.inputBg, borderColor: theme.borderSubtle }]}>
              <Ionicons name="pricetag-outline" size={18} color={theme.textDim} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.input, { color: theme.textMain }]}
                placeholder="Ex: Qualitá, Camil, Nestlé, Pilão..."
                placeholderTextColor={theme.textDim}
                value={itemBrand}
                onChangeText={onChangeItemBrand}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={onSave}
              />
              {itemBrand.length > 0 && (
                <TouchableOpacity onPress={() => onChangeItemBrand('')} style={{ padding: 4 }}>
                  <Ionicons name="close-circle" size={18} color={theme.textDim} />
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.cancelBtn, { backgroundColor: theme.cardSubBg, borderColor: theme.borderSubtle }]}
              onPress={onClose}
              disabled={isSaving}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelBtnText, { color: theme.textMuted }]}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.saveBtn,
                {
                  backgroundColor: itemName.trim() ? theme.accentLime : theme.borderSubtle,
                  opacity: itemName.trim() && !isSaving ? 1 : 0.6,
                },
              ]}
              onPress={onSave}
              disabled={!itemName.trim() || isSaving}
              activeOpacity={0.8}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="checkmark" size={16} color="#000" />
                  <Text style={styles.saveBtnText}>Salvar Alterações</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  description: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginLeft: 2,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  brandWarningBox: {
    backgroundColor: 'rgba(234, 179, 8, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.35)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  brandWarningText: {
    color: '#eab308',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1.6,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '800',
  },
});
