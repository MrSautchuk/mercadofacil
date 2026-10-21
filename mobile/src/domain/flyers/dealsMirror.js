/**
 * Algoritmo de Competição de Preço para o Core Familiar: "Lowest Price Wins".
 * 
 * Permite que múltiplos aparelhos da família processem encartes locais diferentes
 * e que a lista compartilhada preserve e espelhe continuamente o menor preço absoluto
 * com sua respectiva bandeira de supermercado e veredito de economia.
 * 
 * Estrutura do snapshot:
 * {
 *   price: number,
 *   regular_price: number,
 *   supermarket: string,
 *   deal_verdict: string,
 *   discount_percent: number
 * }
 */

/**
 * Converte de forma segura strings JSON ou objetos em um snapshot tipado.
 * @param {string|Object|null} snapshot
 * @returns {Object|null}
 */
export function parseOfferSnapshot(snapshot) {
  if (!snapshot) return null;
  if (typeof snapshot === 'object') return snapshot;
  try {
    return JSON.parse(snapshot);
  } catch (_) {
    return null;
  }
}

/**
 * Avalia a nova oferta encontrada localmente contra o snapshot atual do item.
 * Regra "Lowest Price Wins":
 * 1. Se o item não tem snapshot anterior, a nova oferta vence imediatamente.
 * 2. Se a nova oferta tem um preço menor (newOffer.price < current.price), ela substitui o snapshot.
 * 
 * @param {Object} item - Item atual da lista (contendo id, name, offer_snapshot, etc.)
 * @param {Object} newOffer - Oferta extraída pela IA (contendo price, regular_price, supermarket, deal_verdict, discount_percent)
 * @returns {{ shouldUpdate: boolean, updatedSnapshot: Object|null }}
 */
export function updateBestOfferSnapshot(item, newOffer) {
  if (!newOffer || typeof newOffer.price !== 'number' || isNaN(newOffer.price)) {
    return { shouldUpdate: false, updatedSnapshot: null };
  }

  const currentSnapshot = parseOfferSnapshot(item?.offer_snapshot);

  const cleanNewSnapshot = {
    price: Number(newOffer.price),
    regular_price: Number(newOffer.regular_price || newOffer.price),
    supermarket: (newOffer.supermarket || newOffer.supermarket_name || 'Supermercado').trim(),
    deal_verdict: newOffer.deal_verdict || 'super_oferta',
    discount_percent: Number(newOffer.discount_percent || 0)
  };

  // 1. Se o item ainda não possui nenhum snapshot de oferta, a nova oferta é eleita a melhor
  if (!currentSnapshot || typeof currentSnapshot.price !== 'number') {
    return {
      shouldUpdate: true,
      updatedSnapshot: cleanNewSnapshot
    };
  }

  // 2. Competição de Preço ("Lowest Price Wins"):
  // Se a nova oferta for mais barata que a registrada anteriormente
  if (cleanNewSnapshot.price < currentSnapshot.price) {
    return {
      shouldUpdate: true,
      updatedSnapshot: cleanNewSnapshot
    };
  }

  // Se o preço for idêntico mas houver maior desconto percentual registrado
  if (cleanNewSnapshot.price === currentSnapshot.price && cleanNewSnapshot.discount_percent > (currentSnapshot.discount_percent || 0)) {
    return {
      shouldUpdate: true,
      updatedSnapshot: cleanNewSnapshot
    };
  }

  return {
    shouldUpdate: false,
    updatedSnapshot: currentSnapshot
  };
}
