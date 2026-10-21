import React from 'react';

export default function FamilyCoreSection({ onScrollToSection }) {
  return (
    <section className="nuFamilySection" id="core-familiar">
      <div className="nuSectionContainer">
        <div className="nuSectionHeader">
          <span className="nuKickerPill">Economia em Conjunto</span>
          <h2 className="nuDisplayTitle">
            Core Familiar.
            <br />
            Uma assinatura para toda a casa.
          </h2>
          <p className="nuDisplaySubtitle">
            Chega de listas desencontradas no WhatsApp. Com o Core Familiar, o titular gerencia a conta e convida até 2 celulares para sincronização instantânea.
          </p>
        </div>

        <div className="nuFamilyGrid">
          {/* Coluna 1: Benefícios do Core */}
          <div className="nuFamilyBenefitsList">
            <div className="nuFamilyBenefitItem">
              <div className="benefitIconCircle">✓</div>
              <div className="benefitContent">
                <h4>Listas Sincronizadas em Tempo Real</h4>
                <p>Se alguém estiver no mercado e marcar um item como comprado, a lista atualiza na hora no celular de quem ficou em casa.</p>
              </div>
            </div>

            <div className="nuFamilyBenefitItem">
              <div className="benefitIconCircle">✓</div>
              <div className="benefitContent">
                <h4>Até 3 Dispositivos Conectados (1 + 2)</h4>
                <p>1 responsável financeiro administra o plano e convida até 2 outros membros da família sem nenhum custo adicional por aparelho.</p>
              </div>
            </div>

            <div className="nuFamilyBenefitItem">
              <div className="benefitIconCircle">✓</div>
              <div className="benefitContent">
                <h4>Benefícios Premium em Todos os Celulares</h4>
                <p>Todos os aparelhos vinculados aproveitam navegação 100% sem anúncios e acesso a todos os recursos avançados de auditoria.</p>
              </div>
            </div>

            <div className="nuFamilyBenefitItem">
              <div className="benefitIconCircle">✓</div>
              <div className="benefitContent">
                <h4>Código de Convite Rápido de 6 Dígitos</h4>
                <p>Conexão simplificada e segura: basta o titular gerar o código no app e o membro digitar no seu celular para entrar no Core.</p>
              </div>
            </div>
          </div>

          {/* Coluna 2: Diagrama Visual dos Aparelhos Conectados */}
          <div className="nuFamilyDiagramCard">
            <div className="diagramTitle">Arquitetura do Core Familiar</div>

            {/* Titular */}
            <div className="deviceCardOwner">
              <div className="avatarBox">👤</div>
              <div className="ownerInfo">
                <strong>Responsável Financeiro (Titular)</strong>
                <span>Administra o plano e gerencia os membros</span>
              </div>
              <span className="ownerBadge">Gestor</span>
            </div>

            {/* Linha de Conexão */}
            <div className="diagramSyncLine">
              <span className="syncTagLabel">Sincronização Ativa em Nuvem</span>
            </div>

            {/* Membros Conectados */}
            <div className="deviceMembersGrid">
              <div className="memberCard">
                <div className="avatarBox small">📱</div>
                <div className="memberInfo">
                  <strong>Aparelho 1</strong>
                  <span>Vinculado</span>
                </div>
              </div>
              <div className="memberCard">
                <div className="avatarBox small">📱</div>
                <div className="memberInfo">
                  <strong>Aparelho 2</strong>
                  <span>Vinculado</span>
                </div>
              </div>
            </div>

            {/* Código de Convite */}
            <div className="inviteCodeCard">
              <span className="inviteKicker">Código de Pareamento Rápido:</span>
              <div className="inviteDigits">MERC-84</div>
              <span className="inviteExpiration">Válido por 24 horas para novos membros</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
