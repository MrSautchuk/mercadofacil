import React from 'react';

export default function RetailerB2BSection({ onOpenPortal, onScrollToSection }) {
  return (
    <section className="nuB2bSection" id="supermercados">
      <div className="nuB2bContainer">
        {/* Header Corporativo B2B */}
        <div className="nuB2bHeader">
          <div className="nuB2bPill">
            <span className="nuB2bDot" />
            <span>MercadoFácil Business — B2B Retail</span>
          </div>

          <h2 className="nuB2bTitle">
            Transforme folhetos estáticos em vendas reais
            <br />
            para os clientes da sua região.
          </h2>

          <p className="nuB2bSubtitle">
            Conecte as promoções da sua loja diretamente aos celulares dos consumidores locais que já estão montando a lista de compras da semana.
          </p>
        </div>

        {/* Dashboard Showcase SaaS */}
        <div className="nuB2bShowcaseCard">
          <div className="nuB2bShowcaseTopBar">
            <div className="nuWindowDots">
              <span className="dot red"></span>
              <span className="dot yellow"></span>
              <span className="dot green"></span>
            </div>
            <span className="nuWindowTitle">portal.mercadofacil.com.br — Painel de Gestão de Ofertas</span>
            <div className="nuWindowStatus">
              <span className="statusDotLive"></span>
              <span>Online</span>
            </div>
          </div>

          <div className="nuB2bShowcaseBody">
            <div className="nuB2bMetricsRow">
              <div className="nuB2bMetricBox">
                <span className="metricLabel">Alcance Local</span>
                <strong className="metricValue">100%</strong>
                <span className="metricNote">Clientes no seu município</span>
              </div>
              <div className="nuB2bMetricBox">
                <span className="metricLabel">Comissão por Venda</span>
                <strong className="metricValue green">0%</strong>
                <span className="metricNote">Você fica com toda a receita</span>
              </div>
              <div className="nuB2bMetricBox">
                <span className="metricLabel">Tempo de Publicação</span>
                <strong className="metricValue">&lt; 1 min</strong>
                <span className="metricNote">Upload rápido de encartes</span>
              </div>
              <div className="nuB2bMetricBox">
                <span className="metricLabel">Descarte Reduzido</span>
                <strong className="metricValue">Saldão</strong>
                <span className="metricNote">Giro rápido de perecíveis</span>
              </div>
            </div>

            {/* 4 Recursos Estratégicos para Varejistas */}
            <div className="nuB2bFeaturesGrid">
              <div className="nuB2bFeatureCard">
                <div className="featureIconB2b">⚡</div>
                <h4>Ofertas Relâmpago</h4>
                <p>Crie promoções de 24 horas para dias de baixo movimento e impulsione o fluxo de caixa imediato no seu estabelecimento.</p>
              </div>

              <div className="nuB2bFeatureCard">
                <div className="featureIconB2b">⏳</div>
                <h4>Saldão de Validade Próxima</h4>
                <p>Divulgue carnes, laticínios e frios próximos ao vencimento com desconto especial, minimizando perdas com descarte.</p>
              </div>

              <div className="nuB2bFeatureCard">
                <div className="featureIconB2b">📑</div>
                <h4>Upload Direto de Encartes</h4>
                <p>Basta subir o PDF ou imagem do seu encarte semanal impresso. Nossa plataforma auxilia na distribuição para os consumidores.</p>
              </div>

              <div className="nuB2bFeatureCard">
                <div className="featureIconB2b">🎯</div>
                <h4>Hiperlocal & Transparente</h4>
                <p>Suas ofertas só aparecem para quem está no seu raio de atuação. Sem taxas escondidas e sem intermediários de pagamento.</p>
              </div>
            </div>
          </div>

          {/* Banner de Ação Comercial */}
          <div className="nuB2bBottomCta">
            <div className="nuB2bCtaText">
              <h3>Deseja homologar seu supermercado ou hortifruti?</h3>
              <p>Cadastre sua loja para participar do programa piloto regional ou acesse a simulação do portal agora mesmo.</p>
            </div>

            <div className="nuB2bCtaActions">
              <button 
                className="nuBtnB2bGhost" 
                onClick={onOpenPortal}
                id="btn-demonstracao-portal-b2b"
              >
                Demonstração do Portal
              </button>
              <button 
                className="nuBtnB2bPrimary" 
                onClick={() => onScrollToSection('cadastro')}
                id="btn-parceria-comercial-b2b"
              >
                Tenho Interesse em Ser Parceiro →
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
