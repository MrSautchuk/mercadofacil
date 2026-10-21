import React, { useState } from 'react';

export default function MockupPhone() {
  const [activeTab, setActiveTab] = useState('cesta');
  const [checkedItems, setCheckedItems] = useState({ 1: true, 2: true });

  const toggleCheck = (id) => {
    setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="phoneFrame">
      {/* Notch & Top Bar do Celular */}
      <div className="phoneSpeakerBar">
        <div className="phoneSpeaker"></div>
        <div className="phoneCamera"></div>
      </div>

      <div className="phoneScreen">
        {/* Top Header do Aplicativo Real */}
        <div className="appTopBar">
          <div className="appLocationBadge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <span>Olímpia | SP</span>
          </div>
          <div className="appThemeBadge">
            <span>🌙 Escuro</span>
          </div>
        </div>

        {/* Título e Faixa do Termômetro Real */}
        <div className="appHeaderArea">
          <h4 className="appTitle">Minha Lista</h4>
          <div className="appIndicatorsRow">
            <div className="appIndicatorPill green">
              <span className="dotIcon">✓</span>
              <span><strong>4</strong> Ofertas</span>
            </div>
            <div className="appIndicatorPill yellow">
              <span className="dotIcon">⏱</span>
              <span><strong>1</strong> Normal</span>
            </div>
            <div className="appIndicatorPill red">
              <span className="dotIcon">✕</span>
              <span><strong>0</strong> Comum</span>
            </div>
          </div>
        </div>

        {/* Navegação de Abas do App */}
        <div className="appTabsRow">
          <button 
            className={`appTabBtn ${activeTab === 'cesta' ? 'active' : ''}`}
            onClick={() => setActiveTab('cesta')}
            type="button"
          >
            🛒 Minha Lista (4)
          </button>
          <button 
            className={`appTabBtn ${activeTab === 'encartes' ? 'active' : ''}`}
            onClick={() => setActiveTab('encartes')}
            type="button"
          >
            📰 Encartes (1 🔥)
          </button>
          <button 
            className={`appTabBtn ${activeTab === 'config' ? 'active' : ''}`}
            onClick={() => setActiveTab('config')}
            type="button"
          >
            ⚙️ Ajustes
          </button>
        </div>

        {/* Conteúdo da Cesta com Itens Reais */}
        {activeTab === 'cesta' && (
          <div className="appItemsList">
            {/* Item 1 */}
            <div className={`appItemCard ${checkedItems[1] ? 'completed' : ''}`}>
              <div className="appItemLeft">
                <button 
                  className={`appCheckbox ${checkedItems[1] ? 'checked' : ''}`}
                  onClick={() => toggleCheck(1)}
                  type="button"
                >
                  {checkedItems[1] ? '✓' : ''}
                </button>
                <div>
                  <div className="appItemName">Arroz Tio João Tipo 1 (5kg)</div>
                  <div className="appItemPriceRow">
                    <span className="appItemPrice">R$ 23,90</span>
                    <span className="appItemOldPrice">R$ 28,90</span>
                    <span className="appTagOffer">Encarte Tome Leve</span>
                  </div>
                </div>
              </div>
              <span className="appBadgeSavings">-17%</span>
            </div>

            {/* Item 2 */}
            <div className={`appItemCard ${checkedItems[2] ? 'completed' : ''}`}>
              <div className="appItemLeft">
                <button 
                  className={`appCheckbox ${checkedItems[2] ? 'checked' : ''}`}
                  onClick={() => toggleCheck(2)}
                  type="button"
                >
                  {checkedItems[2] ? '✓' : ''}
                </button>
                <div>
                  <div className="appItemName">Leite Integral Piracanjuba 1L</div>
                  <div className="appItemPriceRow">
                    <span className="appItemPrice">R$ 3,99</span>
                    <span className="appItemOldPrice">R$ 4,89</span>
                    <span className="appTagOffer">Encarte Tome Leve</span>
                  </div>
                </div>
              </div>
              <span className="appBadgeSavings">-18%</span>
            </div>

            {/* Item 3 */}
            <div className={`appItemCard ${checkedItems[3] ? 'completed' : ''}`}>
              <div className="appItemLeft">
                <button 
                  className={`appCheckbox ${checkedItems[3] ? 'checked' : ''}`}
                  onClick={() => toggleCheck(3)}
                  type="button"
                >
                  {checkedItems[3] ? '✓' : ''}
                </button>
                <div>
                  <div className="appItemName">Café Pilão Tradicional 500g</div>
                  <div className="appItemPriceRow">
                    <span className="appItemPrice">R$ 18,50</span>
                    <span className="appTagNormal">Preço Médio da Cidade</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Item 4 */}
            <div className={`appItemCard ${checkedItems[4] ? 'completed' : ''}`}>
              <div className="appItemLeft">
                <button 
                  className={`appCheckbox ${checkedItems[4] ? 'checked' : ''}`}
                  onClick={() => toggleCheck(4)}
                  type="button"
                >
                  {checkedItems[4] ? '✓' : ''}
                </button>
                <div>
                  <div className="appItemName">Sabão em Pó Omo Lavagem Perfeita 1.6kg</div>
                  <div className="appItemPriceRow">
                    <span className="appItemPrice">R$ 17,90</span>
                    <span className="appItemOldPrice">R$ 21,90</span>
                    <span className="appTagOffer">Encarte Tome Leve</span>
                  </div>
                </div>
              </div>
              <span className="appBadgeSavings">-18%</span>
            </div>
          </div>
        )}

        {activeTab === 'encartes' && (
          <div className="appEncartesPreview">
            <div className="appFlyerHeader">
              <span className="appFlyerTitle">Encarte Semanal Tome Leve</span>
              <span className="appFlyerBadge">13 Ofertas Ativas</span>
            </div>
            <p className="appFlyerDesc">
              Folheto oficial processado por IA. Os preços foram validados com o mercado de Olímpia - SP.
            </p>
            <div className="appFlyerActions">
              <div className="appFlyerBtn">📄 Ver PDF Completo</div>
              <div className="appFlyerBtn lime">➕ Cruzar com Lista</div>
            </div>
          </div>
        )}

        {activeTab === 'config' && (
          <div className="appConfigPreview">
            <div className="appConfigCard">
              <span className="appConfigLabel">Plano Ativo:</span>
              <span className="appConfigVal green">● Core Familiar (3 Aparelhos)</span>
            </div>
            <div className="appConfigCard">
              <span className="appConfigLabel">IA de Preços:</span>
              <span className="appConfigVal">Gemini 2.5 Conectada</span>
            </div>
          </div>
        )}

        {/* Rodapé do App com Resumo de Economia Real */}
        <div className="appFooterSummary">
          <div>
            <div className="appSummaryLabel">Total da Lista:</div>
            <div className="appSummaryTotal">R$ 64,29</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="appSummaryLabel">Economia Auditada:</div>
            <div className="appSummarySaved">Economia de R$ 13,80</div>
          </div>
        </div>
      </div>
    </div>
  );
}
