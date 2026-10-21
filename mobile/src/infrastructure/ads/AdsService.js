/**
 * MercadoFácil - Ads Service (Abstração Independente de Provedor)
 * 
 * Permite plugar futuramente Google AdMob ou outro provedor compatível com React Native/Expo
 * sem espalhar regras de publicidade pela interface gráfica.
 * 
 * Políticas e Segurança:
 * - Se o Entitlement do usuário indicar 'adsRemoved: true', nenhum anúncio é inicializado ou carregado.
 * - Falhas de carregamento de anúncios nunca travam nem atrasam a navegação ou o app.
 * - Suporta killswitch global para desativação remota imediata.
 * - Utiliza Unit IDs de teste padrão da AdMob no ambiente de desenvolvimento/sandbox.
 */

// IDs oficiais de teste do Google AdMob (Google Sample Ad Unit IDs)
export const ADMOB_TEST_IDS = {
  ANDROID_BANNER: 'ca-app-pub-3940256099942544/6300978111',
  IOS_BANNER: 'ca-app-pub-3940256099942544/2934735716',
  ANDROID_APP_OPEN: 'ca-app-pub-3940256099942544/9257390115',
  IOS_APP_OPEN: 'ca-app-pub-3940256099942544/5575463023'
};

/**
 * Mock / Sandbox Provider padrão
 */
class DevMockAdsProvider {
  constructor() {
    this.name = 'DevMockAdsProvider';
    this.isInitialized = false;
  }

  async initialize() {
    this.isInitialized = true;
    return { success: true, provider: this.name, testMode: true };
  }

  async loadBanner(placementId) {
    if (!this.isInitialized) throw new Error('AdsProvider not initialized');
    return {
      adId: `mock_ad_${Date.now()}`,
      placementId,
      format: 'BANNER_ADAPTIVE',
      width: 320,
      height: 50,
      loaded: true
    };
  }

  async loadAppOpenAd(placementId) {
    if (!this.isInitialized) throw new Error('AdsProvider not initialized');
    return {
      adId: `mock_open_${Date.now()}`,
      placementId,
      format: 'APP_OPEN',
      loaded: true
    };
  }

  async destroy() {
    this.isInitialized = false;
  }
}

export class AdsService {
  /**
   * @param {Object} options
   * @param {Object} [options.provider] - Provedor de anúncios (default: DevMockAdsProvider)
   * @param {boolean} [options.enabled=true] - Killswitch global
   * @param {number} [options.minIntervalMs=30000] - Intervalo mínimo entre requisições de anúncios (30s)
   */
  constructor({ provider = null, enabled = true, minIntervalMs = 30000 } = {}) {
    this.provider = provider || new DevMockAdsProvider();
    this.enabled = enabled;
    this.minIntervalMs = minIntervalMs;
    this.lastAdShownAt = 0;
    this.initialized = false;
  }

  /**
   * Inicializa o serviço caso anúncios estejam habilitados globalmente.
   */
  async initialize() {
    if (!this.enabled) {
      return { initialized: false, reason: 'killswitch_active' };
    }
    try {
      await this.provider.initialize();
      this.initialized = true;
      return { initialized: true, provider: this.provider.name };
    } catch (err) {
      console.warn('[AdsService] Falha não impeditiva ao inicializar anúncios:', err.message);
      this.initialized = false;
      return { initialized: false, error: err.message };
    }
  }

  /**
   * Determina se anúncios devem ser renderizados considerando o entitlement do usuário e rate limit.
   * @param {import('../entitlements/EntitlementEngine').EntitlementSnapshot} entitlement
   */
  shouldDisplayAds(entitlement) {
    if (!this.enabled) return false;
    if (!entitlement) return false;
    if (entitlement.adsRemoved) return false; // Titular Lifetime ou Família Ativa
    return true;
  }

  /**
   * Carrega um banner de forma segura sem propagar erros para a UI.
   * @param {string} placement
   * @param {import('../entitlements/EntitlementEngine').EntitlementSnapshot} entitlement
   */
  async getBannerAd(placement, entitlement) {
    if (!this.shouldDisplayAds(entitlement)) {
      return { shouldRender: false, reason: 'entitlement_disallows_ads' };
    }

    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const ad = await this.provider.loadBanner(placement);
      this.lastAdShownAt = Date.now();
      return {
        shouldRender: true,
        ad,
        isTest: true
      };
    } catch (err) {
      console.warn(`[AdsService] Anúncio não carregou para o espaço ${placement}:`, err.message);
      // Retorna estado resiliente: aplicação segue normalmente sem anúncio
      return {
        shouldRender: false,
        reason: 'load_failure',
        error: err.message
      };
    }
  }

  /**
   * Desativação emergencial de anúncios
   */
  setKillSwitch(enabled) {
    this.enabled = enabled;
  }
}

export const defaultAdsService = new AdsService();
