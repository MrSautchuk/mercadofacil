// src/components/MarketFilterModal.js
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const MarketFilterModal = ({
  visible,
  markets,
  activeMarket,
  onSelectMarket,
  onClose,
  theme,
  isDarkMode,
}) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
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
                <Ionicons name="storefront-outline" size={18} color={theme.accentLime} />
              </View>
              <Text style={[styles.title, { color: theme.textMain }]}>Filtrar por Supermercado</Text>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={theme.textDim} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.description, { color: theme.textMuted }]}>
            Escolha um dos supermercados cadastrados nos seus encartes para ver apenas os produtos ofertados por ele.
          </Text>

          {/* Opção Todos os Mercados */}
          <TouchableOpacity
            style={[
              styles.marketRow,
              { borderBottomColor: theme.borderSubtle },
              activeMarket === 'Todos' && { backgroundColor: theme.cardSubBg },
            ]}
            onPress={() => onSelectMarket('Todos')}
            activeOpacity={0.7}
          >
            <View style={[styles.rowIcon, { backgroundColor: activeMarket === 'Todos' ? theme.accentLime : theme.cardSubBg }]}>
              <Ionicons
                name="apps-outline"
                size={16}
                color={activeMarket === 'Todos' ? '#000' : theme.textDim}
              />
            </View>
            <Text
              style={[
                styles.marketName,
                { color: activeMarket === 'Todos' ? theme.accentLime : theme.textMain },
                activeMarket === 'Todos' && { fontWeight: '800' },
              ]}
            >
              Todos os Mercados
            </Text>
            {activeMarket === 'Todos' && (
              <Ionicons name="checkmark-circle" size={20} color={theme.accentLime} style={{ marginLeft: 'auto' }} />
            )}
          </TouchableOpacity>

          {/* Lista de Mercados Únicos */}
          <ScrollView style={styles.listScroll} contentContainerStyle={{ paddingBottom: 16 }}>
            {markets.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="newspaper-outline" size={36} color={theme.textDim} />
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                  Nenhum supermercado encontrado nos encartes ativos.
                </Text>
              </View>
            ) : (
              markets.map((market, idx) => {
                const isSelected = activeMarket === market;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.marketRow,
                      { borderBottomColor: theme.borderSubtle },
                      isSelected && { backgroundColor: theme.cardSubBg },
                    ]}
                    onPress={() => onSelectMarket(market)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.rowIcon, { backgroundColor: isSelected ? theme.accentLime : theme.cardSubBg }]}>
                      <Ionicons
                        name="business-outline"
                        size={16}
                        color={isSelected ? '#000' : theme.textDim}
                      />
                    </View>
                    <Text
                      style={[
                        styles.marketName,
                        { color: isSelected ? theme.accentLime : theme.textMain },
                        isSelected && { fontWeight: '800' },
                      ]}
                      numberOfLines={1}
                    >
                      {market}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={theme.accentLime} style={{ marginLeft: 'auto' }} />
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
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
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '75%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
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
  listScroll: {
    maxHeight: 320,
  },
  marketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderBottomWidth: 1,
    gap: 12,
  },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marketName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    gap: 8,
  },
  emptyText: {
    fontSize: 12,
    textAlign: 'center',
  },
});
