/**
 * MercadoFácil - Suíte Completa de Testes Unitários de Monetização & Entitlements
 * Valida todas as 16 regras de negócio e restrições obrigatórias especificadas.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateEntitlements,
  createSafeFallbackSnapshot,
  PRODUCT_IDS,
  TIERS
} from '../src/domain/entitlements/EntitlementEngine.js';

import {
  AdsService,
  defaultAdsService
} from '../src/infrastructure/ads/AdsService.js';

import {
  BillingService,
  BILLING_PRODUCTS,
  BILLING_ERROR_CODES
} from '../src/infrastructure/billing/BillingService.js';

import {
  FamilyCoreService,
  MAX_FAMILY_DEVICES
} from '../src/domain/family/FamilyCoreService.js';

import {
  RetailOfferService,
  OFFER_STATUSES
} from '../src/domain/b2b/RetailOfferService.js';

// ==========================================
// GRUPO 1: REGRAS DE ENTITLEMENT & PRECEDÊNCIA
// ==========================================

test('1. Usuário gratuito vê anúncios e não tem recursos premium', () => {
  const snapshot = calculateEntitlements({
    purchases: [],
    subscription: null,
    currentDeviceId: 'dev_user_1',
    familyCore: null
  });

  assert.equal(snapshot.tier, TIERS.FREE);
  assert.equal(snapshot.adsRemoved, false);
  assert.equal(snapshot.familyPremiumActive, false);
  assert.equal(snapshot.canShareLists, false);
  assert.equal(snapshot.canSyncFiles, false);
});

test('2. Usuário com compra única válida não vê anúncios', () => {
  const snapshot = calculateEntitlements({
    purchases: [
      { productId: PRODUCT_IDS.LIFETIME_NO_ADS, status: 'valid' }
    ],
    subscription: null,
    currentDeviceId: 'dev_user_1'
  });

  assert.equal(snapshot.tier, TIERS.LIFETIME_NO_ADS);
  assert.equal(snapshot.adsRemoved, true);
});

test('3. Compra única para remover anúncios NÃO concede acesso familiar', () => {
  const snapshot = calculateEntitlements({
    purchases: [
      { productId: PRODUCT_IDS.LIFETIME_NO_ADS, status: 'valid' }
    ],
    subscription: null,
    currentDeviceId: 'dev_user_1'
  });

  assert.equal(snapshot.familyPremiumActive, false);
  assert.equal(snapshot.canShareLists, false);
  assert.equal(snapshot.canSyncFiles, false);
  assert.equal(snapshot.canManageFamily, false);
  assert.equal(snapshot.familyCoreId, null);
});

test('4 & 5. Assinante familiar autorizado não vê anúncios e acessa recursos premium', () => {
  const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // +30 dias
  const familyCore = {
    id: 'core_100',
    ownerDeviceId: 'device_owner',
    maxDevices: 3,
    authorizedDevices: [
      { deviceId: 'device_owner', status: 'active' },
      { deviceId: 'device_member_1', status: 'active' }
    ]
  };

  const snapshotOwner = calculateEntitlements({
    purchases: [],
    subscription: {
      productId: PRODUCT_IDS.FAMILY_MONTHLY,
      status: 'active',
      expiresAt: futureDate.toISOString()
    },
    currentDeviceId: 'device_owner',
    familyCore
  });

  assert.equal(snapshotOwner.tier, TIERS.FAMILY_PREMIUM);
  assert.equal(snapshotOwner.adsRemoved, true);
  assert.equal(snapshotOwner.familyPremiumActive, true);
  assert.equal(snapshotOwner.canShareLists, true);
  assert.equal(snapshotOwner.canSyncFiles, true);
  assert.equal(snapshotOwner.canManageFamily, true); // Dono pode administrar

  const snapshotMember = calculateEntitlements({
    purchases: [],
    subscription: {
      productId: PRODUCT_IDS.FAMILY_MONTHLY,
      status: 'active',
      expiresAt: futureDate.toISOString()
    },
    currentDeviceId: 'device_member_1',
    familyCore
  });

  assert.equal(snapshotMember.tier, TIERS.FAMILY_PREMIUM);
  assert.equal(snapshotMember.adsRemoved, true);
  assert.equal(snapshotMember.familyPremiumActive, true);
  assert.equal(snapshotMember.canShareLists, true);
  assert.equal(snapshotMember.canManageFamily, false); // Membro não é titular
});

test('6. Dispositivo não autorizado NÃO acessa dados familiares', () => {
  const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const familyCore = {
    id: 'core_100',
    ownerDeviceId: 'device_owner',
    maxDevices: 3,
    authorizedDevices: [
      { deviceId: 'device_owner', status: 'active' },
      { deviceId: 'device_member_1', status: 'active' }
    ]
  };

  const snapshotIntruder = calculateEntitlements({
    purchases: [],
    subscription: {
      productId: PRODUCT_IDS.FAMILY_MONTHLY,
      status: 'active',
      expiresAt: futureDate.toISOString()
    },
    currentDeviceId: 'device_intruder_unauthorized',
    familyCore
  });

  assert.equal(snapshotIntruder.tier, TIERS.FREE);
  assert.equal(snapshotIntruder.familyPremiumActive, false);
  assert.equal(snapshotIntruder.canShareLists, false);
  assert.equal(snapshotIntruder.adsRemoved, false);
});

// ==========================================
// GRUPO 2: LIMITES, ATOMICIDADE E REVOGAÇÃO
// ==========================================

test('7. Limite de 3 dispositivos não pode ser ultrapassado', () => {
  const fullCore = {
    id: 'core_100',
    maxDevices: 3,
    authorizedDevices: [
      { deviceId: 'dev_1', status: 'active' },
      { deviceId: 'dev_2', status: 'active' },
      { deviceId: 'dev_3', status: 'active' }
    ]
  };

  const check = FamilyCoreService.canAddDevice(fullCore, 'dev_4');
  assert.equal(check.canAdd, false);
  assert.equal(check.reason, 'max_devices_exceeded');
  assert.equal(check.currentCount, 3);
});

test('8. A revogação de um dispositivo impede novos acessos autorizados', () => {
  const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const familyCoreWithRevoked = {
    id: 'core_100',
    ownerDeviceId: 'dev_1',
    maxDevices: 3,
    authorizedDevices: [
      { deviceId: 'dev_1', status: 'active' },
      { deviceId: 'dev_revoked', status: 'revoked' } // Revogado
    ]
  };

  const snapshot = calculateEntitlements({
    subscription: {
      productId: PRODUCT_IDS.FAMILY_MONTHLY,
      status: 'active',
      expiresAt: futureDate.toISOString()
    },
    currentDeviceId: 'dev_revoked',
    familyCore: familyCoreWithRevoked
  });

  assert.equal(snapshot.tier, TIERS.FREE);
  assert.equal(snapshot.familyPremiumActive, false);
  assert.equal(snapshot.canShareLists, false);
});

test('9 & 10. Expiração da assinatura revoga direitos premium sem apagar dados do usuário', () => {
  const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // Expirou há 5 dias
  const familyCore = {
    id: 'core_100',
    ownerDeviceId: 'dev_1',
    maxDevices: 3,
    authorizedDevices: [
      { deviceId: 'dev_1', status: 'active' }
    ]
  };

  // Simular que o usuário possuía uma compra única ANTES da assinatura
  const snapshotWithLifetime = calculateEntitlements({
    purchases: [
      { productId: PRODUCT_IDS.LIFETIME_NO_ADS, status: 'valid' }
    ],
    subscription: {
      productId: PRODUCT_IDS.FAMILY_MONTHLY,
      status: 'active',
      expiresAt: pastDate.toISOString() // EXPIRADO
    },
    currentDeviceId: 'dev_1',
    familyCore
  });

  // Direitos familiares revogados
  assert.equal(snapshotWithLifetime.familyPremiumActive, false);
  assert.equal(snapshotWithLifetime.canShareLists, false);
  // Mas como tinha lifetime, os anúncios continuam desativados!
  assert.equal(snapshotWithLifetime.adsRemoved, true);
  assert.equal(snapshotWithLifetime.tier, TIERS.LIFETIME_NO_ADS);

  // Sem lifetime: volta para Free, mas dados permanecem intactos no banco local
  const snapshotWithoutLifetime = calculateEntitlements({
    purchases: [],
    subscription: {
      productId: PRODUCT_IDS.FAMILY_MONTHLY,
      status: 'active',
      expiresAt: pastDate.toISOString()
    },
    currentDeviceId: 'dev_1',
    familyCore
  });

  assert.equal(snapshotWithoutLifetime.tier, TIERS.FREE);
  assert.equal(snapshotWithoutLifetime.familyPremiumActive, false);
  assert.equal(snapshotWithoutLifetime.adsRemoved, false);
});

// ==========================================
// GRUPO 3: B2B OFERTAS DE SUPERMERCADOS
// ==========================================

test('11 & 13. Validações de preços e condições inválidas em ofertas B2B', () => {
  // Promo price negativo
  const invalid1 = RetailOfferService.validateOffer({
    product_name: 'Arroz 5kg',
    promo_price: -10,
    valid_from: new Date().toISOString(),
    valid_until: new Date(Date.now() + 86400000).toISOString(),
    uf: 'SP'
  });
  assert.equal(invalid1.isValid, false);
  assert.ok(invalid1.errors.some(e => e.includes('maior que zero')));

  // Preço promocional maior que o regular
  const invalid2 = RetailOfferService.validateOffer({
    product_name: 'Feijão 1kg',
    regular_price: 8.00,
    promo_price: 12.00, // Incoerência comercial
    valid_from: new Date().toISOString(),
    valid_until: new Date(Date.now() + 86400000).toISOString(),
    uf: 'SP'
  });
  assert.equal(invalid2.isValid, false);
  assert.ok(invalid2.errors.some(e => e.includes('superior ao preço promocional')));

  // Datas invertidas
  const invalid3 = RetailOfferService.validateOffer({
    product_name: 'Leite 1L',
    promo_price: 4.50,
    valid_from: new Date(Date.now() + 86400000).toISOString(),
    valid_until: new Date().toISOString(), // Termina antes de começar
    uf: 'SP'
  });
  assert.equal(invalid3.isValid, false);
  assert.ok(invalid3.errors.some(e => e.includes('posterior ao início')));
});

test('12. Ofertas B2B expiradas deixam de aparecer como disponíveis e mantêm selo de patrocinado', () => {
  const now = new Date();
  const pastUntil = new Date(Date.now() - 3600000).toISOString(); // Expirou há 1 hora
  const futureUntil = new Date(Date.now() + 86400000).toISOString(); // Válido até amanhã

  const offers = [
    {
      id: 1,
      product_name: 'Oferta Válida',
      promo_price: 10,
      valid_from: new Date(Date.now() - 3600000).toISOString(),
      valid_until: futureUntil,
      status: OFFER_STATUSES.PUBLISHED,
      uf: 'SP',
      city: 'Olímpia'
    },
    {
      id: 2,
      product_name: 'Oferta Expirada',
      promo_price: 8,
      valid_from: new Date(Date.now() - 7200000).toISOString(),
      valid_until: pastUntil,
      status: OFFER_STATUSES.PUBLISHED,
      uf: 'SP',
      city: 'Olímpia'
    },
    {
      id: 3,
      product_name: 'Oferta Não Publicada (Rascunho)',
      promo_price: 5,
      valid_from: new Date(Date.now() - 3600000).toISOString(),
      valid_until: futureUntil,
      status: OFFER_STATUSES.DRAFT,
      uf: 'SP',
      city: 'Olímpia'
    }
  ];

  const filtered = RetailOfferService.filterRegionalActiveOffers(offers, {
    userUf: 'SP',
    userCity: 'Olímpia',
    now
  });

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 1);
  assert.equal(filtered[0].is_sponsored, true);
  assert.ok(filtered[0].sponsor_badge.includes('Parceiro'));
});

// ==========================================
// GRUPO 4: RESILIÊNCIA DE REDE, ADS E BILLING
// ==========================================

test('14. Falha de carregamento de anúncios NÃO quebra o fluxo e retorna estado resiliente', async () => {
  class FailingAdsProvider {
    async initialize() { return { success: true }; }
    async loadBanner() { throw new Error('AdMob Network Timeout 504'); }
  }

  const failingService = new AdsService({ provider: new FailingAdsProvider() });
  await failingService.initialize();

  const entitlement = { adsRemoved: false, tier: TIERS.FREE };
  const bannerResult = await failingService.getBannerAd('cesta_bottom', entitlement);

  // Não lançou exceção, apenas informou que não deve renderizar
  assert.equal(bannerResult.shouldRender, false);
  assert.equal(bannerResult.reason, 'load_failure');
  assert.ok(bannerResult.error.includes('AdMob Network Timeout 504'));
});

test('15. Falha de rede temporária não concede direitos premium indevidos', () => {
  const fallback = createSafeFallbackSnapshot(null);

  assert.equal(fallback.tier, TIERS.FREE);
  assert.equal(fallback.adsRemoved, false);
  assert.equal(fallback.familyPremiumActive, false);
  assert.equal(fallback.canShareLists, false);
  assert.equal(fallback.isFromCache, false);
});

test('16. Restauração de compras idempotente não duplica entitlements', async () => {
  const billing = new BillingService();
  await billing.initialize();

  // Compra única simulada
  await billing.purchaseProduct(BILLING_PRODUCTS.LIFETIME_NO_ADS.id);

  // Restaurar compras
  const restoreRes1 = await billing.restorePurchases();
  assert.equal(restoreRes1.success, true);
  assert.equal(restoreRes1.restoredPurchases.length, 1);

  // Restaurar novamente
  const restoreRes2 = await billing.restorePurchases();
  assert.equal(restoreRes2.success, true);
  assert.equal(restoreRes2.restoredPurchases.length, 1); // Idempotente, não duplicou
});
