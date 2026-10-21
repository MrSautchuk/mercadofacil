import React from 'react';

const FEATURES = [
  {
    icon: '⚡',
    title: 'Publicação Instantânea de Encartes',
    desc: 'Basta arrastar seu PDF, JPG ou WebP no portal. Nosso leitor inteligente processa o encarte e os consumidores conseguem adicionar os itens à cesta com um toque.',
    badge: 'Multi-formato'
  },
  {
    icon: '⏳',
    title: 'Saldão de Validade & Redução de Perdas',
    desc: 'Evite prejuízos com perecíveis. Lance ofertas relâmpago de produtos próximos do vencimento com contagem regressiva para consumidores da sua vizinhança.',
    badge: 'Zero Desperdício'
  },
  {
    icon: '🤖',
    title: 'Auditoria de Preços com Inteligência Artificial',
    desc: 'Nossa IA pesquisa os preços médios praticados no seu município. Quando seu preço é de fato vantajoso, sua oferta recebe o selo exclusivo de Oferta Auditada.',
    badge: 'Credibilidade'
  },
  {
    icon: '📍',
    title: 'Segmentação Regional por Município',
    desc: 'Suas ofertas são exibidas para clientes cadastrados exatamente na sua cidade ou microrregião. Sem depender de GPS invasivo ou custos abusivos de marketplace.',
    badge: 'Hiperlocal'
  },
  {
    icon: '📊',
    title: 'Inteligência de Cesta & Demanda Real',
    desc: 'Saiba quais produtos da sua loja estão entre os mais salvos na lista de compras dos clientes antes mesmo deles irem até o caixa do supermercado.',
    badge: 'Previsibilidade'
  },
  {
    icon: '👨‍👩‍👧‍👦',
    title: 'Presença no Core Familiar',
    desc: 'Quando um membro da família adiciona sua oferta, todos os celulares conectados ao Core Familiar sincronizam o item, multiplicando seu alcance de vendas.',
    badge: 'Alcance Familiar'
  }
];

export default function Features() {
  return (
    <section className="featuresSection" id="recursos">
      <div className="container">
        <div className="sectionHeader">
          <span className="sectionPill">Recursos Enterprise</span>
          <h2 className="sectionTitle">Tecnologia Criada Sob Medida para o Varejo Alimentar</h2>
          <p className="sectionDesc">
            Uma suíte completa de ferramentas que coloca a inteligência artificial a favor do lojista, aumentando o giro de mercadorias e atraindo clientes qualificados.
          </p>
        </div>

        <div className="featuresGrid">
          {FEATURES.map((feat, index) => (
            <div className="featureCard" key={index}>
              <div className="featureIconWrapper">{feat.icon}</div>
              <h3 className="featureTitle">{feat.title}</h3>
              <p className="featureDesc">{feat.desc}</p>
              <span className="featureBadgeExtra">{feat.badge}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
