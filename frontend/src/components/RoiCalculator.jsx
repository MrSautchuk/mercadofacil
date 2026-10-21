import React, { useState } from 'react';

export default function RoiCalculator({ onScrollToSection }) {
  const [storeSize, setStoreSize] = useState('supermercado'); // 'mercearia' | 'supermercado' | 'rede'
  const [monthlyPaperSpend, setMonthlyPaperSpend] = useState(2500);
  const [cityPopulation, setCityPopulation] = useState(80000);

  // Cálculos dinâmicos
  const annualPaperSpend = monthlyPaperSpend * 12;
  const annualSavings = Math.round(annualPaperSpend * 0.75); // 75% de corte no gasto de gráfica
  
  // Estimativa de famílias impactadas baseada na população e porte
  const multiplier = storeSize === 'mercearia' ? 0.04 : storeSize === 'supermercado' ? 0.09 : 0.16;
  const estimatedFamilies = Math.round(cityPopulation * multiplier);

  // Estimativa de recuperação de perdas de estoque (saldão)
  const estimatedLossRecovery = storeSize === 'mercearia' ? 1200 : storeSize === 'supermercado' ? 3800 : 9500;

  return (
    <section className="roiSection" id="roi">
      <div className="container">
        <div className="sectionHeader">
          <span className="sectionPill">Simulador de Retorno</span>
          <h2 className="sectionTitle">Calcule a Economia e o Alcance na Sua Cidade</h2>
          <p className="sectionDesc">
            Veja em tempo real quanto seu supermercado deixa de gastar com papel inútil e quantas famílias ativas passam a receber suas ofertas no celular.
          </p>
        </div>

        <div className="roiCardContainer">
          {/* Controles da Calculadora */}
          <div className="roiInputsGroup">
            <div className="roiInputBlock">
              <label>Porte do Estabelecimento</label>
              <div className="storeSizePills">
                <button
                  type="button"
                  className={`sizePill ${storeSize === 'mercearia' ? 'active' : ''}`}
                  onClick={() => {
                    setStoreSize('mercearia');
                    setMonthlyPaperSpend(800);
                  }}
                >
                  Mercearia / Empório
                </button>
                <button
                  type="button"
                  className={`sizePill ${storeSize === 'supermercado' ? 'active' : ''}`}
                  onClick={() => {
                    setStoreSize('supermercado');
                    setMonthlyPaperSpend(2500);
                  }}
                >
                  Supermercado (1 a 3 lojas)
                </button>
                <button
                  type="button"
                  className={`sizePill ${storeSize === 'rede' ? 'active' : ''}`}
                  onClick={() => {
                    setStoreSize('rede');
                    setMonthlyPaperSpend(6000);
                  }}
                >
                  Rede / Atacarejo
                </button>
              </div>
            </div>

            <div className="roiInputBlock">
              <label>
                <span>Gasto Mensal com Panfletos & Gráfica:</span>
                <span className="valHighlight">R$ {monthlyPaperSpend.toLocaleString('pt-BR')}</span>
              </label>
              <input
                type="range"
                className="rangeSlider"
                min="300"
                max="12000"
                step="100"
                value={monthlyPaperSpend}
                onChange={(e) => setMonthlyPaperSpend(Number(e.target.value))}
              />
            </div>

            <div className="roiInputBlock">
              <label>
                <span>Habitantes da Cidade / Região:</span>
                <span className="valHighlight">{cityPopulation.toLocaleString('pt-BR')} hab.</span>
              </label>
              <input
                type="range"
                className="rangeSlider"
                min="10000"
                max="500000"
                step="5000"
                value={cityPopulation}
                onChange={(e) => setCityPopulation(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Painel de Resultados */}
          <div className="roiResultsPanel">
            <div className="roiResultBlock">
              <span className="roiResultLabel">Economia Direta em Papel (Anual)</span>
              <div className="roiResultValue lime">
                R$ {annualSavings.toLocaleString('pt-BR')}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                Valor que deixará de ser queimado em impressões descartadas.
              </p>
            </div>

            <div className="roiResultBlock">
              <span className="roiResultLabel">Famílias Impactadas no Momento de Compra</span>
              <div className="roiResultValue emerald">
                ~{estimatedFamilies.toLocaleString('pt-BR')} famílias
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                Usuários ativos adicionando produtos à cesta na sua região.
              </p>
            </div>

            <div className="roiResultBlock" style={{ border: 'none', paddingBottom: 0 }}>
              <span className="roiResultLabel">Perdas Evitadas com Saldão de Validade / Mês</span>
              <div className="roiResultValue" style={{ color: '#fbbf24' }}>
                + R$ {estimatedLossRecovery.toLocaleString('pt-BR')}
              </div>
            </div>

            <div className="roiCtaBox">
              <button 
                className="btnPrimaryCta"
                style={{ width: '100%', justifyContent: 'center', height: '48px' }}
                onClick={() => onScrollToSection('cadastro')}
                id="btn-roi-aplicar"
              >
                Garantir Esses Resultados na Minha Loja
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
