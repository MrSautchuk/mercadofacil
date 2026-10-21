import React, { useState } from 'react';

const REAL_SCREENS = [
  {
    id: 'cesta',
    name: 'Minha Lista & Itens',
    title: 'Organização Real da Lista com Localização Piloto',
    subtitle: 'Captura autêntica do aplicativo em execução: lista de compras categorizada com seleção de cidade ativa em Olímpia | SP e cálculo de totais.',
    features: [
      'Indicadores claros de status: Ofertas, Normal e Comum',
      'Seleção de cidade calibrada por estado (UF)',
      'Organização automática por categorias de mercado',
      'Cálculo e conferência com soma instantânea'
    ],
    imageSrc: '/app-screens/media_1791731688877.jpg',
    imageCaption: 'Tela real do app MercadoFácil: Minha Lista de compras com calibração em Olímpia - SP'
  },
  {
    id: 'encartes',
    name: 'Encartes Digitais',
    title: 'Visualizador e Envio de Encartes Promocionais',
    subtitle: 'Interface real da aba Encartes, permitindo upload e leitura de folhetos em PDF/JPG para extração de ofertas.',
    features: [
      'Folhetos digitalizados com zoom e leitura otimizada',
      'Identificação rápida das promoções vigentes da semana',
      'Opção para importação de ofertas com um único clique',
      'Histórico de encartes recentes dos supermercados locais'
    ],
    imageSrc: '/app-screens/media_1791688725012.png',
    imageCaption: 'Tela real do app MercadoFácil: Visualizador de encartes promocionais digitalizados'
  },
  {
    id: 'comparacao',
    name: 'Auditoria de Carrinhos',
    title: 'Auditoria Comparativa entre Estabelecimentos',
    subtitle: 'Comparação de carrinhos com cálculo do termômetro de preços para identificar qual loja oferece a maior economia real.',
    features: [
      'Cálculo comparativo baseado na lista completa de itens',
      'Diferenciação clara entre preço habitual e preço promocional',
      'Demonstração transparente da diferença percentual',
      'Total estimado por supermercado na praça'
    ],
    imageSrc: '/app-screens/media_1791694671625.png',
    imageCaption: 'Tela real do app MercadoFácil: Auditoria comparativa entre estabelecimentos'
  }
];

export default function RealAppShowcase() {
  const [activeTab, setActiveTab] = useState('cesta');
  const currentScreen = REAL_SCREENS.find(s => s.id === activeTab) || REAL_SCREENS[0];

  return (
    <section className="nuShowcaseSection" id="interface-real">
      <div className="nuSectionContainer">
        <div className="nuSectionHeader">
          <span className="nuKickerPill">Produto Real & Autêntico</span>
          <h2 className="nuDisplayTitle">
            Sem mockups genéricos.
            <br />
            Esta é a interface real do aplicativo.
          </h2>
          <p className="nuDisplaySubtitle">
            Veja como o aplicativo funciona no dia a dia, com telas autênticas do produto em funcionamento.
          </p>

          {/* Abas Pill Estilo Nubank */}
          <div className="nuPillTabsRow">
            {REAL_SCREENS.map(screen => (
              <button
                key={screen.id}
                className={`nuPillTabBtn ${activeTab === screen.id ? 'active' : ''}`}
                onClick={() => setActiveTab(screen.id)}
                id={`tab-screen-${screen.id}`}
              >
                {screen.name}
              </button>
            ))}
          </div>
        </div>

        {/* Palco de Exibição do Produto */}
        <div className="nuShowcaseStage">
          <div className="nuShowcaseDetails">
            <span className="nuShowcaseKicker">Interface Nativa</span>
            <h3 className="nuShowcaseMainTitle">{currentScreen.title}</h3>
            <p className="nuShowcaseDescription">{currentScreen.subtitle}</p>

            <ul className="nuShowcaseBullets">
              {currentScreen.features.map((feat, idx) => (
                <li key={idx} className="nuShowcaseBulletItem">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="nuShowcaseDeviceWrapper">
            <div className="nuDeviceFrameSleek">
              <img 
                src={currentScreen.imageSrc} 
                alt={currentScreen.title} 
                className="nuRealAppImg"
                loading="lazy"
              />
            </div>
            <p className="nuDeviceCaption">{currentScreen.imageCaption}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
