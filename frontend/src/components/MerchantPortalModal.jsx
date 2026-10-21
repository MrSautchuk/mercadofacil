import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:3001/api';

export default function MerchantPortalModal({ isOpen, onClose }) {
  const [offers, setOffers] = useState([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishFeedback, setPublishFeedback] = useState(null);

  // Campos da Nova Oferta
  const [offerForm, setOfferForm] = useState({
    product_name: '',
    regular_price: '',
    promo_price: '',
    category: 'mercearia',
    is_expiry_deal: false,
    valid_days: 3,
    city: 'Olímpia',
    uf: 'SP'
  });

  useEffect(() => {
    if (isOpen) {
      loadOffers();
    }
  }, [isOpen]);

  const loadOffers = async () => {
    setLoadingOffers(true);
    try {
      const res = await fetch(`${API_BASE}/retail/offers?city=${encodeURIComponent(offerForm.city)}&uf=${offerForm.uf}`);
      if (res.ok) {
        const data = await res.json();
        setOffers(data.data || []);
      }
    } catch (e) {
      console.warn('Erro ao carregar ofertas B2B:', e);
    } finally {
      setLoadingOffers(false);
    }
  };

  const handlePublishOffer = async (e) => {
    e.preventDefault();
    setPublishing(true);
    setPublishFeedback(null);

    const now = new Date();
    const until = new Date(now.getTime() + Number(offerForm.valid_days) * 24 * 60 * 60 * 1000);

    const payload = {
      store_id: 1,
      product_name: offerForm.product_name,
      regular_price: offerForm.regular_price ? Number(offerForm.regular_price) : null,
      promo_price: Number(offerForm.promo_price),
      valid_from: now.toISOString(),
      valid_until: until.toISOString(),
      category: offerForm.category,
      is_expiry_deal: offerForm.is_expiry_deal,
      city: offerForm.city,
      uf: offerForm.uf
    };

    try {
      const res = await fetch(`${API_BASE}/retail/offers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok) {
        setPublishFeedback({ type: 'success', message: 'Oferta enviada e sincronizada com a base do aplicativo da sua cidade!' });
        setOfferForm(prev => ({
          ...prev,
          product_name: '',
          regular_price: '',
          promo_price: '',
          is_expiry_deal: false
        }));
        loadOffers();
      } else {
        setPublishFeedback({ type: 'error', message: data.error || 'Falha ao validar oferta.' });
      }
    } catch (err) {
      setPublishFeedback({ type: 'error', message: 'Falha na conexão com o servidor de demonstração: ' + err.message });
    } finally {
      setPublishing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modalBackdrop" onClick={onClose}>
      <div className="modalDialogLight" onClick={(e) => e.stopPropagation()}>
        <div className="modalHeaderLight">
          <div className="modalHeaderTitleLight">
            <span className="modalTitleIcon">🏪</span>
            <div>
              <h3 className="modalMainHeading">Portal do Lojista — Demonstração Operacional</h3>
              <p className="modalSubHeading">Painel simulado de publicação de ofertas para supermercados parceiros</p>
            </div>
          </div>
          <button className="modalCloseBtnLight" onClick={onClose} title="Fechar modal" id="btn-close-modal">
            ✕
          </button>
        </div>

        <div className="modalBodyLight">
          {/* Formulário de Publicação Rápida */}
          <div className="modalSectionCard">
            <h4 className="modalSectionTitle">
              <span>⚡</span> Publicar Nova Oferta Extraordinária no Aplicativo
            </h4>

            {publishFeedback && (
              <div className={`modalFeedbackBox ${publishFeedback.type}`}>
                {publishFeedback.message}
              </div>
            )}

            <form onSubmit={handlePublishOffer} className="modalFormGrid">
              <div className="formFieldItem fullSpan">
                <label>Produto com Marca e Gramatura *</label>
                <input
                  type="text"
                  className="formInputLight"
                  placeholder="Ex: Café Torrado e Moído Pilão 500g"
                  required
                  value={offerForm.product_name}
                  onChange={(e) => setOfferForm({ ...offerForm, product_name: e.target.value })}
                />
              </div>

              <div className="formFieldItem">
                <label>Preço Regular Habitual (De R$)</label>
                <input
                  type="number"
                  step="0.01"
                  className="formInputLight"
                  placeholder="Ex: 22.90"
                  value={offerForm.regular_price}
                  onChange={(e) => setOfferForm({ ...offerForm, regular_price: e.target.value })}
                />
              </div>

              <div className="formFieldItem">
                <label>Preço Promocional (Por R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  className="formInputLight"
                  placeholder="Ex: 16.99"
                  required
                  value={offerForm.promo_price}
                  onChange={(e) => setOfferForm({ ...offerForm, promo_price: e.target.value })}
                />
              </div>

              <div className="formFieldItem">
                <label>Duração da Oferta</label>
                <select
                  className="formSelectLight"
                  value={offerForm.valid_days}
                  onChange={(e) => setOfferForm({ ...offerForm, valid_days: e.target.value })}
                >
                  <option value="1">24 Horas (Oferta Relâmpago)</option>
                  <option value="3">3 Dias (Fim de Semana)</option>
                  <option value="7">7 Dias (Semana Toda)</option>
                </select>
              </div>

              <div className="formFieldItem">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '1.6rem' }}>
                  <input
                    type="checkbox"
                    checked={offerForm.is_expiry_deal}
                    onChange={(e) => setOfferForm({ ...offerForm, is_expiry_deal: e.target.checked })}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--brand-green)' }}
                  />
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    É Saldão de Validade Próxima
                  </span>
                </label>
              </div>

              <div className="formFieldItem fullSpan">
                <button
                  type="submit"
                  className="btnSubmitForm"
                  disabled={publishing}
                  id="btn-publicar-oferta-modal"
                >
                  {publishing ? 'Validando & Publicando...' : 'Publicar Oferta para Consumidores da Região'}
                </button>
              </div>
            </form>
          </div>

          {/* Lista de Ofertas Ativas */}
          <div className="modalSectionCard">
            <div className="modalOffersHeader">
              <h4 className="modalSectionTitle" style={{ margin: 0 }}>
                Ofertas Ativas na Praça ({offerForm.city} - {offerForm.uf}): {offers.length}
              </h4>
              <button className="btnRefreshOffers" onClick={loadOffers}>
                Atualizar Lista
              </button>
            </div>

            {loadingOffers ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '1rem 0' }}>Carregando dados da praça...</p>
            ) : offers.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '1rem 0' }}>
                Nenhuma oferta ativa cadastrada ainda para esta praça no backend de demonstração. Use o formulário acima para publicar a primeira.
              </p>
            ) : (
              <div className="modalTableContainer">
                <table className="modalTable">
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Preço Habitual</th>
                      <th>Preço Oferta</th>
                      <th>Tipo</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offers.map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.product_name}</td>
                        <td style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>
                          {item.regular_price ? `R$ ${item.regular_price.toFixed(2)}` : '-'}
                        </td>
                        <td style={{ color: 'var(--brand-green)', fontWeight: 800 }}>
                          R$ {item.promo_price.toFixed(2)}
                        </td>
                        <td>
                          {item.is_expiry_deal ? (
                            <span className="statusBadge expiry">⏳ Saldão</span>
                          ) : (
                            <span className="statusBadge promo">⚡ Oferta</span>
                          )}
                        </td>
                        <td>
                          <span className="statusBadge active">● No App</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
