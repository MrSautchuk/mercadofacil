import React, { useState } from 'react';

const CONSUMER_PLANS = [
  {
    id: 'free',
    name: 'Gratuito',
    badge: null,
    price: 'R$ 0',
    period: 'para sempre',
    description: 'Acesso completo a todas as funções essenciais para planejar suas compras diárias.',
    features: [
      'Criação de listas ilimitadas',
      'Consulta de encartes semanais',
      'Indicadores de preços e ofertas',
      'Exibição de anúncios discretos',
      'Modo offline no aparelho'
    ],
    actionText: 'Começar Grátis',
    actionStyle: 'outline',
    highlighted: false
  },
  {
    id: 'lifetime_no_ads',
    name: 'Sem Anúncios',
    badge: 'Compra Única Vitalícia',
    price: 'R$ 3,99',
    period: 'pagamento único',
    description: 'Remova todos os banners do aplicativo com um único pagamento. Não é mensalidade.',
    features: [
      'Tudo do plano Gratuito',
      'Zero anúncios e banners',
      'Restauração de compra nativa',
      'Navegação mais rápida e limpa',
      'Suporte a atualizações futuras'
    ],
    actionText: 'Comprar Sem Anúncios',
    actionStyle: 'primary',
    highlighted: true
  },
  {
    id: 'family_core',
    name: 'Core Familiar',
    badge: 'Assinatura Mensal',
    price: 'R$ 5,99',
    period: 'por mês',
    description: 'Sincronização em tempo real para toda a casa. 1 titular e até 2 celulares conectados.',
    features: [
      'Tudo do plano Sem Anúncios',
      'Até 3 aparelhos sincronizados (1 titular + 2 membros)',
      'Listas compartilhadas em tempo real',
      'Código de convite instantâneo de 6 dígitos',
      'Sem fidelidade: cancele quando quiser'
    ],
    actionText: 'Assinar Core Familiar',
    actionStyle: 'outline',
    highlighted: false
  }
];

const RETAIL_PLANS = [
  {
    id: 'pilot',
    name: 'Piloto Regional',
    badge: 'Vagas Limitadas',
    price: 'Grátis',
    period: 'no período piloto',
    description: 'Homologação e testes locais de encartes para supermercados de cidades selecionadas.',
    features: [
      'Upload de encartes semanais',
      'Até 5 ofertas extraordinárias/mês',
      'Exibição para usuários da cidade',
      'Acesso ao painel do lojista',
      'Suporte direto de homologação'
    ],
    actionText: 'Solicitar Acesso Piloto',
    actionStyle: 'outline',
    highlighted: false
  },
  {
    id: 'super_pro',
    name: 'Supermercado Pro',
    badge: 'Mais Recomendado',
    price: 'R$ 149',
    period: 'por mês',
    description: 'Plataforma completa para estabelecimentos locais que querem aumentar fluxo e vendas.',
    features: [
      'Encartes digitais ilimitados',
      'Ofertas relâmpago semanais',
      'Saldão de validade próxima',
      '0% de comissão sobre vendas',
      'Sem contrato de fidelidade'
    ],
    actionText: 'Quero Ser Parceiro Pro',
    actionStyle: 'primary',
    highlighted: true
  },
  {
    id: 'enterprise_network',
    name: 'Redes & Atacarejos',
    badge: 'Multi-Unidades',
    price: 'R$ 299',
    period: 'por mês',
    description: 'Solução sob medida para redes regionais com múltiplos pontos de venda e encartes setorizados.',
    features: [
      'Múltiplas lojas e filiais',
      'Segmentação por bairro/região',
      'Prioridade na exibição de encartes',
      'API de integração de ofertas',
      'Atendimento comercial dedicado'
    ],
    actionText: 'Falar com Consultor B2B',
    actionStyle: 'outline',
    highlighted: false
  }
];

export default function PricingTable({ onScrollToSection, onSelectPlan, defaultAudience = 'consumer' }) {
  const [audience, setAudience] = useState(defaultAudience); // 'consumer' | 'retail'

  React.useEffect(() => {
    if (defaultAudience) {
      setAudience(defaultAudience);
    }
  }, [defaultAudience]);

  const activePlans = audience === 'consumer' ? CONSUMER_PLANS : RETAIL_PLANS;

  const handleAction = (plan) => {
    if (audience === 'retail') {
      if (onSelectPlan) {
        onSelectPlan(plan);
      } else {
        onScrollToSection('cadastro');
      }
    } else {
      onScrollToSection('download');
    }
  };

  return (
    <section className="nuPricingSection" id="planos">
      <div className="nuSectionContainer">
        {/* Header da Seção */}
        <div className="nuSectionHeader">
          <span className="nuKickerPill">Planos & Transparência</span>
          <h2 className="nuDisplayTitle">
            Escolha o modelo ideal para
            <br />
            sua rotina ou seu negócio.
          </h2>
          <p className="nuDisplaySubtitle">
            Sem pegadinhas, sem taxas escondidas e com total clareza sobre cada modalidade.
          </p>

          {/* Alternador de Público (Estilo Nubank Pill Switch) */}
          <div className="nuPillSwitchContainer">
            <button
              className={`nuPillSwitchBtn ${audience === 'consumer' ? 'active' : ''}`}
              onClick={() => setAudience('consumer')}
            >
              Para Você & Família
            </button>
            <button
              className={`nuPillSwitchBtn ${audience === 'retail' ? 'active' : ''}`}
              onClick={() => setAudience('retail')}
            >
              Para Supermercados (B2B)
            </button>
          </div>
        </div>

        {/* Grade de Planos com Superfície Minimalista */}
        <div className="nuPricingGrid">
          {activePlans.map(plan => (
            <div 
              key={plan.id}
              className={`nuPricingCard ${plan.highlighted ? 'featured' : ''}`}
            >
              {plan.badge && (
                <div className="nuPlanBadgePill">
                  {plan.badge}
                </div>
              )}

              <div className="nuPlanHeader">
                <h3 className="nuPlanName">{plan.name}</h3>
                <p className="nuPlanDesc">{plan.description}</p>
              </div>

              <div className="nuPlanPriceBlock">
                <span className="nuPriceVal">{plan.price}</span>
                <span className="nuPricePeriod">/{plan.period}</span>
              </div>

              <div className="nuPlanDivider" />

              <ul className="nuPlanFeaturesList">
                {plan.features.map((feat, idx) => (
                  <li key={idx} className="nuPlanFeatureItem">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`nuBtnPlanAction ${plan.actionStyle === 'primary' ? 'primary' : 'secondary'}`}
                onClick={() => handleAction(plan)}
                id={`btn-plan-${plan.id}`}
              >
                {plan.actionText}
              </button>
            </div>
          ))}
        </div>

        {/* Nota de Esclarecimento sobre Valores */}
        <div className="nuPricingNoticeCard">
          <div className="nuNoticeIcon">ℹ️</div>
          <div className="nuNoticeText">
            <strong>Transparência Operacional:</strong> Os valores acima refletem a precificação do produto nas lojas de aplicativos (compra única de R$ 3,99 e assinatura de R$ 5,99) e os planos de homologação de supermercados parceiros. Não realizamos cobranças diretas por esta página web institucional.
          </div>
        </div>
      </div>
    </section>
  );
}
