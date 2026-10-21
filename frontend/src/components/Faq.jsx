import React, { useState } from 'react';

const FAQS = [
  {
    q: 'O que é o MercadoFácil?',
    a: 'O MercadoFácil é um aplicativo desenvolvido para ajudar você a planejar suas compras de supermercado com mais economia e praticidade. Pelo app, você organiza sua lista de produtos, consulta encartes promocionais da sua região, visualiza referências de preços e aproveita oportunidades reais de economia.'
  },
  {
    q: 'Como consultar encartes no aplicativo?',
    a: 'Na aba "Encartes", o aplicativo exibe folhetos promocionais e encartes cadastrados para a sua localidade. Você pode folhear as páginas, verificar ofertas semanais e adicionar itens do encarte diretamente para a sua cesta de compras com um toque.'
  },
  {
    q: 'Como funciona a comparação de preços?',
    a: 'A comparação baseia-se em dados de encartes digitalizados, ofertas cadastradas e preços médios de referência por categoria e município. O app classifica os valores em três faixas visuais (Ofertas, Normal e Comum), permitindo saber se o valor exibido está realmente abaixo do habitual.'
  },
  {
    q: 'O aplicativo é gratuito?',
    a: 'Sim, o MercadoFácil possui uma versão gratuita completa com acesso a todas as funcionalidades essenciais: criação de listas, consulta de encartes e cálculo de cestas. Para manter o serviço sem custo, essa modalidade pode exibir anúncios discretos que não atrapalham o uso.'
  },
  {
    q: 'Como funciona a remoção de anúncios?',
    a: 'Para quem prefere uma experiência 100% limpa, oferecemos a opção de remoção de anúncios por compra única vitalícia (R$ 3,99). Não é uma mensalidade: você paga uma única vez na loja de aplicativos da sua plataforma e conta com suporte nativo a restauração de compra.'
  },
  {
    q: 'O que é o Core Familiar?',
    a: 'É um recurso premium por assinatura mensal (R$ 5,99/mês) projetado para famílias. O titular da assinatura pode gerar um código de convite seguro de 6 dígitos e vincular até 3 dispositivos adicionais, permitindo sincronização em tempo real de listas conjuntas e benefícios premium em todos os aparelhos.'
  },
  {
    q: 'Como supermercados e redes varejistas podem participar?',
    a: 'Supermercados locais e regionais podem se cadastrar no MercadoFácil Business para divulgar encartes oficiais, promoções relâmpago e saldões de validade próxima diretamente para os consumidores da sua praça. Basta preencher o formulário de cadastro comercial nesta página para falar com nosso time.'
  },
  {
    q: 'Como funciona a disponibilidade regional dos dados?',
    a: 'Os encartes e parâmetros de preço são calibrados por município e estado (com base piloto inicial detalhada em Olímpia - SP e expansão progressiva para cidades do interior e capitais). Conforme novos encartes e supermercados parceiros ingressam na plataforma, a cobertura de cada localidade se torna mais ampla e precisa.'
  }
];

export default function Faq() {
  const [openIndex, setOpenIndex] = useState(0);

  const toggleFaq = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="nuFaqSection" id="faq">
      <div className="nuSectionContainer">
        <div className="nuSectionHeader">
          <span className="nuKickerPill">Dúvidas Frequentes</span>
          <h2 className="nuDisplayTitle">
            Tire suas dúvidas.
          </h2>
          <p className="nuDisplaySubtitle">
            Respostas transparentes sobre o uso do aplicativo, modelo de planos e participação de parceiros.
          </p>
        </div>

        {/* Acordeão com Linhas Minimalistas Estilo Nubank */}
        <div className="nuFaqAccordion">
          {FAQS.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div 
                className={`nuFaqItem ${isOpen ? 'open' : ''}`} 
                key={index}
              >
                <button 
                  className="nuFaqQuestion" 
                  onClick={() => toggleFaq(index)}
                  aria-expanded={isOpen}
                  id={`faq-btn-${index}`}
                >
                  <span className="nuFaqQuestionText">{faq.q}</span>
                  <span className="nuFaqChevron">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </span>
                </button>
                {isOpen && (
                  <div className="nuFaqAnswer">
                    <p>{faq.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
