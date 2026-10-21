import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const FamilyCoreSalesModal = ({
  visible,
  onClose,
  onSubscribe,
  purchasingPlan,
  theme,
  isDarkMode,
}) => {
  const benefits = [
    {
      icon: 'people',
      title: 'Divida as compras e multiplique a economia',
      desc: '1 titular financeiro + até 2 familiares conectados no mesmo plano.',
    },
    {
      icon: 'sync',
      title: 'Sincronização em tempo real entre celulares',
      desc: 'Qualquer item adicionado ou riscado na lista atualiza para todos na hora.',
    },
    {
      icon: 'shield-checkmark',
      title: 'Zero anúncios para toda a casa',
      desc: 'Navegação 100% limpa, rápida e sem interrupções em todos os aparelhos.',
    },
    {
      icon: 'sparkles',
      title: 'Auditoria de encartes com Gemini IA',
      desc: 'Cruze os melhores preços de todos os supermercados da sua microrregião.',
    },
  ];

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          {/* Top Close */}
          <View style={styles.headerRow}>
            <View style={[styles.badge, { backgroundColor: isDarkMode ? '#1a2e23' : '#ecfdf5', borderColor: theme.accentLime }]}>
              <Ionicons name="sparkles" size={12} color={theme.accentLime} style={{ marginRight: 4 }} />
              <Text style={[styles.badgeText, { color: theme.accentLime }]}>PLANO FAMILIAR</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={theme.textDim} />
            </TouchableOpacity>
          </View>

          {/* Título e Subtítulo de Vendas */}
          <Text style={[styles.title, { color: theme.textMain }]}>
            Conecte sua casa no MercadoFácil
          </Text>
          <Text style={[styles.subtitle, { color: theme.textDim }]}>
            Economize juntos todas as semanas com listas conjuntas e auditoria de preços em tempo real.
          </Text>

          {/* Benefícios */}
          <ScrollView style={styles.benefitsList} showsVerticalScrollIndicator={false}>
            {benefits.map((b, idx) => (
              <View key={idx} style={[styles.benefitItem, { borderBottomColor: theme.borderSubtle }]}>
                <View style={[styles.iconBox, { backgroundColor: theme.cardSubBg }]}>
                  <Ionicons name={b.icon} size={18} color={theme.accentLime} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.benefitTitle, { color: theme.textMain }]}>{b.title}</Text>
                  <Text style={[styles.benefitDesc, { color: theme.textDim }]}>{b.desc}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Preço e CTA */}
          <View style={[styles.pricingBox, { backgroundColor: theme.cardSubBg, borderColor: theme.borderSubtle }]}>
            <View>
              <Text style={[styles.priceTag, { color: theme.textDim }]}>Valor mensal:</Text>
              <Text style={[styles.priceMain, { color: theme.textMain }]}>
                R$ 5,99 <Text style={[styles.pricePeriod, { color: theme.textDim }]}>/ mês</Text>
              </Text>
            </View>
            <Text style={[styles.priceSmall, { color: theme.accentLime }]}>Cancele a qualquer momento</Text>
          </View>

          <TouchableOpacity
            style={[styles.ctaButton, { backgroundColor: theme.accentLime }]}
            onPress={onSubscribe}
            disabled={purchasingPlan}
            activeOpacity={0.85}
          >
            {purchasingPlan ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={styles.ctaButtonText}>
                Assinar e Conectar Família - R$ 5,99/mês
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} style={styles.secondaryBtn} activeOpacity={0.7}>
            <Text style={[styles.secondaryBtnText, { color: theme.textDim }]}>Agora não</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  sheet: {
    width: '100%',
    maxHeight: '90%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 22,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  closeBtn: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  benefitsList: {
    maxHeight: 220,
    marginBottom: 14,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  benefitTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  benefitDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  pricingBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  priceTag: {
    fontSize: 11,
  },
  priceMain: {
    fontSize: 17,
    fontWeight: '800',
  },
  pricePeriod: {
    fontSize: 12,
    fontWeight: '400',
  },
  priceSmall: {
    fontSize: 11,
    fontWeight: '600',
  },
  ctaButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryBtn: {
    alignItems: 'center',
    marginTop: 10,
    paddingVertical: 4,
  },
  secondaryBtnText: {
    fontSize: 12,
  },
});
