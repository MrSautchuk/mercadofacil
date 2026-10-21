/**
 * MercadoFácil - Entitlement Engine
 * Camada central de domínio para cálculo e validação de direitos de acesso (Entitlements).
 * 
 * Regras de Negócio e Precedência:
 * 1. Free: Sem compras válidas -> Vê anúncios, recursos familiares desativados.
 * 2. Compra Única (Lifetime): Remove anúncios do titular permanentemente. Não concede recursos familiares.
 * 3. Assinatura Familiar: Concede recursos premium aos até 3 dispositivos autorizados do Core e remove anúncios.
 *    - Se o titular possuir compra única e a assinatura expirar, os anúncios continuam removidos.
 * 4. Expirado: Assinatura vencida revoga direitos premium, mas NUNCA apaga dados das listas existentes.
 * 5. Dispositivo Não Autorizado: Rejeitado mesmo se alegar pertencer ao Core Familiar.
 */

export const TIERS = {
  FREE: 'free',
  LIFETIME_NO_ADS: 'lifetime_no_ads',
  FAMILY_PREMIUM: 'family_premium'
};

export const PRODUCT_IDS = {
  LIFETIME_NO_ADS: 'com.mercadofacil.noads.lifetime',
  FAMILY_MONTHLY: 'com.mercadofacil.family.monthly'
};

/**
 * @typedef {Object} EntitlementSnapshot
 * @property {boolean} adsRemoved - Se os anúncios devem ser ocultados
 * @property {boolean} familyPremiumActive - Se os recursos familiares estão ativos
 * @property {string|null} familyCoreId - ID do Core Familiar vinculado
 * @property {boolean} canShareLists - Permissão para compartilhar listas com a família
 * @property {boolean} canSyncFiles - Permissão para sincronizar PDFs e fotos de encartes
 * @property {boolean} canManageFamily - Se o usuário tem papel de administrador/titular financeiro do Core
 * @property {'free'|'lifetime_no_ads'|'family_premium'} tier - Nível comercial do usuário
 * @property {string|null} expiresAt - Data de expiração da assinatura, se houver
 * @property {string} calculatedAt - Timestamp de cálculo
 */

/**
 * Calcula o snapshot de direitos de forma atômica e determinística.
 * 
 * @param {Object} params
 * @param {Array<{productId: string, status: string}>} [params.purchases=[]] - Compras do usuário
 * @param {Object|null} [params.subscription=null] - Dados da assinatura ativa
 * @param {string|null} [params.currentDeviceId=null] - ID do dispositivo atual
 * @param {Object|null} [params.familyCore=null] - Dados do Core Familiar
 * @param {Date} [params.now=new Date()] - Referência temporal para teste de expiração
 * @returns {EntitlementSnapshot}
 */
export function calculateEntitlements({
  purchases = [],
  subscription = null,
  currentDeviceId = null,
  familyCore = null,
  now = new Date()
} = {}) {
  const currentDate = now instanceof Date ? now : new Date(now);

  // 1. Verificar se possui Compra Única de Remoção de Anúncios (Vitalícia)
  const hasLifetimeNoAds = purchases.some(p => 
    p.productId === PRODUCT_IDS.LIFETIME_NO_ADS && 
    (p.status === 'valid' || p.status === 'completed' || p.status === 'restored')
  );

  // 2. Verificar validade da Assinatura Familiar
  let isFamilySubscriptionActive = false;
  let subExpiresAt = null;

  if (subscription && subscription.productId === PRODUCT_IDS.FAMILY_MONTHLY) {
    subExpiresAt = subscription.expiresAt ? new Date(subscription.expiresAt) : null;
    const isStatusActive = subscription.status === 'active' || subscription.status === 'trialing';
    const isNotExpired = subExpiresAt ? subExpiresAt.getTime() > currentDate.getTime() : false;

    if (isStatusActive && isNotExpired) {
      isFamilySubscriptionActive = true;
    }
  }

  // 3. Verificar autorização do Dispositivo no Core Familiar
  let isDeviceAuthorizedInFamily = false;
  let isFamilyOwner = false;
  let activeCoreId = null;

  if (isFamilySubscriptionActive && familyCore && currentDeviceId) {
    activeCoreId = familyCore.id || null;
    isFamilyOwner = familyCore.ownerDeviceId === currentDeviceId || familyCore.ownerAccountId === currentDeviceId;

    // Verificar se o dispositivo está na lista de autorizados e não revogados (máx 3)
    const authorizedDevices = Array.isArray(familyCore.authorizedDevices) 
      ? familyCore.authorizedDevices.filter(d => d.status === 'active')
      : [];

    const deviceRecord = authorizedDevices.find(d => d.deviceId === currentDeviceId);
    if (deviceRecord && authorizedDevices.length <= (familyCore.maxDevices || 3)) {
      isDeviceAuthorizedInFamily = true;
    }
  }

  // 4. Consolidação de Precedência de Entitlements
  if (isFamilySubscriptionActive && isDeviceAuthorizedInFamily) {
    return {
      adsRemoved: true,
      familyPremiumActive: true,
      familyCoreId: activeCoreId,
      canShareLists: true,
      canSyncFiles: true,
      canManageFamily: isFamilyOwner,
      tier: TIERS.FAMILY_PREMIUM,
      expiresAt: subExpiresAt ? subExpiresAt.toISOString() : null,
      calculatedAt: currentDate.toISOString()
    };
  }

  if (hasLifetimeNoAds) {
    return {
      adsRemoved: true,
      familyPremiumActive: false,
      familyCoreId: null,
      canShareLists: false,
      canSyncFiles: false,
      canManageFamily: false,
      tier: TIERS.LIFETIME_NO_ADS,
      expiresAt: null,
      calculatedAt: currentDate.toISOString()
    };
  }

  // Fallback padrão: Plano Gratuito (com anúncios)
  return {
    adsRemoved: false,
    familyPremiumActive: false,
    familyCoreId: null,
    canShareLists: false,
    canSyncFiles: false,
    canManageFamily: false,
    tier: TIERS.FREE,
    expiresAt: null,
    calculatedAt: currentDate.toISOString()
  };
}

/**
 * Cria um snapshot seguro de contingência em caso de falha de rede temporária.
 * Nunca concede privilégios permanentes indevidos durante falhas de conectividade.
 */
export function createSafeFallbackSnapshot(cachedSnapshot = null) {
  if (cachedSnapshot && typeof cachedSnapshot === 'object') {
    // Permite usar cache local desde que não esteja expirado
    return {
      ...cachedSnapshot,
      isFromCache: true
    };
  }

  return {
    adsRemoved: false,
    familyPremiumActive: false,
    familyCoreId: null,
    canShareLists: false,
    canSyncFiles: false,
    canManageFamily: false,
    tier: TIERS.FREE,
    expiresAt: null,
    isFromCache: false,
    calculatedAt: new Date().toISOString()
  };
}
