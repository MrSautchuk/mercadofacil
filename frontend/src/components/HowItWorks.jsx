import React from 'react';

const STEPS = [
  {
    number: '01',
    title: 'Consulte os Encartes da Região',
    desc: 'Abra a aba de folhetos e veja as promoções digitalizadas dos mercados da sua cidade antes de sair de casa.'
  },
  {
    number: '02',
    title: 'Monte sua Cesta Inteligente',
    desc: 'Adicione os produtos que precisa. O app organiza sua lista por categorias e já estima o valor aproximado.'
  },
  {
    number: '03',
    title: 'Audite com o Termômetro',
    desc: 'Confira se a oferta divulgada é realmente vantajosa ou se está no preço habitual de prateleira.'
  },
  {
    number: '04',
    title: 'Compre com Certeza no Caixa',
    desc: 'Vá ao supermercado com sua lista organizada, risque itens comprados e mantenha a economia sob controle.'
  }
];

export default function HowItWorks() {
  return (
    <section className="nuFlowSection" id="como-funciona">
      <div className="nuSectionContainer">
        <div className="nuSectionHeader">
          <span className="nuKickerPill">Passo a Passo Simples</span>
          <h2 className="nuDisplayTitle">
            Como funciona na prática.
          </h2>
          <p className="nuDisplaySubtitle">
            Quatro etapas diretas para transformar a forma como você planeja suas compras semanais.
          </p>
        </div>

        <div className="nuStepsFlowGrid">
          {STEPS.map((step, idx) => (
            <div className="nuStepFlowCard" key={idx}>
              <div className="nuStepTopRow">
                <span className="nuStepNumber">{step.number}</span>
                <span className="nuStepLine" />
              </div>
              <h3 className="nuStepTitle">{step.title}</h3>
              <p className="nuStepDesc">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
