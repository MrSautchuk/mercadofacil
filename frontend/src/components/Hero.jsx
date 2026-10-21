import React from 'react';
import MockupPhone from './MockupPhone';

export default function Hero({ onScrollToSection, onOpenPortal }) {
  return (
    <section className="nuHeroSection" id="hero">
      {/* Luz ambiente suave de fundo */}
      <div className="nuHeroAmbientGlow" />

      <div className="nuHeroContainer">
        {/* Bloco Editorial Centralizado */}
        <div className="nuHeroEditorial">
          <div className="nuPillBadge">
            <span className="nuPillDot" />
            <span>Tecnologia Útil para o Dia a Dia</span>
          </div>

          <h1 className="nuHeroTitle">
            Suas compras sob controle real.
            <br />
            <span className="nuHeroTitleHighlight">Do encarte à cesta.</span>
          </h1>

          <p className="nuHeroSubtitle">
            Organize sua lista, consulte os encartes semanais da sua região e compare referências de preços para fazer escolhas mais econômicas. Sem promessas mágicas, com transparência de verdade.
          </p>

          <div className="nuHeroCtaRow">
            <button 
              className="nuBtnHeroPrimary"
              onClick={() => onScrollToSection('recursos')}
              id="hero-btn-conhecer"
            >
              <span>Conhecer o Aplicativo</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"></path>
                <path d="m12 5 7 7-7 7"></path>
              </svg>
            </button>

            <button 
              className="nuBtnHeroSecondary"
              onClick={() => onScrollToSection('como-funciona')}
              id="hero-btn-como-funciona"
            >
              Como Funciona
            </button>
          </div>

          <div className="nuHeroTrustStrip">
            <div className="nuTrustItem">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Calibração Piloto em Olímpia - SP</span>
            </div>
            <div className="nuTrustItem">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Indicadores Claros de Preço</span>
            </div>
            <div className="nuTrustItem">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>100% Gratuito com Opção Sem Anúncios</span>
            </div>
          </div>
        </div>

        {/* Mockup do Produto Emergindo com Profundidade */}
        <div className="nuHeroDeviceStage">
          {/* Card Flutuante Esquerdo: Oferta no Encarte */}
          <div className="nuFloatingChip chipLeft">
            <div className="chipIconBadge green">
              <span>🏷️</span>
            </div>
            <div className="chipText">
              <span className="chipLabel">Encarte Semanal</span>
              <span className="chipValue">Arroz 5kg com -22%</span>
            </div>
          </div>

          {/* Card Flutuante Direito: Auditoria do Termômetro */}
          <div className="nuFloatingChip chipRight">
            <div className="chipIconBadge blue">
              <span>🌡️</span>
            </div>
            <div className="chipText">
              <span className="chipLabel">Termômetro de Oferta</span>
              <span className="chipValue">Preço abaixo da média local</span>
            </div>
          </div>

          {/* Smartphone com Transição Suave */}
          <div className="nuDeviceElevation">
            <MockupPhone />
          </div>

          {/* Gradiente de Fusão com a Próxima Seção */}
          <div className="nuDeviceFadeOut" />
        </div>
      </div>
    </section>
  );
}
