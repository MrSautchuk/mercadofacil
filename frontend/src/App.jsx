import { useState } from 'react';
import './App.css';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import HeroB2B from './components/HeroB2B';
import BenefitsSection from './components/BenefitsSection';
import HowItWorks from './components/HowItWorks';
import RealAppShowcase from './components/RealAppShowcase';
import ThermometerSection from './components/ThermometerSection';
import FamilyCoreSection from './components/FamilyCoreSection';
import RetailerB2BSection from './components/RetailerB2BSection';
import PricingTable from './components/PricingTable';
import RegistrationForm from './components/RegistrationForm';
import DownloadSection from './components/DownloadSection';
import Faq from './components/Faq';
import Footer from './components/Footer';
import MerchantPortalModal from './components/MerchantPortalModal';

function App() {
  const [activeMode, setActiveMode] = useState('b2b'); // 'b2b' (Portal do Lojista) | 'b2c' (Quero Economizar)
  const [isPortalOpen, setIsPortalOpen] = useState(false);
  const [selectedPlanForRegistration, setSelectedPlanForRegistration] = useState(null);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSelectPlan = (plan) => {
    setSelectedPlanForRegistration(plan);
    scrollToSection('cadastro');
  };

  const handleToggleMode = (mode) => {
    setActiveMode(mode);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className={`siteRoot mode-${activeMode}`}>
      {/* 1. Navbar Minimalista com Master Switch Integrado */}
      <Navbar 
        activeMode={activeMode}
        onToggleMode={handleToggleMode}
        onOpenPortal={() => setIsPortalOpen(true)}
        onScrollToSection={scrollToSection}
      />

      {/* RENDERIZAÇÃO ESTREITA E SEPARADA DE SEGMENTOS */}
      {activeMode === 'b2b' ? (
        /* ==================== MODO 1: PORTAL DO LOJISTA (B2B RETAIL) ==================== */
        <main className="b2bMainView">
          {/* Hero B2B Editorial de Alto Padrão focado em Supermercados */}
          <HeroB2B 
            onScrollToSection={scrollToSection}
            onOpenPortal={() => setIsPortalOpen(true)}
          />

          {/* Vantagens e Arquitetura B2B (Métricas, Saldão de Perecíveis, Ofertas 24h) */}
          <RetailerB2BSection 
            onOpenPortal={() => setIsPortalOpen(true)}
            onScrollToSection={scrollToSection}
          />

          {/* Planos voltados a Supermercados (Piloto Grátis, Pro R$ 149, Enterprise R$ 299) */}
          <PricingTable 
            onScrollToSection={scrollToSection}
            onSelectPlan={handleSelectPlan}
            defaultAudience="retail"
          />

          {/* Formulário Comercial de Homologação de Estabelecimentos */}
          <RegistrationForm 
            selectedPlan={selectedPlanForRegistration}
          />

          {/* Perguntas Frequentes de Lojistas e Varejistas */}
          <Faq />
        </main>
      ) : (
        /* ==================== MODO 2: QUERO ECONOMIZAR (B2C CONSUMIDOR) ==================== */
        <main className="b2cMainView">
          {/* Hero Editorial voltado ao Consumidor Final */}
          <Hero 
            onScrollToSection={scrollToSection}
            onOpenPortal={() => setIsPortalOpen(true)}
          />

          {/* Recursos Essenciais (Cesta, Encartes, Termômetro) */}
          <BenefitsSection 
            onScrollToSection={scrollToSection}
          />

          {/* Como Funciona em 4 Passos */}
          <HowItWorks />

          {/* Demonstração Real do Aplicativo Mobile */}
          <RealAppShowcase />

          {/* Termômetro de Ofertas & Auditoria */}
          <ThermometerSection />

          {/* Core Familiar (1 Titular + 2 Dependentes Conectados) */}
          <FamilyCoreSection 
            onScrollToSection={scrollToSection}
          />

          {/* Planos para Consumidores (Gratuito, Sem Anúncios R$ 3,99, Core Familiar R$ 5,99) */}
          <PricingTable 
            onScrollToSection={scrollToSection}
            onSelectPlan={handleSelectPlan}
            defaultAudience="consumer"
          />

          {/* Download e Disponibilidade do App */}
          <DownloadSection 
            onOpenPortal={() => setIsPortalOpen(true)}
          />

          {/* Dúvidas Frequentes do Consumidor */}
          <Faq />
        </main>
      )}

      {/* Rodapé Institucional Corporativo */}
      <Footer 
        onScrollToSection={scrollToSection}
        onOpenPortal={() => setIsPortalOpen(true)}
      />

      {/* Modal Operacional de Demonstração do Portal do Lojista */}
      <MerchantPortalModal 
        isOpen={isPortalOpen}
        onClose={() => setIsPortalOpen(false)}
      />
    </div>
  );
}

export default App;
