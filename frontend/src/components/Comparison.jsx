import React from 'react';

export default function Comparison() {
  return (
    <section className="comparisonSection" id="comparativo">
      <div className="container">
        <div className="sectionHeader">
          <span className="sectionPill">O Fim do Desperdício</span>
          <h2 className="sectionTitle">Por Que Supermercados Estão Abandonando o Papel?</h2>
          <p className="sectionDesc">
            A forma tradicional de panfletagem é cara, lenta e não permite mensurar resultados. Veja a comparação direta entre o encarte físico e a plataforma MercadoFácil Business.
          </p>
        </div>

        <div className="comparisonGrid">
          {/* Card: Modelo Tradicional (Papel) */}
          <div className="comparisonCard oldWay">
            <div className="comparisonHeader">
              <span className="comparisonTitle">❌ Encarte Tradicional de Papel</span>
              <span style={{ fontSize: '0.85rem', color: '#f87171', fontWeight: '800' }}>Alto Custo & Baixo Retorno</span>
            </div>
            <ul className="comparisonItemsList">
              <li className="comparisonItem">
                <span className="itemIconBad">✕</span>
                <div>
                  <strong>Custo Gráfico Recorrente:</strong> Média de R$ 2.000 a R$ 6.000 por mês em impressões e entregadores que jogam panfletos em caixas de correio cheias.
                </div>
              </li>
              <li className="comparisonItem">
                <span className="itemIconBad">✕</span>
                <div>
                  <strong>Lentidão Inaceitável:</strong> Entre a diagramação, impressão e entrega passam-se 3 a 4 dias. Impossível anunciar ofertas relâmpago.
                </div>
              </li>
              <li className="comparisonItem">
                <span className="itemIconBad">✕</span>
                <div>
                  <strong>Perda de Perecíveis:</strong> Quando o queijo ou a carne entram em data crítica de validade, não há tempo hábil para rodar um panfleto.
                </div>
              </li>
              <li className="comparisonItem">
                <span className="itemIconBad">✕</span>
                <div>
                  <strong>Zero Métricas e Rastreabilidade:</strong> Você nunca sabe quantas pessoas leram ou se o cliente foi à loja por causa do panfleto.
                </div>
              </li>
            </ul>
          </div>

          {/* Card: MercadoFácil Business */}
          <div className="comparisonCard newWay">
            <div className="comparisonHeader">
              <span className="comparisonTitle">✨ MercadoFácil Business</span>
              <span style={{ fontSize: '0.85rem', color: '#34d399', fontWeight: '800' }}>Digital, Rápido & Mensurável</span>
            </div>
            <ul className="comparisonItemsList">
              <li className="comparisonItem">
                <span className="itemIconGood">✓</span>
                <div>
                  <strong>Investimento Fixo Acessível:</strong> A partir de R$ 149/mês para publicar encartes e saldões sem limites e com retorno garantido.
                </div>
              </li>
              <li className="comparisonItem">
                <span className="itemIconGood">✓</span>
                <div>
                  <strong>No Ar em 3 Minutos:</strong> Suba seu encarte em PDF ou cadastre uma promoção no portal web e os clientes da cidade já visualizam instantaneamente.
                </div>
              </li>
              <li className="comparisonItem">
                <span className="itemIconGood">✓</span>
                <div>
                  <strong>Saldão de Validade Inteligente:</strong> Crie liquidações de 24h para hortifrúti e laticínios, transformando perdas de estoque em receita imediata.
                </div>
              </li>
              <li className="comparisonItem">
                <span className="itemIconGood">✓</span>
                <div>
                  <strong>Presença no Momento da Compra:</strong> O cliente adiciona sua oferta com 1 clique diretamente na lista de compras do celular da família.
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
