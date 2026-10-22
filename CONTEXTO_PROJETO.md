# 🛒 CONTEXTO GERAL DO PROJETO — MERCADOFÁCIL

> **Documento Mestre Consolidado: Arquitetura, Regras de Negócio, Decisões Técnicas (ADRs) e Estado Atual**  
> *Aplicação: MercadoFácil (Lista de Compras Inteligente & Ecossistema de Varejo Local)*  
> *Versão: 2.0 (Consolidada com Core Familiar Offline-First, Monorepo e Build Standalone)*  
> *Última atualização: Outubro de 2026*

---

## 1. 📌 VISÃO GERAL & PROPOSTA DE VALOR

O **MercadoFácil** é uma plataforma e ecossistema integrado de compras de supermercado projetado para conectar consumidores e varejistas locais. Ele une inteligência artificial, auditoria de preços em encartes e colaboração familiar em tempo real para eliminar o desperdício financeiro e de tempo no planejamento doméstico.

### O Problema que Resolve
1. **Promoções Ilusórias:** Consumidores perdem dinheiro com folhetos promocionais que anunciam preços habituais de gôndola como se fossem grandes descontos.
2. **Desorganização Familiar:** Listas em papel ou grupos de WhatsApp geram compras duplicadas, esquecimentos e estouro de orçamento no caixa.
3. **Desperdício e Custo no Varejo:** Supermercados locais e regionais gastam fortunas imprimindo tabloides de papel de baixa conversão e têm dificuldade para liquidar itens perecíveis perto da data de vencimento.

### Os Cinco Pilares da Marca
1. **Economia Real:** Auditoria de encartes identificando se o desconto anunciado é autêntico frente ao histórico regional.
2. **Confiança & Transparência:** Diferenciação objetiva entre *Super Oferta*, *Preço Normal* e *Preço Comum / Falsa Promoção*.
3. **Praticidade Extrema:** Criação rápida da lista com autocomplete direto e cálculo estimado automático em tempo real.
4. **Colaboração Familiar:** Sincronização offline-first e instantânea entre os membros da casa (**Core Familiar**).
5. **Tecnologia Útil:** Leitura e extração de encartes físicos e digitais via IA multimodal (**Google Gemini**).

---

## 2. 🏗️ ESTRUTURA DO REPOSITÓRIO (MONOREPO)

O repositório é organizado de forma modular em monorepo, versionado e rastreado no GitHub:
* 🌐 **Repositório Oficial:** [github.com/MrSautchuk/mercadofacil](https://github.com/MrSautchuk/mercadofacil) (Branch `main`)

```
lista de compras/
├── backend/                  # API REST em Node.js / Express / SQLite / Gemini / WebSockets
│   ├── app.db                # Banco de dados SQLite local (ignorado pelo Git)
│   ├── database.js           # Schemas, migrações seguras e índices das tabelas
│   ├── server.js             # Endpoints REST, WebSockets, agendadores e orquestração de IA
│   ├── monetizationRoutes.js # Regras de negócios, billing, entitlements e rotas comerciais
│   ├── familySyncRoutes.js   # Protocolo de sincronização monotônica e concorrência familiar
│   ├── tests/                # Suíte de testes automatizados de integração do backend
│   │   ├── family_core_spec_tests.mjs  # 10 cenários da Seção 33 (offline-first e conflitos)
│   │   └── monetization_api_tests.mjs  # 4 cenários de entitlements e ofertas B2B
│   ├── .env.example          # Modelo público de variáveis de ambiente
│   └── package.json
│
├── mobile/                   # Aplicativo Nativo em React Native (Expo)
│   ├── App.js                # Orquestração do app, abas e estado central
│   ├── src/
│   │   ├── config.js         # Endpoints locais e produção Oracle Cloud (204.216.176.48:3001)
│   │   ├── components/       # Telas, modais (QR Code, edição, conflitos, filtros, estatísticas)
│   │   ├── domain/           # Serviços de domínio (FamilyCoreService, SyncQueueService, etc.)
│   │   ├── infrastructure/   # Integrações externas (BillingService, AdsService)
│   │   └── theme/            # Design System (Theme.js, temas escuro de inventário e claro)
│   ├── tests/                # Testes unitários do mobile (monetization_unit_tests.mjs)
│   ├── app.json              # Configurações do Expo e EAS Build
│   └── package.json          # Expo SDK 57, React 19, React Native 0.86
│
├── frontend/                 # Portal Web Institucional & Portal do Lojista B2B (React + Vite)
│   ├── index.html            # Ponto de entrada com SEO e meta tags
│   ├── src/
│   │   ├── App.jsx           # Orquestração das 12 seções institucionais e modo B2B
│   │   ├── App.css           # Estilização completa do Design System editorial (estilo Nubank)
│   │   ├── index.css         # Design tokens e tipografia global
│   │   └── components/       # Componentes das 12 seções e MerchantPortalModal
│   └── package.json          # React 19 + Vite (porta 5173)
│
├── .agents/                  # Memória persistente, regras e workflows da IA (AG Kit)
│   ├── memory/               # MEMORY.md, project-conventions.md, tech-decisions.md
│   ├── rules/                # graphify.md e regras do workspace
│   └── workflows/            # Workflows operacionais (/continuar, etc.)
│
├── mercadofacil_core_familiar_especificacao-1.md # Especificação técnica do Core Familiar (43 KB)
├── core-familiar-implementation.md               # Plano de execução e mapa de fases do Core Familiar
├── catalogo_ferramentas_skills_agentes.pdf       # Catálogo oficial do ecossistema de ferramentas da IA
├── .gitignore                # Regras de proteção total contra vazamento de credenciais e bancos
└── CONTEXTO_PROJETO.md       # Este documento consolidado
```

---

## 3. ⚙️ ARQUITETURA TÉCNICA & STACK DETALHADA

### 3.1 Aplicativo Mobile (`mobile/`)
* **Framework:** React Native com Expo (SDK 57, React 19, React Native 0.86).
* **Navegação & Telas:** 3 abas principais com unificação terminológica:
  1. **Minha Lista:** Cesta de compras inteligente, cálculo dinâmico, check-off de itens comprados e snapshots do menor preço da cidade.
  2. **Encartes:** Galeria de folhetos digitalizados com leitor integrado de imagens e PDFs com paginação virtualizada.
  3. **Ajustes:** Troca de tema, seleção de cidade/UF pelo IBGE, gestão de assinaturas, tutorial de chave Gemini e modo superuser de teste.
* **Persistência Local & Offline:** `AsyncStorage` + `SyncQueueService` para persistência das operações locais e resiliência total a reinicializações.
* **Leitor de QR Code:** Implementado com permissão ativa, mira óptica centralizada e laser guia animado ([`QrScannerModal.js`](file:///c:/Users/allan/OneDrive/Área de Trabalho/lista de compras/mobile/src/components/QrScannerModal.js)) para emparelhamento instantâneo do Core Familiar.
* **Upload Resiliente:** Leitura de arquivos em Base64 via `expo-file-system/legacy` (`FileSystem.readAsStringAsync`) com fallback universal para `FileReader`.
* **Design System Mobile:** Foco no tema escuro de inventário (`#0d1410` com acentos em verde-limão `#4ade80`), com suporte a tema claro alternável nos Ajustes.
* **Build Standalone Concluída:** Binário APK Android gerado com sucesso via Expo EAS Preview:
  * 📲 **[Download APK Standalone](https://expo.dev/artifacts/eas/LUIWa9KUVc3wWe0f5JxQAWAZNUqQUrsRazPnmECa57U.apk)**
  * 🔗 EAS Build ID: `734ffa97-8da4-4764-b35f-d04b83356f2a`

### 3.2 Backend & Inteligência Artificial (`backend/`)
* **Runtime & Servidor:** Node.js com Express (executando na porta `3001`).
* **Banco de Dados:** SQLite (`backend/app.db`) gerido via driver leve com índices específicos para `family_core_id` e `device_id`.
* **Comunicação em Tempo Real:** Socket.io com isolamento por salas seletivas:
  * `family_${familyCoreId}`: Notificações de alterações na lista e snapshots de menor preço compartilhados.
  * `device_${deviceId}`: Notificações direcionadas ao aparelho (ex: revogação de acesso).
* **Gestão Segura de Credenciais:** Carregamento nativo de `.env` (`process.loadEnvFile()`) do Node.js v24. Chave Gemini lida com prioridade de `process.env.GEMINI_API_KEY`, mantendo o banco de dados livre de segredos expostos.
* **Cadeia de Modelos Gemini:** SDK oficial `@google/genai` com modelo primário `gemini-3.8-flash` e fallbacks automáticos em caso de 429/503 (`gemini-3.5-flash-lite`, `gemini-3.6-flash`, `gemini-3.5-flash`).
* **Limpeza Automática Semanal:** Rotina cron interna executada aos domingos a partir das 22h00 (`checkAndRunSundayPurge`), expurgando encartes e ofertas expiradas da semana.
* **Ambiente em Nuvem / Produção:** Hospedado em máquina virtual da **Oracle Cloud Always Free** (`http://204.216.176.48:3001`), acompanhado por dashboard do robô pescador ARM 24/7 em `/robo`.

### 3.3 Site Institucional & B2B (`frontend/`)
* **Tecnologia:** React 19 + Vite (porta `5173`).
* **Estilização:** Vanilla CSS modular de alta fidelidade visual inspirado na **Nubank**:
  * Paleta 90% monocromática (branco puro `#ffffff`, cinza seda `#f8fafc`, grafite profundo `#0f172a`).
  * Acento cirúrgico em verde esmeralda (`#059669` / `#10b981`) reservado para CTAs, selos de *Oferta Real* e destaques.
  * Seção B2B em ardósia/obsidian escuro (`#090d16`) estilo *Nu PJ / Ultravioleta*.
* **Portal do Lojista:** Modal interativo conectado em tempo real com `POST /api/retail/offers` para cadastro de ofertas patrocinadas por supermercados da cidade.

---

## 4. 👨‍👩‍👧 CORE FAMILIAR & SINCRONIZAÇÃO OFFLINE-FIRST

O Core Familiar foi desenvolvido com base estrita na especificação [mercadofacil_core_familiar_especificacao-1.md](file:///c:/Users/allan/OneDrive/Área de Trabalho/lista de compras/mercadofacil_core_familiar_especificacao-1.md):

### 4.1 Regras de Acesso e Limites
* **Capacidade Máxima:** Exatamente **1 titular financeiro + até 2 aparelhos secundários** (total máximo de 3 aparelhos simultâneos). Qualquer tentativa de entrada de um 4º aparelho é rejeitada pelo backend com HTTP 403 (`max_devices_exceeded`).
* **Convite por QR Code / Código:** O titular gera convite com validade de 24 horas. Ao escanear o QR Code, o novo aparelho é vinculado instantaneamente ao Core.
* **Saída e Revogação:** 
  * Membros secundários podem sair voluntariamente a qualquer momento (`POST /api/family/core/:coreId/leave`).
  * O titular pode revogar o acesso de qualquer secundário via painel. O aparelho revogado recebe alerta e pode optar entre **manter cópia local** ou **descartar** a lista.
  * O titular é **estritamente bloqueado** de sair do Core sem antes cancelar formalmente a assinatura financeira.

### 4.2 Protocolo de Sincronização & Resolução de Conflitos
* **Fila Idempotente (`SyncQueueService`):** Toda ação na lista (adicionar, editar quantidade, alterar status de comprado) gera um `operation_id` único gravado localmente no aparelho. Ao recuperar a internet, a fila é enviada em lote via `POST /api/family/core/:coreId/list/operations`.
* **Versionamento Monotônico:** O backend mantém um contador sequencial `list_version`. Clientes reconectando baixam apenas mudanças delta via `GET /api/family/core/:coreId/list/changes?afterVersion=N`.
* **Detecção de Conflitos de Quantidade:** Se dois aparelhos alterarem offline a quantidade do mesmo item, o backend detecta o conflito e o app exibe um **modal consensual** para que o usuário escolha qual quantidade preservar.
* **Mesclagem Automática de Duplicatas:** Se dois membros adicionarem produtos equivalentes enquanto desconectados, o sistema unifica os itens somando as quantidades.
* **Algoritmo "Lowest Price Wins":** Quando um membro da família audita um encarte e descobre um preço menor para um produto da lista, esse snapshot de oferta mais barata é propagado via WebSocket e atualizado na lista de todos os familiares.

---

## 5. 🛡️ AUDITORIA DE ENCARTES (IA) & DEFESAS ANTI-FRAUDE

### 5.1 Trava de Segurança do Gemini (Detecção de Fotos Aleatórias)
* O prompt estruturado exige a flag booleana `is_valid_flyer`.
* Se o usuário enviar uma foto de comida, selfie, animal, ambiente, cupom avulso ou objeto qualquer que não seja claramente um encarte promocional impresso de supermercado com ofertas legíveis, o Gemini rejeita com `is_valid_flyer: false`.
* O backend descarta imediatamente o payload com erro 400 (`is_not_flyer: true`), sem gravar nenhum registro no banco de dados.

### 5.2 Dupla Trava Anti-Duplicidade de Encartes
Para economizar requisições à IA e manter o banco leve:
1. **Camada 1 (Pré-IA - Hash SHA-256):** O backend calcula o hash do arquivo binário. Se o mesmo encarte já foi enviado para aquele dispositivo, a requisição é rejeitada de imediato (HTTP 409).
2. **Camada 2 (Pós-IA - Similaridade Semântica de Ofertas):** A função `checkDuplicateOffersForSupermarket` compara as ofertas recém-extraídas com os encartes ativos do mesmo supermercado. Se mais de 60% das ofertas ou mais de 8 ofertas forem idênticas, o encarte é considerado repetido e descartado.

### 5.3 Calibração Realista do Termômetro de Ofertas
A calibração do varejo brasileiro foi ajustada para refletir margens de supermercado reais:
* 🟢 **Super Oferta:** Desconto real **>= 22%** em relação ao preço habitual de prateleira na microrregião.
* 🟡 **Preço Normal:** Desconto entre **5% e 21%** (promoções comuns de folheto).
* ⚪ **Preço Comum / Falsa Promoção:** Desconto **< 5%** (itens sem desconto real ou com preço inflado).

### 5.4 Isolamento Estrito de Encartes por Aparelho
A lista de compras compartilhada pertence ao Core Familiar, mas os encartes enviados pertencem estritamente ao `device_id` de quem os fotografou, garantindo privacidade e evitando sobrecarga nos outros dispositivos.

---

## 6. 💰 MODELO DE NEGÓCIOS & MONETIZAÇÃO

| Modalidade | Público | Formato Comercial | Descrição & Regras de Negócio |
| :--- | :--- | :--- | :--- |
| **Freemium** | Consumidor Geral | Gratuito | Acesso completo a listas, encartes locais e cálculo estimado com exibição de anúncios discretos. |
| **Sem Anúncios** | Consumidor Individual | **R$ 3,99 (Compra Única)** | Pagamento único vitalício na Google Play / App Store com suporte a restauração (`restorePurchases`). Permanece ativo mesmo se o usuário posteriormente assinar e cancelar o Core Familiar. |
| **Core Familiar** | Famílias (B2C) | **R$ 5,99 / mês (Assinatura)** | 1 titular financeiro e até 2 dependentes sincronizados (3 aparelhos). Todos recebem navegação sem anúncios, sincronização de listas em nuvem e alerta de melhor preço. |
| **MercadoFácil Business** | Supermercados (B2B) | **R$ 149 a R$ 299 / mês** | Plataforma SaaS para supermercados e hortifrutis publicarem encartes digitais, promoções relâmpago de 24h e liquidação de perecíveis com validade próxima diretamente para clientes de sua cidade. **0% de comissão sobre vendas físicas**. |

### 6.1 Ciclo de Vida da Assinatura Familiar (Máquina de Estados)
* **`ACTIVE`:** Assinatura em dia, sincronização e remoção de anúncios operando nos 3 aparelhos.
* **`CANCELED_PENDING_EXPIRY`:** Titular cancelou a renovação. O Core mantém todos os benefícios ativos até a data final do ciclo de 30 dias já pagos.
* **`EXPIRED`:** Ciclo encerrou sem pagamento. A sincronização em nuvem é bloqueada, mas **os dados são mantidos em quarentena por 30 dias**. Se o titular reativar nesse período, todos os dados voltam sem perdas.
* **`PURGED`:** Após 30 dias de expiração sem reativação, o Core e suas conexões são arquivados permanentemente.

---

## 7. 🧪 SUÍTE DE TESTES AUTOMATIZADOS (100% APROVADA)

O projeto conta com uma cobertura rigorosa de testes de integração e unitários:

### Testes do Backend (`backend/tests/`):
* **`family_core_spec_tests.mjs` (10 Cenários da Seção 33):**
  1. Criação do Core pelo titular com limite de 3 aparelhos.
  2. Entrada do 2º e 3º aparelho via código de convite / QR Code.
  3. Bloqueio estrito da tentativa de entrada de um 4º aparelho.
  4. Sincronização offline-first idempotente e numeração monotônica.
  5. Mesclagem automática de duplicatas concorrentes offline.
  6. Detecção e conciliação de conflitos concorrentes de quantidade.
  7. Cancelamento pelo titular e retenção de benefícios até o término do ciclo.
  8. Expiração e reativação garantida dentro da janela de retenção de 30 dias.
  9. Saída voluntária de membro secundário e bloqueio de saída do titular.
  10. Expiração definitiva após o período de quarentena de 30 dias.
* **`monetization_api_tests.mjs` (4 Cenários):**
  1. Entitlements inicial gratuito.
  2. Compra única vitalícia de remoção de anúncios.
  3. Criação de Core e restrição de 3 dispositivos.
  4. Consulta regionalizada de ofertas B2B por UF e Cidade.

### Testes do Mobile (`mobile/tests/`):
* **`monetization_unit_tests.mjs` (16 Cenários):** Testes unitários para entitlements offline, resiliência de falhas no AdMob, compras duplicadas e regras comerciais.

---

## 8. 🌐 ENDPOINTS DA API BACKEND (`porta 3001`)

### Encartes & Ofertas:
* `POST /api/flyers/upload-base64` — Envio de encarte em base64 com rate-limiting, trava anti-spam e checagem anti-duplicidade.
* `GET /api/flyers` — Listagem de encartes vigentes escopados por aparelho (`deviceId`).
* `GET /api/flyers/:id/base64` — Retorna dados em base64 para visualização no app sem falhas de rede.
* `DELETE /api/flyers/:id` — Remoção manual de encarte e suas ofertas auditadas.
* `DELETE /api/flyers` — Limpeza total de encartes do aparelho.

### Core Familiar & Sincronização:
* `POST /api/family/core` — Criação do Core Familiar pelo titular financeiro.
* `POST /api/family/invite` — Geração de código de convite / QR Code com expiração em 24h.
* `POST /api/family/join` — Entrada de membro secundário via código/QR Code.
* `POST /api/family/core/:coreId/list/operations` — Enfileiramento e execução idempotente de operações offline-first.
* `GET /api/family/core/:coreId/list/changes` — Sincronização incremental com base na versão monotônica (`afterVersion`).
* `POST /api/family/core/:coreId/cancel` — Cancelamento da renovação com manutenção de benefícios até o vencimento.
* `POST /api/family/core/:coreId/reactivate` — Reativação durante a janela de retenção de 30 dias.
* `POST /api/family/core/:coreId/leave` — Saída voluntária de membro secundário.

### Configurações & Localização:
* `GET /api/settings` — Consulta configurações regionais e status da chave Gemini.
* `POST /api/settings` — Atualização de cidade base e chave pessoal do usuário.
* `POST /api/settings/test-key` — Validação em tempo real da conexão com a API do Google Gemini.
* `GET /api/locations/cities` — Busca de cidades brasileiras indexadas por UF com base na base oficial do IBGE.

---

## 9. 🚀 COMO EXECUTAR O AMBIENTE

### 1. Iniciar o Backend
```bash
cd backend
npm install
npm start
# Executa em http://localhost:3001
# Dashboard do robô e status: http://localhost:3001/robo
```

### 2. Iniciar o Portal Web (Frontend)
```bash
cd frontend
npm install
npm run dev
# Executa em http://localhost:5173
```

### 3. Iniciar o Aplicativo Mobile
```bash
cd mobile
npm install
npx expo start --lan
# Escaneie o QR Code no app Expo Go (Android / iOS)
```

### 4. Rodar a Bateria de Testes
```bash
cd backend
node tests/monetization_api_tests.mjs
node tests/family_core_spec_tests.mjs
```

---

## 10. 🎯 PRÓXIMOS PASSOS NO ROADMAP

1. **Testes do APK Standalone em Aparelho Físico:** Validar a instalação e o fluxo completo do Core Familiar (emparelhamento por QR Code entre múltiplos celulares e lista offline).
2. **Leitor de Encartes no Portal B2B:** Permitir que o supermercado faça upload do encarte em PDF direto pelo navegador e o sistema sugira produtos e preços auditados via Gemini para aprovação do lojista.
3. **Migração Supabase (Produção Nuvem):** Migrar o banco SQLite local para PostgreSQL em nuvem no Supabase para suporte a múltiplos núcleos em grande escala.
4. **Deploy Automático CI/CD:** Configurar GitHub Actions para rodar a suíte de testes automaticamente em cada push para o repositório oficial.
