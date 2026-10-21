# CONTEXTO GERAL DO PROJETO — MERCADOFÁCIL

> **Documento Consolidado de Arquitetura, Regras de Negócio, Decisões Técnicas e Design System**  
> *Última atualização: Outubro de 2026*

---

## 1. VISÃO GERAL & PROPOSTA DE VALOR

O **MercadoFácil** é uma plataforma e ecossistema de compras de supermercado projetado para conectar consumidores e varejistas locais, trazendo transparência, economia e praticidade para o planejamento doméstico.

### O Problema que Resolve
- Consumidores perdem dinheiro e tempo tentando decifrar quais promoções impressas são reais e quais são preços habituais de prateleira.
- Listas de compras em papel ou mensagens de WhatsApp geram compras duplicadas, esquecimentos e estouro de orçamento no caixa.
- Supermercados locais e regionais gastam fortunas imprimindo encartes de papel com distribuição ineficiente e têm dificuldade para liquidar itens perecíveis perto do vencimento.

### Os Cinco Pilares da Marca
1. **Economia Real:** Identificação de descontos autênticos sem promessas milagrosas.
2. **Confiança & Transparência:** Diferenciação clara entre *Oferta*, preço *Normal* e preço *Comum*, baseada em dados públicos e histórico regional.
3. **Praticidade:** Criação rápida de listas por categorias com cálculo estimado automático.
4. **Colaboração Familiar:** Sincronização em tempo real para famílias (Core Familiar).
5. **Tecnologia Útil para o Dia a Dia:** OCR e IA para ler encartes digitalizados sem complicação.

---

## 2. ESTRUTURA DO REPOSITÓRIO

O repositório é organizado em uma estrutura modular:

```
lista de compras/
├── backend/                  # API REST em Node.js / Express
│   ├── app.db                # Banco de dados SQLite local
│   ├── server.js             # Ponto de entrada, rotas e rotinas cron
│   └── package.json
│
├── mobile/                   # Aplicativo nativo em React Native (Expo)
│   ├── App.js                # Navegação por abas e estado central
│   ├── components/           # Telas de Cesta, Encartes, Ajustes e Modais
│   ├── package.json          # Expo SDK 57, React 19, React Native 0.86
│   └── app.json              # Configuração do Expo / EAS Build
│
├── frontend/                 # Portal institucional & comercial (Web)
│   ├── index.html            # Ponto de entrada HTML com meta tags SEO
│   ├── src/
│   │   ├── App.jsx           # Orquestração das seções institucionais
│   │   ├── App.css           # Estilização completa do Design System Nubank
│   │   ├── index.css         # Design tokens e tipografia global
│   │   └── components/       # Componentes modulares das 12 seções institucionais
│   ├── public/               # Ativos, fotos de varejo e capturas do app
│   └── package.json          # React 19 + Vite
│
├── .agents/                  # Configurações do agente de IA, regras e memória
│   ├── memory/               # MEMORY.md, project-conventions.md, tech-decisions.md
│   ├── rules/                # graphify.md e regras do workspace
│   └── workflows/            # Workflows operacionais
│
├── graphify-out/             # Grafo de conhecimento da base de código
├── CONTEXTO_PROJETO.md       # Este documento de referência
└── README.md                 # Visão geral rápida
```

---

## 3. ARQUITETURA TÉCNICA & STACK

### 3.1 Aplicativo Mobile (`mobile/`)
- **Framework:** React Native com Expo (SDK 57, React 19).
- **Gerenciamento de Estado:** React Hooks (`useState`, `useEffect`) integrados a armazenamento local persistente (`AsyncStorage`).
- **Upload de Arquivos & Imagens:** Leitura em Base64 via `expo-file-system/legacy` (`FileSystem.readAsStringAsync`) com fallback universal para `FileReader`. Essa arquitetura contorna incompatibilidades de `FormData/multipart` no Expo Go.
- **Identidade Visual Mobile:** Foco no tema escuro de inventário (`#0d1410` com acentos em verde-limão `#4ade80`), com suporte a tema claro alternável na aba de Ajustes.
- **Indicadores no Cabeçalho:** Faixa de 3 indicadores (*Ofertas*, *Normal*, *Comum*) exibida exclusivamente nas abas **Cesta** e **Encartes**, ocultada na aba **Ajustes**.

### 3.2 Backend & Inteligência Artificial (`backend/`)
- **Runtime:** Node.js com Express (executando na porta `3001`).
- **Banco de Dados Atual:** SQLite (`backend/app.db`) gerido via driver leve.
- **Integração com IA:** SDK oficial `@google/genai` com os modelos `gemini-2.5-flash` / `gemini-2.5-flash-lite`.
- **Validação de Encartes com Trava Anti-Spam:** Prompt estruturado que exige a flag `is_valid_flyer`. Se a foto não for um encarte/folheto promocional de supermercado com ofertas reais impressas, o backend descarta o payload com erro 400 (`is_not_flyer: true`), sem gravar nenhum registro no banco de dados.
- **Limpeza Semanal Automática:** Rotina cron interna executada aos domingos a partir das 22h00 (`checkAndRunSundayPurge`), expurgando encartes e ofertas vencidas para manter o banco leve.
- **Calibração Microrregional:** A cidade base (atualmente com piloto detalhado em **Olímpia - SP**) é injetada no prompt do Gemini, calibrando preços regulares por unidade exata de medida (ex: 100g vs. kg).

### 3.3 Site Institucional & B2B (`frontend/`)
- **Tecnologia:** React 19 + Vite (porta `5173`).
- **Estilização:** Vanilla CSS modular de alta performance, sem dependência pesada de frameworks utilitários.
- **Design Direction (Alinhamento Nubank):**
  - Paleta 90% monocromática (branco puro `#ffffff`, cinza seda `#f8fafc`, grafite profundo `#0f172a`).
  - Acento cirúrgico em verde esmeralda (`#059669` / `#10b981`) reservado para CTAs, selos de *Oferta Real* e destaques.
  - Hero editorial com tipografia display imponente centralizada e mockup em elevação suave.
  - Bento Grid assimétrico com micro-interfaces dinâmicas.
  - Seção B2B em ardósia/obsidian escuro (`#090d16`) estilo *Nu PJ / Ultravioleta*.
  - Transições físicas em mola nativa (`cubic-bezier(0.16, 1, 0.3, 1)`).

---

## 4. MODELOS DE NEGÓCIO & MONETIZAÇÃO

O MercadoFácil possui uma estratégia de monetização em 4 frentes coordenadas:

| Modalidade | Público | Formato Comercial | Descrição & Regras |
| :--- | :--- | :--- | :--- |
| **Freemium** | Consumidor Geral | Gratuito | Acesso completo a listas, encartes e cálculo com exibição de anúncios discretos. |
| **Sem Anúncios** | Consumidor Individual | **R$ 3,99 (Compra Única)** | Não é mensalidade. Pagamento único vitalício na Play Store / App Store com suporte a restauração de compra (`restorePurchases`). |
| **Core Familiar** | Famílias (B2C) | **R$ 5,99 / mês (Assinatura)** | 1 titular financeiro e até 2 aparelhos adicionais sincronizados via código de convite de 6 dígitos (validade de 24h). Todos os 3 aparelhos recebem navegação sem anúncios e sincronização em nuvem. |
| **MercadoFácil Business** | Supermercados (B2B) | **R$ 149 a R$ 299 / mês** | Plataforma SaaS para lojistas publicarem encartes digitais, ofertas relâmpago de 24h e saldão de perecíveis com validade próxima para consumidores da sua cidade. **0% de comissão sobre as vendas físicas**. |

---

## 5. DECISÕES TÉCNICAS CRÍTICAS (ADRs)

### ADR 01: Trava de Validação do Gemini contra Fotos Aleatórias
- **Motivação:** Usuários fotografando objetos comuns (como um mouse ou garrafa) geravam encartes fantasmas com nome `Supermercado Desconhecido`.
- **Solução:** Regra estrita no início do prompt. O Gemini precisa atestar `is_valid_flyer: true`. Caso contrário, a imagem é rejeitada sem persistência no banco.

### ADR 02: Resiliência de Upload Mobile via Base64
- **Motivação:** O manipulador padrão de `multipart/form-data` do Expo Go apresentava falhas no Android/iOS (`Unsupported FormDataPart`).
- **Solução:** Criado endpoint `POST /api/flyers/upload-base64` com limite de 35MB no Express. No Expo, o arquivo é lido diretamente em base64 usando `expo-file-system/legacy`.

### ADR 03: Separação de Identidade entre App Mobile e Site Institucional
- **Motivação:** O site institucional escuro parecia um template genérico de startup de tecnologia, desconectado do universo de varejo alimentar.
- **Solução:** O site institucional adotou uma base luminosa de altíssimo padrão inspirada na Nubank e em grandes redes supermercadistas, mantendo o tema escuro do aplicativo apenas dentro da moldura discreta do celular.

### ADR 04: Estratégia de Bancos de Dados (SQLite Local → Supabase Nuvem)
- **Motivação:** Fase inicial precisa de custo zero e funcionamento offline, mas o Core Familiar e o portal de lojistas exigem sincronização multi-dispositivo.
- **Solução:** O app opera em SQLite/AsyncStorage local no plano free; os recursos multi-dispositivo (Core Familiar e Business) foram desenhados para sincronização relacional em nuvem via Supabase (PostgreSQL).

---

## 6. ENDPOINTS E APIS EM OPERAÇÃO

### Backend (`http://localhost:3001`):
- `POST /api/flyers/upload-base64` — Processamento de encartes com OCR/Gemini.
- `GET /api/flyers` — Listagem de encartes vigentes por cidade/região.
- `GET /api/offers` — Ofertas auditadas da praça.
- `GET /api/retail/offers` — Consulta de ofertas do portal B2B.
- `POST /api/retail/offers` — Publicação de ofertas extraordinárias por lojistas.

### Frontend Institucional (`http://localhost:5173`):
- Landing page institucional completa com as 12 seções.
- Modal interativo do Portal do Lojista conectado em tempo real com `POST /api/retail/offers`.

---

## 7. COMO EXECUTAR O AMBIENTE DE DESENVOLVIMENTO

### 1. Iniciar o Backend
```bash
cd "c:\Users\allan\OneDrive\Área de Trabalho\lista de compras\backend"
npm install
npm start
# Executa em http://localhost:3001
```

### 2. Iniciar o Frontend Institucional
```bash
cd "c:\Users\allan\OneDrive\Área de Trabalho\lista de compras\frontend"
npm install
npm run dev
# Executa em http://localhost:5173
```

### 3. Iniciar o Aplicativo Mobile
```bash
cd "c:\Users\allan\OneDrive\Área de Trabalho\lista de compras\mobile"
npm install
npx expo start --lan
# Escaneie o QR Code no app Expo Go (Android / iOS)
```

---

## 8. PRÓXIMOS PASSOS NO ROADMAP

1. **Compilação do APK Android:** Gerar pacote autônomo para testes fora do Expo Go (`eas build -p android --profile preview`).
2. **Integração Supabase:** Ativar tabelas de autenticação e sincronização em tempo real para os membros do Core Familiar.
3. **Leitor OCR Automático no Portal B2B:** Permitir que o lojista suba o encarte em PDF direto pelo navegador e o sistema sugira os produtos e preços automaticamente via Gemini.
4. **Integração Figma MCP:** Conexão configurada para leitura e extração de layouts, tokens e design systems direto dos arquivos Figma.

---

## 9. CONFIGURAÇÕES MCP ATIVAS

- **Figma Remote MCP:** `https://mcp.figma.com/mcp` (Autenticação via OAuth interativo da IDE / navegador)
- **Figma Desktop MCP (Dev Mode):** `http://127.0.0.1:3845/mcp` (Fallback local via Figma Desktop com `Shift + D`)
- **Arquivos de Configuração:**
  - Global Antigravity: `C:\Users\allan\.gemini\config\mcp_config.json`
  - Workspace Antigravity: `.agents/mcp_config.json`
  - Workspace VS Code: `.vscode/mcp.json`

