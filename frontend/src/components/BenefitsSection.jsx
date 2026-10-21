import React, { useState } from 'react';

export default function BenefitsSection({ onScrollToSection }) {
  const [basketItems, setBasketItems] = useState([
    { id: 1, name: 'Arroz Tio João 5kg', price: 23.90, status: 'oferta', store: 'Mercado Estrela' },
    { id: 2, name: 'Feijão Carioca 1kg', price: 7.49, status: 'normal', store: 'Supermercado Central' },
    { id: 3, name: 'Óleo de Soja 900ml', price: 6.89, status: 'comum', store: 'Hipermercado Silva' },
  ]);

  const [activeThermometerIndex, setActiveThermometerIndex] = useState(0);

  const thermometerLevels = [
    { label: 'Oferta Real', desc: 'Preço comprovadamente abaixo da média local recente.', color: 'green', tag: 'Economia Forte' },
    { label: 'Preço Normal', desc: 'Valor alinhado com o padrão de mercado sem desconto especial.', color: 'blue', tag: 'Preço Justo' },
    { label: 'Preço Comum', desc: 'Preço de prateleira sem promoção aparente no momento.', color: 'amber', tag: 'Sem Desconto' },
  ];

  return (
    <section className="nuBentoSection" id="recursos">
      <div className="nuSectionContainer">
        {/* Cabeçalho da Seção */}
        <div className="nuSectionHeader">
          <span className="nuKickerPill">Recursos Pensados para Você</span>
          <h2 className="nuDisplayTitle">
            Tudo o que você precisa para
            <br />
            economizar sem complicação.
          </h2>
          <p className="nuDisplaySubtitle">
            Ferramentas práticas criadas para eliminar a adivinhação na hora de fazer a feira e o supermercado do mês.
          </p>
        </div>

        {/* Bento Grid Assimétrico Estilo Nubank/Apple */}
        <div className="nuBentoGrid">
          {/* Card 1 (Grande, 2 Colunas): Cesta de Compras com Micro-UI Interativa */}
          <div className="nuBentoCard cardSpan2 cardBasket">
            <div className="bentoCardHeader">
              <span className="bentoBadge">Organização Prática</span>
              <h3 className="bentoTitle">Cesta de compras inteligente com cálculo em tempo real</h3>
              <p className="bentoDescription">
                Adicione itens pelo nome ou direto dos encartes. O aplicativo organiza suas compras por categorias e calcula o total estimado para você nunca estourar o orçamento no caixa.
              </p>
            </div>

            {/* Micro-UI Interativa da Cesta */}
            <div className="bentoMicroUiBasket">
              <div className="microBasketHeader">
                <span className="microBasketTitle">Sua Lista — Supermercado do Mês</span>
                <span className="microBasketCount">{basketItems.length} itens planejados</span>
              </div>

              <div className="microBasketList">
                {basketItems.map(item => (
                  <div className="microBasketRow" key={item.id}>
                    <div className="itemCheckDot" />
                    <div className="itemDetails">
                      <span className="itemName">{item.name}</span>
                      <span className="itemStore">{item.store}</span>
                    </div>
                    <div className="itemMeta">
                      <span className={`statusPill ${item.status}`}>
                        {item.status === 'oferta' ? 'Oferta' : item.status === 'normal' ? 'Normal' : 'Comum'}
                      </span>
                      <span className="itemPrice">R$ {item.price.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="microBasketFooter">
                <span className="totalLabel">Total Estimado na Cesta:</span>
                <span className="totalValue">
                  R$ {basketItems.reduce((acc, i) => acc + i.price, 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Encartes Semanais Digitalizados */}
          <div className="nuBentoCard cardFlyers">
            <div className="bentoCardHeader">
              <span className="bentoBadge">Sem Papelada</span>
              <h3 className="bentoTitle">Encartes semanais oficiais na palma da mão</h3>
              <p className="bentoDescription">
                Consulte folhetos digitalizados dos supermercados locais atualizados semanalmente.
              </p>
            </div>

            <div className="bentoMicroUiFlyer">
              <div className="flyerThumbnailCard">
                <div className="flyerHeaderMini">
                  <span className="flyerStoreTag">Encarte Semanal</span>
                  <span className="flyerValidityTag">Válido até Domingo</span>
                </div>
                <div className="flyerGridMini">
                  <div className="flyerItemMini">
                    <span>☕ Café 500g</span>
                    <strong>R$ 16,99</strong>
                  </div>
                  <div className="flyerItemMini">
                    <span>🥛 Leite 1L</span>
                    <strong>R$ 4,79</strong>
                  </div>
                  <div className="flyerItemMini">
                    <span>🥩 Alcatra kg</span>
                    <strong>R$ 38,90</strong>
                  </div>
                </div>
                <div className="flyerActionMini">
                  <span>+ Adicionar promoções à cesta</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Termômetro de Ofertas & Auditoria */}
          <div className="nuBentoCard cardThermometer">
            <div className="bentoCardHeader">
              <span className="bentoBadge">Auditoria Real</span>
              <h3 className="bentoTitle">Termômetro que audita as oportunidades</h3>
              <p className="bentoDescription">
                O aplicativo categoriza cada item para você saber de verdade se o desconto compensa.
              </p>
            </div>

            <div className="bentoMicroUiThermometer">
              <div className="thermometerSelector">
                {thermometerLevels.map((lvl, idx) => (
                  <button
                    key={idx}
                    className={`thermoTab ${activeThermometerIndex === idx ? 'active ' + lvl.color : ''}`}
                    onClick={() => setActiveThermometerIndex(idx)}
                  >
                    {lvl.label}
                  </button>
                ))}
              </div>

              <div className="thermometerPreviewBox">
                <div className={`thermoIndicatorBar ${thermometerLevels[activeThermometerIndex].color}`}>
                  <span className="thermoBadge">{thermometerLevels[activeThermometerIndex].tag}</span>
                </div>
                <p className="thermoExplainText">
                  {thermometerLevels[activeThermometerIndex].desc}
                </p>
              </div>
            </div>
          </div>

          {/* Card 4 (Grande, 2 Colunas): Core Familiar em Tempo Real */}
          <div className="nuBentoCard cardSpan2 cardFamily">
            <div className="bentoCardHeader">
              <span className="bentoBadge">Sincronização Doméstica</span>
              <h3 className="bentoTitle">Core Familiar: 1 conta para até 3 celulares extras</h3>
              <p className="bentoDescription">
                Um único titular assina e compartilha o acesso com o parceiro, filhos ou parentes. Toda a família edita e confere as compras sincronizadas em tempo real.
              </p>
            </div>

            <div className="bentoMicroUiFamily">
              <div className="familyDeviceNode titular">
                <div className="deviceAvatar">👤</div>
                <div className="deviceInfo">
                  <strong>Responsável (Titular)</strong>
                  <span>Assinatura ativa</span>
                </div>
                <span className="titularBadge">Gestor do Core</span>
              </div>

              <div className="familySyncPill">
                <span className="syncIcon">⇄</span>
                <span>Sincronização P2P Instantânea</span>
              </div>

              <div className="familyMembersRow">
                <div className="deviceNodeMember">
                  <div className="deviceAvatar small">📱</div>
                  <span>Aparelho 1</span>
                </div>
                <div className="deviceNodeMember">
                  <div className="deviceAvatar small">📱</div>
                  <span>Aparelho 2</span>
                </div>
                <div className="deviceNodeMember">
                  <div className="deviceAvatar small">📱</div>
                  <span>Aparelho 3</span>
                </div>
              </div>

              <div className="inviteCodeSnippet">
                <span className="snippetLabel">Código de Convite Rápido (24h):</span>
                <span className="snippetCode">MERC-84</span>
              </div>
            </div>
          </div>

          {/* Card 5 (1 Coluna): Saldão de Validade Próxima */}
          <div className="nuBentoCard cardExpiry">
            <div className="bentoCardHeader">
              <span className="bentoBadge">Sustentabilidade & Economia</span>
              <h3 className="bentoTitle">Saldão de validade próxima com até 50% off</h3>
              <p className="bentoDescription">
                Itens perecíveis de alta qualidade próximos ao vencimento cadastrados pelos mercados parceiros para consumo imediato.
              </p>
            </div>

            <div className="bentoMicroUiExpiry">
              <div className="expiryItemCard">
                <div className="expiryBadge">⏳ Consumo Rápido</div>
                <div className="expiryDetails">
                  <strong>Iogurte Grego Natural 400g</strong>
                  <span className="expiryStore">Vence em 2 dias</span>
                </div>
                <div className="expiryPriceRow">
                  <span className="oldPrice">R$ 14,90</span>
                  <span className="newPrice">R$ 7,45</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 6 (2 Colunas): Transparência & Dados Regionais */}
          <div className="nuBentoCard cardSpan2 cardTransparency">
            <div className="bentoCardHeader">
              <span className="bentoBadge">Compromisso Ético</span>
              <h3 className="bentoTitle">Transparência sem falsas promessas de 'menor preço garantido'</h3>
              <p className="bentoDescription">
                Apresentamos dados provenientes de encartes públicos e referências médias por categoria. Não prometemos cobertura nacional onde não há dados, nem preços ao vivo onde inexiste integração técnica.
              </p>
            </div>

            <div className="bentoMicroUiTransparency">
              <div className="transparencyPillRow">
                <div className="tPillItem">
                  <span className="tIcon">📍</span>
                  <span>Calibração Piloto: <strong>Olímpia - SP</strong></span>
                </div>
                <div className="tPillItem">
                  <span className="tIcon">📊</span>
                  <span>Média Ponderada por Município</span>
                </div>
                <div className="tPillItem">
                  <span className="tIcon">🔒</span>
                  <span>Privacidade Conforme a LGPD</span>
                </div>
              </div>
              <div className="tBannerNotice">
                Nosso propósito é dar clareza às suas compras, respeitando a realidade de cada supermercado e de cada consumidor.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
