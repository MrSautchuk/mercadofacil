import React from 'react';

export default function DownloadSection({ onOpenPortal }) {
  return (
    <section className="nuDownloadSection" id="download">
      <div className="nuSectionContainer">
        <div className="nuDownloadCard">
          <div className="nuDownloadTextCol">
            <span className="nuKickerPill light">Acesso ao Aplicativo</span>
            <h2 className="nuDownloadTitle">
              Comece a economizar na próxima ida ao mercado.
            </h2>
            <p className="nuDownloadDesc">
              O MercadoFácil está disponível em ambiente de testes locais para celular via Expo Go e navegador Web, com pacote APK para Android em fase de compilação.
            </p>

            <div className="nuDownloadBtnRow">
              <a 
                href="http://localhost:8081" 
                target="_blank" 
                rel="noreferrer"
                className="nuBtnHeroPrimary"
                id="btn-expo-live"
              >
                <span>Acessar no Expo Go</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14"></path>
                  <path d="m12 5 7 7-7 7"></path>
                </svg>
              </a>
              <button 
                className="nuBtnHeroSecondary" 
                onClick={onOpenPortal}
                id="btn-portal-modal-cta"
              >
                Demonstração Lojista
              </button>
            </div>
          </div>

          <div className="nuDownloadSpecsCol">
            <div className="specRow">
              <span className="specKey">Versão Atual</span>
              <span className="specVal">v1.2.0 (Beta Funcional)</span>
            </div>
            <div className="specRow">
              <span className="specKey">Plataformas</span>
              <span className="specVal">Android & Web Mobile</span>
            </div>
            <div className="specRow">
              <span className="specKey">Calibração Piloto</span>
              <span className="specVal">Olímpia - SP</span>
            </div>
            <div className="specRow">
              <span className="specKey">Segurança</span>
              <span className="specVal">Conforme a LGPD</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
