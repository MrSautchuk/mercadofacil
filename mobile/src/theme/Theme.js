// src/theme/Theme.js
// Design tokens inspirados no Nubank: alto contraste, respiro (whitespace),
// bordas quase imperceptíveis, sombras suaves e uso cirúrgico da cor de destaque (verde esmeralda).

export const lightTheme = {
  isDark: false,
  statusBarStyle: 'dark',
  // Backgrounds & Surfaces
  bg: '#f8fafc',
  surface: '#ffffff',
  surfaceSub: '#f1f5f9',
  surfaceRaised: '#ffffff',
  // Compatibilidade com código legado
  cardBg: '#ffffff',
  cardSubBg: '#f1f5f9',
  // Borders & Dividers
  border: 'rgba(0, 0, 0, 0.06)',
  borderSubtle: 'rgba(0, 0, 0, 0.04)',
  borderFocus: 'rgba(16, 185, 129, 0.4)',
  // Typography
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#64748b',
  textDim: '#94a3b8',
  textMain: '#0f172a',
  textInverse: '#ffffff',
  // Accents & Signals
  accent: '#10b981', // Verde esmeralda cirúrgico
  accentMuted: 'rgba(16, 185, 129, 0.12)',
  accentText: '#047857',
  accentLime: '#10b981',
  accentLimeSub: 'rgba(16, 185, 129, 0.12)',
  dealOffer: '#10b981',
  dealOfferBg: 'rgba(16, 185, 129, 0.10)',
  dealNormal: '#f59e0b',
  dealNormalBg: 'rgba(245, 158, 11, 0.10)',
  dealBad: '#ef4444',
  dealBadBg: 'rgba(239, 68, 68, 0.10)',
  // Input
  inputBg: '#f1f5f9',
  inputText: '#0f172a',
  // Shadows
  cardShadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
};

export const darkTheme = {
  isDark: true,
  statusBarStyle: 'light',
  // Backgrounds & Surfaces
  bg: '#0a0a0a',
  surface: '#121212',
  surfaceSub: '#181818',
  surfaceRaised: '#202020',
  // Compatibilidade com código legado
  cardBg: '#121212',
  cardSubBg: '#181818',
  // Borders & Dividers
  border: 'rgba(255, 255, 255, 0.07)',
  borderSubtle: 'rgba(255, 255, 255, 0.04)',
  borderFocus: 'rgba(52, 211, 153, 0.35)',
  // Typography
  textPrimary: '#ffffff',
  textSecondary: '#cbd5e1',
  textMuted: '#a3a3a3',
  textDim: '#71717a',
  textMain: '#ffffff',
  textInverse: '#0a0a0a',
  // Accents & Signals
  accent: '#34d399', // Verde luminoso e elegante
  accentMuted: 'rgba(52, 211, 153, 0.14)',
  accentText: '#34d399',
  accentLime: '#34d399',
  accentLimeSub: 'rgba(52, 211, 153, 0.14)',
  dealOffer: '#34d399',
  dealOfferBg: 'rgba(52, 211, 153, 0.12)',
  dealNormal: '#fbbf24',
  dealNormalBg: 'rgba(251, 191, 36, 0.12)',
  dealBad: '#f87171',
  dealBadBg: 'rgba(248, 113, 113, 0.12)',
  // Input
  inputBg: '#181818',
  inputText: '#ffffff',
  // Shadows
  cardShadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 3,
  },
};

export const getTheme = (isDark) => (isDark ? darkTheme : lightTheme);
export default getTheme;
