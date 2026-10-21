import React from 'react';

export default function ThermometerSection() {
  return (
    <section className="nuThermometerSection" id="termometro">
      <div className="nuSectionContainer">
        <div className="nuSectionHeader">
          <span className="nuKickerPill">Critério & Honestidade</span>
          <h2 className="nuDisplayTitle">
            Termômetro de Ofertas.
            <br />
            Auditoria para evitar falsos descontos.
          </h2>
          <p className="nuDisplaySubtitle">
            Nem todo preço em destaque vermelho é uma promoção de verdade. O MercadoFácil audita o histórico para você comprar com segurança.
          </p>
        </div>

        <div className="nuThermometerGrid">
          {/* Coluna 1: As 3 Categorias */}
          <div className="nuThermoCardsCol">
            <div className="nuThermoLevelCard green">
              <div className="levelIcon">🟢</div>
              <div className="levelInfo">
                <h4>Oferta Real</h4>
                <p>O preço atual está nitidamente abaixo do valor médio praticado na sua cidade nos últimos 30 dias. É oportunidade de economia comprovada.</p>
              </div>
            </div>

            <div className="nuThermoLevelCard blue">
              <div className="levelIcon">🔵</div>
              <div className="levelInfo">
                <h4>Preço Normal</h4>
                <p>O valor cobrado está na faixa de mercado aceitável para o produto. Não é uma pechincha imperdível, mas é um preço justo para consumo.</p>
              </div>
            </div>

            <div className="nuThermoLevelCard amber">
              <div className="levelIcon">🟡</div>
              <div className="levelInfo">
                <h4>Preço Comum</h4>
                <p>Valor de prateleira tradicional sem desconto. Se você não estiver precisando do item com urgência, pode valer a pena esperar uma oferta futura.</p>
              </div>
            </div>
          </div>

          {/* Coluna 2: Amostra Real de Auditoria */}
          <div className="nuThermoSampleCard">
            <div className="sampleHeader">
              <span className="sampleKicker">Exemplo de Auditoria em Tempo Real</span>
              <span className="sampleBadgeLive">Olímpia - SP</span>
            </div>

            <div className="sampleProductTitle">Café Torrado e Moído 500g</div>

            <div className="sampleMetricsGrid">
              <div className="metricCard">
                <span className="metricKicker">Preço no Encarte</span>
                <span className="metricMainPrice green">R$ 16,99</span>
                <span className="metricStatusTag green">Oferta Ativa</span>
              </div>
              <div className="metricCard">
                <span className="metricKicker">Preço Habitual</span>
                <span className="metricMainPrice muted">R$ 22,90</span>
                <span className="metricStatusTag neutral">Média de Prateleira</span>
              </div>
              <div className="metricCard">
                <span className="metricKicker">Economia Estimada</span>
                <span className="metricMainPrice highlight">-25,8%</span>
                <span className="metricStatusTag green">R$ 5,91 a menos</span>
              </div>
            </div>

            <div className="sampleFooterNote">
              <span className="noteIcon">💡</span>
              <p>
                <strong>Interpretação do Termômetro:</strong> Como o valor de R$ 16,99 está consideravelmente abaixo do preço habitual de R$ 22,90, o sistema classifica este item como <strong>Oferta Real</strong>, recomendando a compra na cesta da semana.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
