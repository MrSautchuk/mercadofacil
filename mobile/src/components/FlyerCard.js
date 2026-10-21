// src/components/FlyerCard.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const FlyerCard = React.memo(function FlyerCard({
  flyer,
  isExpanded,
  onlyMatchesFilter,
  theme,
  onToggleExpand,
  onDelete,
  onOpenViewer,
}) {
  const matchedOffers = flyer.offers ? flyer.offers.filter(o => o.matched_item_id !== null) : [];
  const rawOffers = onlyMatchesFilter ? matchedOffers : (flyer.offers || []);

  // Desduplicação de ofertas: evita renderizar itens duplicados quando há cruzamento com a lista
  const offersToDisplay = React.useMemo(() => {
    const dedupMap = new Map();

    rawOffers.forEach(offer => {
      // Chave única pelo nome do produto em minúsculo ou ID
      const key = offer.product_name 
        ? offer.product_name.toLowerCase().trim() 
        : `id_${offer.id}`;

      if (!dedupMap.has(key)) {
        dedupMap.set(key, offer);
      } else {
        const existing = dedupMap.get(key);
        // Se já existe duplicata, prioriza o objeto que possui matched_item_id !== null
        if (offer.matched_item_id !== null && existing.matched_item_id === null) {
          dedupMap.set(key, offer);
        }
      }
    });

    return Array.from(dedupMap.values());
  }, [rawOffers]);

  const formattedValidity = React.useMemo(() => {
    if (!flyer.valid_until) {
      return flyer.uploaded_at ? `Enviado em ${new Date(flyer.uploaded_at).toLocaleDateString('pt-BR')}` : '';
    }
    const val = String(flyer.valid_until).trim();
    if (val.toLowerCase().startsWith('válido') || val.toLowerCase().startsWith('valido')) {
      return val;
    }
    if (val.includes('/')) return `Válido até ${val}`;
    if (val.includes('-')) {
      const parts = val.split('-');
      if (parts.length === 3) return `Válido até ${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return `Válido até ${val}`;
  }, [flyer.valid_until, flyer.uploaded_at]);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          ...theme.cardShadow,
        },
      ]}
    >
      {/* Header do Card com Toque para Expandir/Recolher */}
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.cardHeader}
        onPress={() => onToggleExpand(flyer.id)}
      >
        <View style={styles.titleArea}>
          <View style={styles.supermarketRow}>
            <Text style={[styles.supermarketName, { color: theme.textPrimary }]} numberOfLines={1}>
              🏪 {flyer.supermarket_name}
            </Text>
            <View style={[styles.collapseBadge, { backgroundColor: theme.surfaceSub }]}>
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={theme.accent}
              />
            </View>
          </View>
          <Text style={[styles.metaText, { color: theme.textMuted }]} numberOfLines={1}>
            {flyer.original_filename || 'Encarte'} • {formattedValidity} • {flyer.offers?.length || 0} ofertas
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => onDelete(flyer.id)}
          style={styles.deleteBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={17} color={theme.dealBad} />
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Barra de Ações: Botão Visualizar Encarte + Indicador de ofertas */}
      <View style={[styles.actionBar, { borderTopColor: theme.borderSubtle }]}>
        <TouchableOpacity
          style={[
            styles.viewBtn,
            {
              backgroundColor: theme.surfaceSub,
              borderColor: theme.border,
            },
          ]}
          onPress={() => onOpenViewer(flyer)}
          activeOpacity={0.7}
        >
          <Ionicons name="eye-outline" size={15} color={theme.accent} />
          <Text style={[styles.viewBtnText, { color: theme.accentText }]}>
            Visualizar Encarte
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toggleTextBtn}
          onPress={() => onToggleExpand(flyer.id)}
        >
          <Text style={[styles.toggleText, { color: theme.textMuted }]}>
            {isExpanded ? 'Recolher ofertas ▴' : 'Ver ofertas ▾'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Lista de Ofertas do Encarte */}
      {isExpanded && (
        <View style={styles.offersGrid}>
          {offersToDisplay.map((offer) => {
            const isMatch = offer.matched_item_id !== null;
            return (
              <View
                key={offer.id}
                style={[
                  styles.offerItem,
                  {
                    backgroundColor: theme.surfaceSub,
                    borderColor: theme.border,
                  },
                  isMatch && {
                    borderColor: theme.accent,
                    backgroundColor: theme.accentMuted,
                  },
                ]}
              >
                {isMatch && (
                  <View style={styles.matchRow}>
                    <Ionicons name="star" size={11} color={theme.accent} />
                    <Text
                      style={[styles.matchText, { color: theme.accent }]}
                      numberOfLines={1}
                    >
                      {offer.matched_item_name}
                    </Text>
                  </View>
                )}

                <View
                  style={[
                    styles.verdictBadge,
                    offer.deal_verdict === 'super_oferta'
                      ? { backgroundColor: theme.dealOffer }
                      : offer.deal_verdict === 'falsa_promocao'
                      ? { backgroundColor: theme.dealBad }
                      : { backgroundColor: theme.dealNormal },
                  ]}
                >
                  <Text style={styles.verdictText}>
                    {offer.deal_verdict === 'super_oferta'
                      ? '🔥 SUPER OFERTA'
                      : offer.deal_verdict === 'falsa_promocao'
                      ? '⚠️ PREÇO COMUM'
                      : '🟡 PREÇO NORMAL'}
                  </Text>
                </View>

                <Text
                  style={[styles.productName, { color: theme.textPrimary }]}
                  numberOfLines={2}
                >
                  {offer.product_name}
                </Text>

                <View style={styles.priceRow}>
                  <Text style={[styles.priceText, { color: theme.accent }]}>
                    R$ {Number(offer.price).toFixed(2).replace('.', ',')}
                  </Text>
                  {offer.unit ? (
                    <Text style={[styles.unitText, { color: theme.textMuted }]}>
                      /{offer.unit}
                    </Text>
                  ) : null}
                </View>

                {offer.regular_price > offer.price && (
                  <Text
                    style={[styles.regularPriceText, { color: theme.textMuted }]}
                    numberOfLines={1}
                  >
                    Normal: R$ {Number(offer.regular_price).toFixed(2).replace('.', ',')}
                    {offer.discount_percent > 0 ? ` (-${offer.discount_percent}%)` : ''}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 14,
    marginVertical: 6,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleArea: {
    flex: 1,
    paddingRight: 8,
  },
  supermarketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  supermarketName: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  collapseBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaText: {
    fontSize: 11,
    marginTop: 3,
  },
  deleteBtn: {
    padding: 6,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  viewBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  toggleTextBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  toggleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  offersGrid: {
    marginTop: 10,
    gap: 8,
  },
  offerItem: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  matchText: {
    fontSize: 11,
    fontWeight: '800',
  },
  verdictBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    marginBottom: 6,
  },
  verdictText: {
    color: '#000',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  productName: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  priceText: {
    fontSize: 14,
    fontWeight: '800',
  },
  unitText: {
    fontSize: 11,
    marginLeft: 2,
  },
  regularPriceText: {
    fontSize: 10.5,
    marginTop: 2,
  },
});
export default FlyerCard;
