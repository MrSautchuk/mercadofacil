import React, { useState, useEffect } from 'react';

export default function Navbar({ onOpenPortal, onScrollToSection, activeMode, onToggleMode }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = (id) => {
    onScrollToSection(id);
    setMobileMenuOpen(false);
  };

  return (
    <header className={`nuNavbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="nuNavContainer">
        {/* Brand */}
        <div className="nuBrand" onClick={() => handleNavClick(activeMode === 'b2b' ? 'hero-b2b' : 'hero')} role="button" tabIndex={0}>
          <div className="nuBrandIcon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
          </div>
          <span className="nuBrandName">
            Mercado<strong>Fácil</strong> {activeMode === 'b2b' && <span className="b2bTagNavbar">Business</span>}
          </span>
        </div>

        {/* Master Mode Switch (Portal do Lojista vs Quero Economizar) */}
        <div className="nuNavMasterSwitch">
          <button 
            className={`nuNavSwitchBtn ${activeMode === 'b2b' ? 'active' : ''}`}
            onClick={() => onToggleMode('b2b')}
            id="nav-switch-b2b"
          >
            🏢 Portal do Lojista
          </button>
          <button 
            className={`nuNavSwitchBtn ${activeMode === 'b2c' ? 'active' : ''}`}
            onClick={() => onToggleMode('b2c')}
            id="nav-switch-b2c"
          >
            🛒 Quero Economizar
          </button>
        </div>

        {/* Desktop Navigation */}
        <nav className="nuNavMenu">
          {activeMode === 'b2b' ? (
            <>
              <button className="nuNavLink" onClick={() => handleNavClick('supermercados')}>
                Vantagens B2B
              </button>
              <button className="nuNavLink" onClick={() => handleNavClick('planos')}>
                Planos Lojista
              </button>
              <button className="nuNavLink" onClick={() => handleNavClick('cadastro')}>
                Homologação
              </button>
              <button className="nuNavLink" onClick={() => handleNavClick('faq')}>
                Dúvidas
              </button>
            </>
          ) : (
            <>
              <button className="nuNavLink" onClick={() => handleNavClick('recursos')}>
                Recursos
              </button>
              <button className="nuNavLink" onClick={() => handleNavClick('como-funciona')}>
                Como Funciona
              </button>
              <button className="nuNavLink" onClick={() => handleNavClick('termometro')}>
                Termômetro
              </button>
              <button className="nuNavLink" onClick={() => handleNavClick('core-familiar')}>
                Família
              </button>
              <button className="nuNavLink" onClick={() => handleNavClick('planos')}>
                Planos
              </button>
              <button className="nuNavLink" onClick={() => handleNavClick('download')}>
                Baixar App
              </button>
            </>
          )}
        </nav>

        {/* Action Buttons */}
        <div className="nuNavActions">
          {activeMode === 'b2b' ? (
            <>
              <button 
                className="nuBtnGhost" 
                onClick={onOpenPortal}
                id="nav-btn-portal-lojista"
              >
                Abrir Painel
              </button>
              <button 
                className="nuBtnPrimary" 
                onClick={() => handleNavClick('cadastro')}
                id="nav-btn-cadastrar-loja"
              >
                Cadastrar Loja
              </button>
            </>
          ) : (
            <>
              <button 
                className="nuBtnGhost" 
                onClick={() => onToggleMode('b2b')}
                id="nav-btn-sou-supermercado"
              >
                Sou Lojista
              </button>
              <button 
                className="nuBtnPrimary" 
                onClick={() => handleNavClick('download')}
                id="nav-btn-baixar-app"
              >
                Conhecer o App
              </button>
            </>
          )}
          
          {/* Mobile Hamburger */}
          <button 
            className="nuMobileToggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Abrir menu de navegação"
            id="nav-btn-mobile-toggle"
          >
            <span className={`nuHamburgerIcon ${mobileMenuOpen ? 'open' : ''}`}></span>
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="nuMobileDrawer">
          <div className="nuMobileDrawerContent">
            <div className="nuMobileSwitch">
              <button 
                className={`nuNavSwitchBtn full ${activeMode === 'b2b' ? 'active' : ''}`}
                onClick={() => { onToggleMode('b2b'); setMobileMenuOpen(false); }}
              >
                🏢 Portal do Lojista
              </button>
              <button 
                className={`nuNavSwitchBtn full ${activeMode === 'b2c' ? 'active' : ''}`}
                onClick={() => { onToggleMode('b2c'); setMobileMenuOpen(false); }}
              >
                🛒 Quero Economizar
              </button>
            </div>

            {activeMode === 'b2b' ? (
              <>
                <button className="nuMobileLink" onClick={() => handleNavClick('supermercados')}>Vantagens B2B</button>
                <button className="nuMobileLink" onClick={() => handleNavClick('planos')}>Planos Lojista</button>
                <button className="nuMobileLink" onClick={() => handleNavClick('cadastro')}>Homologação de Supermercados</button>
                <button className="nuMobileLink" onClick={() => handleNavClick('faq')}>Perguntas Frequentes</button>
                
                <div className="nuMobileDrawerButtons">
                  <button className="nuBtnGhost fullWidth" onClick={() => { onOpenPortal(); setMobileMenuOpen(false); }}>
                    Abrir Painel Demo
                  </button>
                  <button className="nuBtnPrimary fullWidth" onClick={() => handleNavClick('cadastro')}>
                    Cadastrar Meu Supermercado
                  </button>
                </div>
              </>
            ) : (
              <>
                <button className="nuMobileLink" onClick={() => handleNavClick('recursos')}>Recursos do App</button>
                <button className="nuMobileLink" onClick={() => handleNavClick('como-funciona')}>Como Funciona</button>
                <button className="nuMobileLink" onClick={() => handleNavClick('termometro')}>Termômetro de Ofertas</button>
                <button className="nuMobileLink" onClick={() => handleNavClick('core-familiar')}>Core Familiar (1 + 2)</button>
                <button className="nuMobileLink" onClick={() => handleNavClick('planos')}>Planos do App</button>
                <button className="nuMobileLink" onClick={() => handleNavClick('download')}>Baixar Aplicativo</button>
                
                <div className="nuMobileDrawerButtons">
                  <button className="nuBtnGhost fullWidth" onClick={() => { onToggleMode('b2b'); setMobileMenuOpen(false); }}>
                    Sou Lojista
                  </button>
                  <button className="nuBtnPrimary fullWidth" onClick={() => handleNavClick('download')}>
                    Baixar Aplicativo
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
