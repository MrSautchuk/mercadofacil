/**
 * MercadoFácil - Billing Service (Abstração de Compras In-App e Assinaturas)
 * 
 * Prepara a integração com Google Play Billing e Apple StoreKit
 * (via RevenueCat 'react-native-purchases' ou 'react-native-iap').
 * 
 * Produtos Oficiais Mapeados:
 * - 'com.mercadofacil.noads.lifetime': R$ 3,99 (Compra única, não consumível - Apenas remove anúncios)
 * - 'com.mercadofacil.family.monthly': R$ 5,99/mês (Assinatura recorrente - Core Familiar até 3 dispositivos)
 */

export const BILLING_PRODUCTS = {
  LIFETIME_NO_ADS: {
    id: 'com.mercadofacil.noads.lifetime',
    type: 'inapp',
    title: 'Remover Anúncios para Sempre',
    priceString: 'R$ 3,99',
    priceMicros: 3990000,
    currency: 'BRL',
    description: 'Pagamento único. Remove permanentemente todos os anúncios próprios no aplicativo. Não inclui recursos da assinatura familiar.'
  },
  FAMILY_SUBSCRIPTION: {
    id: 'com.mercadofacil.family.monthly',
    type: 'subs',
    title: 'Core Familiar MercadoFácil',
    priceString: 'R$ 5,99 / mês',
    priceMicros: 5990000,
    currency: 'BRL',
    description: 'Assinatura mensal. 1 responsável financeiro + até 3 dispositivos autorizados. Listas compartilhadas, sincronização de encartes e zero anúncios.'
  }
};

export const BILLING_ERROR_CODES = {
  USER_CANCELLED: 'USER_CANCELLED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  RECEIPT_INVALID: 'RECEIPT_INVALID',
  ALREADY_OWNED: 'ALREADY_OWNED',
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  UNKNOWN: 'UNKNOWN'
};

/**
 * Mock Provider para Testes e Ambiente Local
 */
class DevMockBillingProvider {
  constructor() {
    this.name = 'DevMockBillingProvider';
    this.mockReceipts = new Map();
  }

  async initialize() {
    return { success: true, sandbox: true };
  }

  async getProducts() {
    return Object.values(BILLING_PRODUCTS);
  }

  async purchase(productId) {
    if (!Object.values(BILLING_PRODUCTS).some(p => p.id === productId)) {
      const err = new Error('Produto não encontrado no catálogo');
      err.code = BILLING_ERROR_CODES.PRODUCT_NOT_FOUND;
      throw err;
    }

    const transactionId = `trans_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const mockReceipt = {
      productId,
      transactionId,
      purchaseTime: Date.now(),
      status: 'completed',
      signature: 'mock_signature_dev_mode'
    };

    this.mockReceipts.set(productId, mockReceipt);
    return mockReceipt;
  }

  async restorePurchases() {
    return Array.from(this.mockReceipts.values());
  }
}

export class BillingService {
  /**
   * @param {Object} [options]
   * @param {Object} [options.provider]
   * @param {string} [options.backendVerifyUrl]
   */
  constructor({ provider = null, backendVerifyUrl = null } = {}) {
    this.provider = provider || new DevMockBillingProvider();
    this.backendVerifyUrl = backendVerifyUrl;
    this.initialized = false;
  }

  async initialize() {
    try {
      await this.provider.initialize();
      this.initialized = true;
      return { initialized: true };
    } catch (err) {
      console.error('[BillingService] Erro ao inicializar billing:', err);
      return { initialized: false, error: err.message };
    }
  }

  async getProducts() {
    return this.provider.getProducts();
  }

  /**
   * Executa a intenção de compra de um produto.
   * @param {string} productId
   */
  async purchaseProduct(productId) {
    if (!this.initialized) await this.initialize();
    try {
      const receipt = await this.provider.purchase(productId);
      const verified = await this.verifyReceiptWithBackend(receipt);
      return {
        success: true,
        receipt,
        verified
      };
    } catch (err) {
      return {
        success: false,
        code: err.code || BILLING_ERROR_CODES.UNKNOWN,
        message: err.message
      };
    }
  }

  /**
   * Restaura compras anteriores associadas à conta da loja (Google Play / App Store).
   */
  async restorePurchases() {
    if (!this.initialized) await this.initialize();
    try {
      const restored = await this.provider.restorePurchases();
      return {
        success: true,
        restoredPurchases: restored
      };
    } catch (err) {
      return {
        success: false,
        code: err.code || BILLING_ERROR_CODES.UNKNOWN,
        message: err.message
      };
    }
  }

  /**
   * Validação de recibo com o backend para segurança contra adulteração local.
   * @param {Object} receipt
   */
  async verifyReceiptWithBackend(receipt) {
    if (!this.backendVerifyUrl) {
      // Em modo standalone/dev, validação sintática do mock
      return { valid: true, mode: 'local_validation', productId: receipt.productId };
    }

    try {
      const res = await fetch(this.backendVerifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receipt })
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.warn('[BillingService] Validação de recibo no backend falhou (offline/rede):', err.message);
      return { valid: false, reason: 'network_error' };
    }
  }
}

export const defaultBillingService = new BillingService();
