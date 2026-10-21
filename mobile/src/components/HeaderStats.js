// src/components/HeaderStats.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const HeaderStats = React.memo(function HeaderStats({
  superDealsCount = 0,
  theme,
}) {
  const count = Number(superDealsCount) || 0;
  const labelText = count === 1 
    ? '1 item em oferta na sua lista' 
    : `${count} itens em oferta na sua lista`;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.singleBanner,
          {
            // No tema claro, usamos fundo sólido esmeralda clarinho e borda sutil combinando
            backgroundColor: theme.isDark ? 'rgba(52, 211, 153, 0.12)' : '#ecfdf5',
            borderColor: theme.isDark ? 'rgba(52, 211, 153, 0.25)' : '#a7f3d0',
          },
        ]}
      >
        <View 
          style={[
            styles.circle, 
            { backgroundColor: theme.accent }
          ]}
        >
          <Ionicons name="checkmark" size={13} color="#ffffff" />
        </View>
        <Text 
          style={[
            styles.bannerText, 
            { color: theme.isDark ? '#34d399' : '#047857' }
          ]} 
          numberOfLines={1}
        >
          {labelText}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginTop: 6,
    marginBottom: 4,
  },
  singleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  circle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});

export default HeaderStats;
