import React from 'react';

export default function HeroB2B({ onScrollToSection, onOpenPortal }) {
  return (
    <section className="nuHeroSection nuHeroSectionB2B" id="hero-b2b">
      {/* Luz ambiente suave corporativa */}
      <div className="nuHeroAmbientGlow" />

      <div className="nuHeroContainer">
        <div className="nuHeroEditorial">
          <div className="nuPillBadge b2bBadge">
            <span className="nuPillDot greenPulse" />
            <span>MercadoFácil Business — Portal do Lojista</span>
          </div>

          <h1 className="nuHeroTitle">
            Transforme folhetos impressos
            <br />
            <span className="nuHeroTitleHighlight">em vendas reais na sua cidade.</span>
          </h1>

          <p className="nuHeroSubtitle">
            Conecte suas ofertas semanais e itens perecíveis diretamente aos celulares dos clientes locais que estão montando a lista de compras agora mesmo. Com <strong>0% de comissão</strong> sobre suas vendas.
          </p>

          <div className="nuHeroCtaRow">
            <button 
              className="nuBtnHeroPrimary"
              onClick={onOpenPortal}
              id="hero-b2b-btn-portal"
            >
              <span>Acessar Demonstração do Portal</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"></path>
                <path d="m12 5 7 7-7 7"></path>
              </svg>
            </button>

            <button 
              className="nuBtnHeroSecondary"
              onClick={() => onScrollToSection('cadastro')}
              id="hero-b2b-btn-cadastrar"
            >
              Homologar Minha Loja
            </button>
          </div>

          <div className="nuHeroTrustStrip">
            <div className="nuTrustItem">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>0% de Comissão sobre Vendas Físicas</span>
            </div>
            <div className="nuTrustItem">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Upload Rápido de Encartes e Folhetos</span>
            </div>
            <div className="nuTrustItem">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Saldão de Perecíveis e Ofertas 24h</span>
            </div>
          </div>
        </div>

        {/* Mockup do Dashboard B2B com Métricas em Destaque */}
        <div className="nuHeroDeviceStage b2bStage">
          <div className="nuFloatingChip chipLeft">
            <div className="chipIconBadge green">
              <span>⚡</span>
            </div>
            <div className="chipText">
              <span className="chipLabel">Oferta Relâmpago</span>
              <span className="chipValue">Publicação instantânea</span>
            </div>
          </div>

          <div className="nuFloatingChip chipRight">
            <div className="chipIconBadge blue">
              <span>🎯</span>
            </div>
            <div className="chipText">
              <span className="chipLabel">Alcance Local</span>
              <span className="chipValue">100% no seu município</span>
            </div>
          </div>

          <div className="b2bHeroPreviewCard">
            <div className="b2bPreviewHeader">
              <div className="nuWindowDots">
                <span className="dot red"></span>
                <span className="dot yellow"></span>
                <span className="dot green"></span>
              </div>
              <span className="b2bPreviewTitle">Painel de Gestão do Lojista</span>
              <span className="b2bPreviewLive">● Ao Vivo</span>
            </div>

            <div className="b2bPreviewContent">
              <div className="b2bKpiGrid">
                <div className="b2bKpiCard">
                  <span className="kpiLabel">Alcance Estimado</span>
                  <strong className="kpiNum">12.450</strong>
                  <span className="kpiSub">consumidores ativos</span>
                </div>
                <div className="b2bKpiCard">
                  <span className="kpiLabel">Economia com Gráfica</span>
                  <strong className="kpiNum green">-75%</strong>
                  <span className="kpiSub">em folhetos impressos</span>
                </div>
                <div className="b2bKpiCard">
                  <span className="kpiLabel">Giro de Perecíveis</span>
                  <strong className="kpiNum">3x mais</strong>
                  <span className="kpiSub">itens de validade próxima</span>
                </div>
              </div>

              <div className="b2bPreviewUploadBox">
                <div className="uploadBoxIcon">📑</div>
                <div className="uploadBoxText">
                  <strong>Arraste seu folheto PDF ou imagem promocional</strong>
                  <span>Nossa IA processa preços e categorias automaticamente</span>
                </div>
                <button className="uploadBoxBtn" onClick={onOpenPortal}>Testar no Painel</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
