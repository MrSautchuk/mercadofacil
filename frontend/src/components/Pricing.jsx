import React, { useState } from 'react';

const PLANS = [
  {
    id: 'essencial',
    name: 'Essencial Varejo',
    subtitle: 'Para mercearias, empórios e minimercados de 1 loja.',
    priceMonthly: 149,
    priceAnnual: 119,
    featured: false,
    features: [
      '1 Estabelecimento cadastrado',
      'Até 30 Ofertas Relâmpago por mês',
      '4 Encartes Digitais semanais',
      'Leitor inteligente de PDF e fotos',
      'Segmentação municipal básica',
      'Suporte padrão via e-mail'
    ],
    ctaText: 'Escolher Essencial',
    popular: false
  },
  {
    id: 'pro',
    name: 'Supermercado Pro',
    subtitle: 'Para supermercados que buscam alto giro e zero desperdício.',
    priceMonthly: 299,
    priceAnnual: 239,
    featured: true,
    features: [
      'Até 3 Lojas / Filiais na região',
      'Ofertas Relâmpago Ilimitadas',
      'Saldão de Validade com Destaque',
      'Encartes Digitais Ilimitados',
      'Auditoria de Preços com Selo IA',
      'Alerta Prioritário para Clientes',
      'Suporte VIP via WhatsApp dedicado'
    ],
    ctaText: 'Testar 14 Dias Grátis',
    popular: true
  },
  {
    id: 'enterprise',
    name: 'Redes & Atacarejos',
    subtitle: 'Para grandes varejistas com múltiplas filiais e alto volume.',
    priceMonthly: 599,
    priceAnnual: 479,
    featured: false,
    features: [
      'Lojas e Filiais Ilimitadas',
      'Tudo do Plano Pro incluído',
      'Importação Automática via Planilha/ERP',
      'Relatórios Semanais de Cesta de Consumo',
      'Destaque Máximo no Topo do Aplicativo',
      'Gerente de Contas Dedicado',
      'SLA de Atendimento em 2 Horas'
    ],
    ctaText: 'Falar com Consultor',
    popular: false
  }
];

export default function Pricing({ onSelectPlan, onScrollToSection }) {
  const [billingPeriod, setBillingPeriod] = useState('monthly'); // 'monthly' | 'annual'

  return (
    <section className="pricingSection" id="planos">
      <div className="container">
        <div className="sectionHeader">
          <span className="sectionPill">Planos & Investimento</span>
          <h2 className="sectionTitle">Planos Transparentes com Retorno Imediato</h2>
          <p className="sectionDesc">
            Sem pegadinhas, sem multas e sem taxas ocultas sobre suas vendas. Cancele quando quiser ou garanta 20% de desconto no plano anual.
          </p>
        </div>

        {/* Alternador Mensal / Anual */}
        <div className="pricingToggleContainer">
          <button
            type="button"
            className={`pricingToggleBtn ${billingPeriod === 'monthly' ? 'active' : ''}`}
            onClick={() => setBillingPeriod('monthly')}
          >
            Faturamento Mensal
          </button>
          <button
            type="button"
            className={`pricingToggleBtn ${billingPeriod === 'annual' ? 'active' : ''}`}
            onClick={() => setBillingPeriod('annual')}
          >
            Faturamento Anual
          </button>
          <span className="discountTag">20% OFF</span>
        </div>

        {/* Grid de Cards de Planos */}
        <div className="pricingGrid">
          {PLANS.map((plan) => {
            const price = billingPeriod === 'annual' ? plan.priceAnnual : plan.priceMonthly;

            return (
              <div 
                className={`planCard ${plan.featured ? 'featured' : ''}`} 
                key={plan.id}
              >
                {plan.popular && (
                  <div className="popularBadge">Mais Escolhido pelos Mercados</div>
                )}

                <div className="planHeader">
                  <h3 className="planName">{plan.name}</h3>
                  <p className="planSubtitle">{plan.subtitle}</p>
                </div>

                <div className="planPriceGroup">
                  <span className="currency">R$</span>
                  <span className="priceAmount">{price}</span>
                  <span className="period">/ mês</span>
                </div>

                <ul className="planFeaturesList">
                  {plan.features.map((item, idx) => (
                    <li className="planFeatureItem" key={idx}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  className={`btnChoosePlan ${plan.featured ? 'highlight' : 'standard'}`}
                  onClick={() => {
                    if (onSelectPlan) onSelectPlan(plan);
                    if (onScrollToSection) onScrollToSection('cadastro');
                  }}
                  id={`btn-plan-${plan.id}`}
                >
                  {plan.ctaText}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
