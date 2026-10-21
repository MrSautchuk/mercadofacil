/**
 * MercadoFácil - B2B Retail Offers Domain Service
 * 
 * Plataforma de Ofertas Extraordinárias de Supermercados (Relâmpago, Rebaixas de Validade, etc.)
 * 
 * Regras Comerciais:
 * 1. Independência Total: Ofertas patrocinadas NÃO manipulam nem alteram o termômetro de ofertas dos encartes.
 * 2. Transparência: Rotulagem explícita com 'is_sponsored: true'.
 * 3. Validação de Preços: Preço promocional deve ser maior que zero e inferior ao preço regular (quando declarado).
 * 4. Validade Temporal: Início e término estritos; ofertas expiradas saem automaticamente da listagem pública.
 * 5. Segmentação Regional: Baseada na Cidade e UF configuradas pelo usuário, sem exigir GPS invasivo.
 */

export const OFFER_STATUSES = {
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  SCHEDULED: 'scheduled',
  PUBLISHED: 'published',
  PAUSED: 'paused',
  EXPIRED: 'expired',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled'
};

export class RetailOfferService {
  /**
   * Valida as regras de negócio de uma oferta B2B antes de submissão ou aprovação.
   * @param {Object} offer
   * @returns {{ isValid: boolean, errors: string[] }}
   */
  static validateOffer(offer) {
    const errors = [];

    if (!offer.product_name || !offer.product_name.trim()) {
      errors.push('Nome do produto é obrigatório.');
    }

    if (typeof offer.promo_price !== 'number' || offer.promo_price <= 0) {
      errors.push('Preço promocional deve ser um número maior que zero.');
    }

    if (offer.regular_price !== undefined && offer.regular_price !== null) {
      if (typeof offer.regular_price !== 'number' || offer.regular_price <= offer.promo_price) {
        errors.push('Preço original regular deve ser superior ao preço promocional.');
      }
    }

    if (!offer.valid_from || !offer.valid_until) {
      errors.push('Período de validade (início e término) é obrigatório.');
    } else {
      const from = new Date(offer.valid_from).getTime();
      const until = new Date(offer.valid_until).getTime();
      if (isNaN(from) || isNaN(until)) {
        errors.push('Datas de validade inválidas.');
      } else if (until <= from) {
        errors.push('Data de término da oferta deve ser posterior ao início.');
      }
    }

    if (!offer.uf || !offer.uf.trim()) {
      errors.push('Estado (UF) da loja física é obrigatório.');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Filtra e segmenta ofertas publicadas para a região do usuário.
   * Remove automaticamente ofertas fora da janela de validade ou com status não publicado.
   * 
   * @param {Array<Object>} offers
   * @param {Object} params
   * @param {string} params.userUf - UF do usuário (ex: 'SP')
   * @param {string} [params.userCity] - Cidade do usuário (ex: 'Olímpia')
   * @param {Date} [params.now=new Date()]
   */
  static filterRegionalActiveOffers(offers = [], { userUf, userCity = '', now = new Date() } = {}) {
    if (!Array.isArray(offers)) return [];
    const currentTime = now.getTime();

    return offers
      .filter(offer => {
        // Apenas ofertas com status 'published'
        if (offer.status !== OFFER_STATUSES.PUBLISHED) return false;

        // Validação de janela de tempo
        const from = new Date(offer.valid_from).getTime();
        const until = new Date(offer.valid_until).getTime();
        if (currentTime < from || currentTime > until) return false;

        // Segmentação regional (UF obrigatória, Cidade se informada na oferta)
        if (offer.uf && userUf && offer.uf.toUpperCase() !== userUf.toUpperCase()) {
          return false;
        }

        if (offer.city && userCity && offer.city.trim().toLowerCase() !== userCity.trim().toLowerCase()) {
          return false;
        }

        return true;
      })
      .map(offer => ({
        ...offer,
        is_sponsored: true,
        sponsor_badge: 'Oferta Especial de Supermercado Parceiro'
      }));
  }
}
