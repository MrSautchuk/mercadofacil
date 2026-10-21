import React, { useState, useEffect } from 'react';

const BRAZIL_UFS = [
  'SP', 'RJ', 'MG', 'ES', 'PR', 'SC', 'RS', 'MS', 'MT', 'GO',
  'DF', 'BA', 'PE', 'CE', 'MA', 'PA', 'AM', 'RO', 'AC', 'TO',
  'PI', 'RN', 'PB', 'AL', 'SE', 'AP', 'RR'
];

export default function RegistrationForm({ selectedPlan }) {
  const [formData, setFormData] = useState({
    cnpj: '',
    tradeName: '',
    contactName: '',
    whatsapp: '',
    city: '',
    state: 'SP',
    planInterest: 'Supermercado Pro (R$ 149/mês)'
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  useEffect(() => {
    if (selectedPlan) {
      setFormData(prev => ({ 
        ...prev, 
        planInterest: `${selectedPlan.name} (${selectedPlan.price}/${selectedPlan.period})` 
      }));
    }
  }, [selectedPlan]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.tradeName || !formData.whatsapp || !formData.city) {
      alert('Por favor, preencha o Nome Fantasia, WhatsApp e a Cidade da loja.');
      return;
    }

    setIsSubmitting(true);
    try {
      await new Promise(r => setTimeout(r, 650));
      setSubmittedSuccess(true);
    } catch (err) {
      alert('Erro ao enviar contato: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="nuRegistrationSection" id="cadastro">
      <div className="nuSectionContainer">
        <div className="nuSectionHeader">
          <span className="nuKickerPill">Parceria Comercial B2B</span>
          <h2 className="nuDisplayTitle">
            Cadastre seu estabelecimento.
          </h2>
          <p className="nuDisplaySubtitle">
            Conecte seu supermercado ou hortifruti aos consumidores que já planejam compras na sua cidade.
          </p>
        </div>

        <div className="nuRegCardWrapper">
          {submittedSuccess ? (
            <div className="nuRegSuccessCard">
              <div className="nuSuccessCheck">✓</div>
              <h3 className="nuSuccessTitle">Solicitação Comercial Enviada</h3>
              <p className="nuSuccessText">
                Obrigado, <strong>{formData.contactName || formData.tradeName}</strong>! Recebemos o cadastro do <strong>{formData.tradeName}</strong> em {formData.city} - {formData.state}. Nossa equipe comercial entrará em contato via WhatsApp no número <strong>{formData.whatsapp}</strong> para iniciar a homologação dos seus encartes.
              </p>
              <button 
                className="nuBtnHeroSecondary" 
                onClick={() => setSubmittedSuccess(false)}
                style={{ marginTop: '1.5rem' }}
              >
                Enviar Novo Cadastro
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="nuRegForm">
              <div className="nuFormHeaderNotice">
                <span>🏢</span>
                <span>
                  <strong>Canal para Varejistas:</strong> Formulário exclusivo para proprietários, gerentes e equipes de marketing de supermercados.
                </span>
              </div>

              <div className="nuFormGrid">
                <div className="nuFormField">
                  <label htmlFor="nu-tradeName">Nome Fantasia do Supermercado *</label>
                  <input
                    id="nu-tradeName"
                    type="text"
                    className="nuInput"
                    placeholder="Ex: Supermercado Estrela do Vale"
                    required
                    value={formData.tradeName}
                    onChange={(e) => handleChange('tradeName', e.target.value)}
                  />
                </div>

                <div className="nuFormField">
                  <label htmlFor="nu-cnpj">CNPJ (Opcional)</label>
                  <input
                    id="nu-cnpj"
                    type="text"
                    className="nuInput"
                    placeholder="00.000.000/0001-00"
                    value={formData.cnpj}
                    onChange={(e) => handleChange('cnpj', e.target.value)}
                  />
                </div>

                <div className="nuFormField">
                  <label htmlFor="nu-contactName">Nome do Responsável Comercial</label>
                  <input
                    id="nu-contactName"
                    type="text"
                    className="nuInput"
                    placeholder="Ex: Carlos Eduardo (Gerente)"
                    value={formData.contactName}
                    onChange={(e) => handleChange('contactName', e.target.value)}
                  />
                </div>

                <div className="nuFormField">
                  <label htmlFor="nu-whatsapp">WhatsApp para Contato Comercial *</label>
                  <input
                    id="nu-whatsapp"
                    type="text"
                    className="nuInput"
                    placeholder="(11) 98765-4321"
                    required
                    value={formData.whatsapp}
                    onChange={(e) => handleChange('whatsapp', e.target.value)}
                  />
                </div>

                <div className="nuFormField">
                  <label htmlFor="nu-city">Cidade da Loja *</label>
                  <input
                    id="nu-city"
                    type="text"
                    className="nuInput"
                    placeholder="Ex: Olímpia"
                    required
                    value={formData.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                  />
                </div>

                <div className="nuFormField">
                  <label htmlFor="nu-state">Estado (UF) *</label>
                  <select
                    id="nu-state"
                    className="nuSelect"
                    value={formData.state}
                    onChange={(e) => handleChange('state', e.target.value)}
                  >
                    {BRAZIL_UFS.map(uf => (
                      <option value={uf} key={uf}>{uf}</option>
                    ))}
                  </select>
                </div>

                <div className="nuFormField fullSpan">
                  <label htmlFor="nu-plan">Plano Comercial de Interesse</label>
                  <input
                    id="nu-plan"
                    type="text"
                    className="nuInput"
                    value={formData.planInterest}
                    onChange={(e) => handleChange('planInterest', e.target.value)}
                  />
                </div>
              </div>

              <div className="nuFormSubmitArea">
                <button
                  type="submit"
                  className="nuBtnHeroPrimary fullWidth"
                  disabled={isSubmitting}
                  id="btn-submeter-parceria"
                >
                  {isSubmitting ? 'Enviando Solicitação...' : 'Solicitar Homologação Comercial →'}
                </button>
                <span className="nuPrivacyDisclaimer">
                  🔒 Seus dados serão utilizados exclusivamente para contato da equipe MercadoFácil. Em conformidade com a LGPD.
                </span>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
