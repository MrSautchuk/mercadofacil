import React from 'react';

export default function PriceTransparencySection() {
  return (
    <section className="sectionWrapper" id="transparencia">
      <div className="sectionContainer">
        
        <div className="sectionHeaderBlock">
          <div className="sectionKickerBadge">Critério & Honestidade</div>
          <h2 className="sectionTitle">Transparência Total na Comparação de Preços</h2>
          <p className="sectionSubtitle">
            Acreditamos que confiança se constrói com clareza sobre como as informações são obtidas, classificadas e atualizadas.
          </p>
        </div>

        <div className="transparencyGrid">
          
          <div className="transparencyCard">
            <div className="cardHeaderBadge green">Origem dos Dados</div>
            <h3 className="cardTitle">De onde vêm os preços exibidos?</h3>
            <p className="cardText">
              Os dados de preços do MercadoFácil têm duas fontes principais:
            </p>
            <ul className="transparencyList">
              <li><strong>Encartes Oficiais Semanais:</strong> Folhetos promocionais em PDF ou fotos publicados pelos próprios supermercados e redes da sua cidade.</li>
              <li><strong>Médias de Referência da Praça:</strong> Levantamento de valores habituais praticados no comércio da sua região cadastrada.</li>
            </ul>
          </div>

          <div className="transparencyCard">
            <div className="cardHeaderBadge yellow">Sem Falsas Promessas</div>
            <h3 className="cardTitle">O que nós NÃO afirmamos</h3>
            <p className="cardText">
              Não fazemos promessas comerciais impossíveis de auditar:
            </p>
            <ul className="transparencyList">
              <li><strong>Não prometemos "menor preço garantido":</strong> Preços sofrem variações de lote, horário e estoque físico na loja.</li>
              <li><strong>Não alegamos conexão direta aos PDVs:</strong> Os valores correspondem aos folhetos vigentes e às atualizações cadastradas para o período.</li>
            </ul>
          </div>

          <div className="transparencyCard">
            <div className="cardHeaderBadge brand">Validade das Ofertas</div>
            <h3 className="cardTitle">Datas, Lotes e Estoques</h3>
            <p className="cardText">
              Toda promoção possui prazo determinado:
            </p>
            <ul className="transparencyList">
              <li>O aplicativo indica a data de validade dos folhetos quando ela consta no material publicado.</li>
              <li>Recomendamos sempre conferir a etiqueta final na gôndola física no momento da compra.</li>
            </ul>
          </div>

        </div>

      </div>
    </section>
  );
}
