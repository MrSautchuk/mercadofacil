# 🛒 MERCADOFÁCIL — CONTEXTO GERAL E FUNCIONALIDADES DO APP

> **Documento de Contexto do Projeto**  
> *Aplicação: MercadoFácil (Lista de Compras Inteligente & Ecossistema de Varejo Local)*  
> *Objetivo deste documento: Servir como base de conhecimento contínua para o Gemini/IA retomar o desenvolvimento com exatidão.*

---

## 1. 📌 VISÃO GERAL & PROPOSTA DE VALOR

O **MercadoFácil** é uma plataforma e ecossistema de compras de supermercado projetado para conectar consumidores e varejistas locais. Ele une inteligência artificial, auditoria de preços e colaboração familiar para eliminar desperdício de dinheiro e tempo nas compras domésticas.

### O Problema que Resolve:
1. **Promoções Ilusórias:** Consumidores perdem dinheiro com encartes que anunciam preços de gôndola habitual como se fossem grandes descontos.
2. **Desorganização Familiar:** Listas em papel ou WhatsApp geram compras duplicadas, esquecimentos e estouro de orçamento no caixa.
3. **Desperdício e Custo no Varejo:** Supermercados de bairro gastam fortunas imprimindo folhetos de papel que vão para o lixo e têm dificuldade para liquidar itens perecíveis perto do vencimento.

### Os Cinco Pilares:
1. **Economia Real:** Auditoria de encartes identificando se o desconto é verídico.
2. **Confiança e Transparência:** Classificação objetiva entre *Oferta Real*, *Preço Normal* e *Preço Comum*.
3. **Praticidade Extrema:** Criação de listas com auto-complete rápido e soma automática estimada.
4. **Colaboração Familiar:** Sincronização em tempo real entre membros da casa (Core Familiar).
5. **Tecnologia Útil:** Leitura de folhetos físicos e digitais via câmera/foto usando Inteligência Artificial (Gemini).

---

## 2. 🏗️ ARQUITETURA TÉCNICA E STACK

O projeto é dividido em três frentes principais:

```
lista de compras/
├── backend/                  # API REST em Node.js + Express + SQLite + Gemini
├── mobile/                   # App Mobile React Native (Expo SDK 57, React 19)
├── frontend/                 # Portal Web Institucional e B2B (React 19 + Vite)
├── .agents/                  # Memória persistente, regras e workflows da IA
└── CONTEXTO_PROJETO.md       # Arquivo de contexto local detalhado
```

### 2.1 Backend (`backend/`)
- **Runtime & Framework:** Node.js com Express (rodando na porta `3001`).
- **Banco de Dados:** SQLite (`backend/app.db`) local e performático.
- **Integração com IA:** SDK oficial `@google/genai` utilizando modelos `gemini-2.5-flash` / `gemini-2.5-flash-lite`.
- **Upload Resiliente:** Endpoint `POST /api/flyers/upload-base64` com suporte a payloads de até 35MB em JSON base64.
- **Rotina de Limpeza Automática:** Cron interno que roda aos domingos a partir das 22h00 (`checkAndRunSundayPurge`), expurgando encartes e ofertas expiradas da semana para manter o banco enxuto.

### 2.2 Mobile (`mobile/`)
- **Framework:** React Native com Expo (SDK 57, React 19, React Native 0.86).
- **Execução:** Suporte total ao Expo Go via `npx expo start --lan`.
- **Persistência Local:** `AsyncStorage` para armazenar cesta de compras, tema ativo e preferências locais.
- **Upload de Imagens:** Leitura de arquivos via `expo-file-system/legacy` (`FileSystem.readAsStringAsync`) em base64 com fallback universal para `FileReader`.
- **Design System do App:**
  - **Tema Escuro (Padrão/Inventário):** Fundo `#0d1410`, cartões `#131f19`, detalhes em verde-limão `#4ade80`/`#22c55e`.
  - **Tema Claro (Alternável):** Fundo `#f1f5f3`, cartões `#ffffff`, texto escuro `#0f172a`.
  - **Header Inteligente:** Indicadores de *Ofertas*, *Normal* e *Comum* visíveis nas abas Cesta e Encartes, ocultados na aba Ajustes.

### 2.3 Portal Institucional & Lojista B2B (`frontend/`)
- **Framework:** React 19 + Vite (rodando na porta `5173`).
- **Estilização:** CSS Vanilla puro, modular, com design editorial inspirado no estilo **Nubank** (fundo limpo, tipografia expressiva e acentos em verde esmeralda).
- **Portal do Lojista:** Modal interativo que permite aos supermercados cadastrarem ofertas relâmpago diretamente no backend via `POST /api/retail/offers`.

---

## 3. 📱 FUNCIONALIDADES DO APLICATIVO MOBILE

### 3.1 🧺 Aba "Cesta de Compras"
- **Adição Direta por Autocomplete:** Digitação com sugestões rápidas de itens comuns de supermercado (`COMMON_SUPERMARKET_ITEMS`). O clique na sugestão já adiciona o item diretamente à cesta (sem botão extra desnecessário).
- **Controle de Quantidade e Check-off:** Botões para alterar quantidade, marcar item como comprado (riscado) e remover.
- **Cálculo Estimado em Tempo Real:** Mostra o valor total estimado da compra com base nos preços auditados ou valores de referência.
- **Badges de Preço:** Indica se aquele item da lista está em *Super Oferta*, *Preço Normal* ou *Comum* na praça local.

### 3.2 📰 Aba "Encartes & Folhetos"
- **Digitalização por Foto ou Galeria:** O usuário tira foto do encarte de papel ou envia imagem/PDF da galeria.
- **Auditoria Inteligente (Gemini):** A IA extrai:
  - Nome do supermercado e período de validade.
  - Lista completa de produtos, marcas e unidades de medida (kg, 100g, un, litro).
  - Preço anunciado vs. Preço regular estimado de gôndola na microrregião.
  - Selo de classificação: *Super Oferta* (desconto real >= 12%) ou *Preço Normal*.
- **Histórico de Encartes Vigentes:** Lista de todos os folhetos ativos da semana cadastrados na cidade.

### 3.3 ⚙️ Aba "Ajustes & Configurações"
- **Alternância de Tema:** Toggle rápido entre Tema Escuro e Tema Claro.
- **Configuração de Cidade/Microrregião:** Seleção da praça de compras (atualmente calibrado com dados piloto de **Olímpia - SP**).
- **Gerenciamento de Assinatura / Plano:** Informações sobre o plano ativo (Sem Anúncios, Core Familiar).

---

## 4. 🧠 REGRAS DE NEGÓCIO E DECISÕES TÉCNICAS CRÍTICAS (ADRs)

1. **Trava de Segurança Anti-Spam do Gemini:**
   - O prompt exige a flag booleana `is_valid_flyer`. Se o usuário fotografar um objeto que não seja um encarte promocional impresso de supermercado, o Gemini retorna `is_valid_flyer: false` e ofertas vazias.
   - O backend rejeita a requisição com erro HTTP 400 (`is_not_flyer: true`), impedindo gravação de registros "fantasmas" no SQLite.
   - O app exibe alerta amigável: *"⚠️ Isso não é um Encarte!"*.

2. **Calibração Microrregional e Unidades Exatas:**
   - Evita distorções de escala (ex: Alho por 100g vs Alho por kg).
   - O Gemini recebe a cidade base (`Olímpia - SP`) e calibra o preço de referência habitual daquela microrregião.

3. **Upload Compatível com Expo SDK 54+:**
   - O uso de `multipart/form-data` no Expo Go quebrava no Android.
   - A leitura do arquivo é feita em base64 usando o módulo legado `expo-file-system/legacy`, garantindo compatibilidade síncrona/assíncrona sem falhas de runtime.

4. **Expurgo Semanal de Domingo (22h):**
   - Encartes de supermercado perdem a validade no fim de semana.
   - O backend limpa automaticamente ofertas antigas aos domingos às 22h para não poluir buscas futuras.

---

## 5. 💰 MODELO DE MONETIZAÇÃO DO PROJETO

1. **Plano Gratuito (Freemium):** Uso irrestrito de listas e leitura de encartes com exibição de anúncios discretos.
2. **Plano Sem Anúncios (R$ 3,99 - Pagamento Único):** Compra avulsa vitalícia (Play Store / App Store) que remove anúncios para sempre, com suporte a `restorePurchases`.
3. **Core Familiar (R$ 5,99 / mês):** 1 titular + até 2 dependentes sincronizados em tempo real via código de 6 dígitos (validade 24h). Todos os 3 aparelhos ganham navegação sem anúncios.
4. **MercadoFácil Business B2B (R$ 149 a R$ 299 / mês):** SaaS para supermercados locais publicarem encartes digitais, promoções de 24h e liquidações de perecíveis direto para os clientes da cidade, com **0% de comissão sobre vendas**.

---

## 6. 🌐 ENDPOINTS DA API BACKEND (`http://localhost:3001`)

- `POST /api/flyers/upload-base64`: Envio de imagem/PDF em base64 para processamento via Gemini.
- `GET /api/flyers`: Lista todos os encartes ativos cadastrados.
- `GET /api/offers`: Retorna todas as ofertas extraídas e auditadas.
- `GET /api/retail/offers`: Retorna ofertas cadastradas diretamente por supermercados parceiros (B2B).
- `POST /api/retail/offers`: Cadastro de novas ofertas pelo Portal do Lojista.

---

## 7. 🚀 COMANDOS PARA INICIAR O AMBIENTE

- **Backend:**
  ```bash
  cd backend && npm start
  # Porta 3001
  ```
- **Mobile (Expo):**
  ```bash
  cd mobile && npx expo start --lan
  # Escanear QR Code no app Expo Go
  ```
- **Frontend Institucional (Web):**
  ```bash
  cd frontend && npm run dev
  # Porta 5173
  ```

---

## 8. 🎯 PRÓXIMOS PASSOS NO ROADMAP (ONDE PARAMOS)

1. **Build do APK Android:** Configuração e geração do binário standalone via EAS Build (`eas build -p android --profile preview`).
2. **Sincronização em Nuvem (Supabase):** Implementação das tabelas de autenticação e sincronização em tempo real para os grupos do Core Familiar.
3. **Leitor Automático de Encartes no Portal B2B:** Permitir que o supermercado envie o encarte no portal web e o Gemini preencha as ofertas automaticamente para aprovação do lojista.
4. **Integrações de Design (Figma MCP):** Integração ativa via MCP com Figma para sincronizar novos componentes e tokens visuais.
