import React from 'react';

export default function Footer({ onScrollToSection, onOpenPortal }) {
  return (
    <footer className="nuFooter">
      <div className="nuSectionContainer">
        <div className="nuFooterGrid">
          {/* Coluna da Marca */}
          <div className="nuFooterBrandCol">
            <div className="nuBrand" onClick={() => onScrollToSection('hero')}>
              <div className="nuBrandIcon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="21" r="1"></circle>
                  <circle cx="20" cy="21" r="1"></circle>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                </svg>
              </div>
              <span className="nuBrandName textWhite">
                Mercado<strong>Fácil</strong>
              </span>
            </div>

            <p className="nuFooterBrandDesc">
              A tecnologia que coloca o controle das compras de supermercado de volta nas mãos das famílias e dos estabelecimentos locais.
            </p>

            <div className="nuFooterPilotTag">
              <span>📍</span> Calibração piloto inicial: <strong>Olímpia - SP</strong>
            </div>
          </div>

          {/* Coluna 1: Produto */}
          <div className="nuFooterCol">
            <h4 className="nuFooterHeading">Produto</h4>
            <ul className="nuFooterLinks">
              <li><button onClick={() => onScrollToSection('recursos')}>Recursos do App</button></li>
              <li><button onClick={() => onScrollToSection('como-funciona')}>Como Funciona</button></li>
              <li><button onClick={() => onScrollToSection('interface-real')}>Interface Real</button></li>
              <li><button onClick={() => onScrollToSection('termometro')}>Termômetro de Ofertas</button></li>
              <li><button onClick={() => onScrollToSection('core-familiar')}>Core Familiar</button></li>
            </ul>
          </div>

          {/* Coluna 2: Varejo & Comercial */}
          <div className="nuFooterCol">
            <h4 className="nuFooterHeading">Supermercados</h4>
            <ul className="nuFooterLinks">
              <li><button onClick={() => onScrollToSection('supermercados')}>MercadoFácil Business</button></li>
              <li><button onClick={onOpenPortal}>Portal do Lojista (Demo)</button></li>
              <li><button onClick={() => onScrollToSection('cadastro')}>Cadastrar Loja</button></li>
              <li><button onClick={() => onScrollToSection('planos')}>Tabela de Planos</button></li>
            </ul>
          </div>

          {/* Coluna 3: Acesso & Legal */}
          <div className="nuFooterCol">
            <h4 className="nuFooterHeading">Acesso & Legal</h4>
            <ul className="nuFooterLinks">
              <li>
                <a href="http://localhost:8081" target="_blank" rel="noreferrer">
                  Ambiente Mobile (Expo Go) ↗
                </a>
              </li>
              <li><button onClick={() => onScrollToSection('download')}>Disponibilidade APK</button></li>
              <li><button onClick={() => onScrollToSection('faq')}>Perguntas Frequentes</button></li>
              <li><span>Conformidade com a LGPD</span></li>
            </ul>
          </div>
        </div>

        {/* Barra Inferior */}
        <div className="nuFooterBottom">
          <div className="nuFooterCopy">
            © {new Date().getFullYear()} MercadoFácil Tecnologia. Todos os direitos reservados.
          </div>
          <div className="nuFooterDisclaimer">
            Preços e ofertas sujeitos à disponibilidade e vigência estipulada pelos supermercados cadastrados.
          </div>
        </div>
      </div>
    </footer>
  );
}
