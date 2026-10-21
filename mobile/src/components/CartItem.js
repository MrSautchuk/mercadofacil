// src/components/CartItem.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const CartItem = React.memo(function CartItem({
  item,
  offer,
  isActive,
  iconName,
  theme,
  onToggle,
  onEdit,
  onDelete,
}) {
  const isPurchased = item.purchased === 1 || !isActive;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          ...theme.cardShadow,
        },
        isPurchased && styles.inactiveOpacity,
      ]}
    >
      {/* 1. Clique no corpo (ou checkbox/ícone): Marca/desmarca como comprado (Seção 18 e 19) */}
      <TouchableOpacity
        style={[styles.iconBox, { backgroundColor: theme.surfaceSub }]}
        onPress={() => onToggle(item)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isPurchased ? 'checkmark-circle' : iconName}
          size={20}
          color={isPurchased ? '#10b981' : (isActive ? theme.accent : theme.textMuted)}
        />
        {isActive && !isPurchased && offer && offer.deal_verdict === 'super_oferta' && (
          <View
            style={[
              styles.activeDot,
              { backgroundColor: theme.accent, borderColor: theme.surface },
            ]}
          />
        )}
      </TouchableOpacity>

      {/* Informações Principais (Clique no corpo também marca/desmarca comprado) */}
      <TouchableOpacity
        style={styles.infoArea}
        onPress={() => onToggle(item)}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.productName,
            { color: theme.textPrimary },
            (isPurchased || !isActive) && styles.strikethrough,
          ]}
          numberOfLines={1}
        >
          {item.quantity && Number(item.quantity) > 1 ? `${item.quantity}x ${item.name}` : item.name}
        </Text>
        <Text style={[styles.marketSubtitle, { color: theme.textMuted }]} numberOfLines={1}>
          {item.brand_preference && item.brand_preference.trim()
            ? `Marca: ${item.brand_preference.trim()}`
            : (offer ? offer.supermarket : 'Lista Padrão')}
        </Text>
      </TouchableOpacity>

      {/* Badge de Classificação / Veredito */}
      <View style={styles.verdictArea}>
        {offer && isActive && !isPurchased ? (
          <View
            style={[
              styles.badge,
              offer.deal_verdict === 'super_oferta'
                ? { backgroundColor: theme.dealOfferBg, borderColor: theme.dealOffer }
                : offer.deal_verdict === 'falsa_promocao'
                ? { backgroundColor: theme.dealBadBg, borderColor: theme.dealBad }
                : { backgroundColor: theme.dealNormalBg, borderColor: theme.dealNormal },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                {
                  color:
                    offer.deal_verdict === 'super_oferta'
                      ? theme.dealOffer
                      : offer.deal_verdict === 'falsa_promocao'
                      ? theme.dealBad
                      : theme.dealNormal,
                },
              ]}
            >
              {offer.deal_verdict === 'super_oferta'
                ? 'OFERTA'
                : offer.deal_verdict === 'falsa_promocao'
                ? 'COMUM'
                : 'NORMAL'}
            </Text>
          </View>
        ) : (
          <Text style={[styles.emptyDash, { color: theme.textMuted }]}>—</Text>
        )}
      </View>

      {/* 2. Botão de Edição Dedicado (Lápis) - Seção 19: Edita nome, marca e quantidade */}
      <TouchableOpacity
        onPress={() => onEdit && onEdit(item)}
        style={styles.actionIconBtn}
        hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
      >
        <Ionicons name="create-outline" size={19} color={theme.textMuted} />
      </TouchableOpacity>

      {/* Preço e Botão Excluir */}
      <View style={styles.priceArea}>
        {offer && isActive && !isPurchased ? (
          <View style={styles.priceBlock}>
            <Text style={[styles.priceValue, { color: theme.accent }]}>
              R$ {Number(offer.price).toFixed(2).replace('.', ',')}
            </Text>
            {offer.discount_percent > 0 && (
              <Text style={[styles.discountTag, { color: theme.textMuted }]}>
                -{offer.discount_percent}% OFF
              </Text>
            )}
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => onDelete(item.id)}
            style={styles.deleteButton}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 10 }}
          >
            <Ionicons name="trash-outline" size={17} color={theme.textMuted} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginVertical: 4,
    borderWidth: 1,
  },
  inactiveOpacity: {
    opacity: 0.45,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  infoArea: {
    flex: 2,
    paddingHorizontal: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },
  marketSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  verdictArea: {
    flex: 1,
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  emptyDash: {
    fontSize: 12,
  },
  priceArea: {
    flex: 1.2,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  priceBlock: {
    alignItems: 'flex-end',
  },
  priceValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  discountTag: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  deleteButton: {
    padding: 6,
  },
  actionIconBtn: {
    padding: 6,
    marginHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
export default CartItem;
