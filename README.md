# 🛒 SmartList Supermercado - Core de Economia & Análise de Encartes

Aplicativo moderno e sofisticado para lista de compras de supermercado com persistência em SQLite e **Core de Economia** potencializado pela IA do Google Gemini.

---

## 🌟 Funcionalidades Principais

1. **🛒 Minha Lista Inteligente:**
   - Adicione seus produtos habituais.
   - Os itens permanecem salvos em banco de dados local SQLite entre os acessos.
   - Ative ou desative itens com facilidade para sua próxima ida ao mercado.
   - **Destaque automático de promoções:** quando um item da sua lista está em oferta em algum encarte cadastrado, uma tag dourada/verde aparece com o preço e o nome do supermercado!

2. **📰 Core de Economia (Análise de Encartes com IA):**
   - Espaço para envio de folhetos e encartes semanais em PDF.
   - O Gemini analisa o PDF (visão computacional + inteligência multimodal) e extrai o nome do supermercado, todos os produtos e os preços.
   - Cruza automaticamente com os itens da sua lista e calcula correspondências.
   - Filtro para ver apenas as ofertas que interessam à sua lista.

3. **⚙️ BYOK (Bring Your Own Key) & Tutorial Integrado:**
   - Cada usuário utiliza a sua própria chave gratuita do Google AI Studio.
   - Sem custos de servidor para o criador do app.
   - Tutorial passo a passo dentro do próprio aplicativo com link direto para [Google AI Studio](https://aistudio.google.com/app/apikey).
   - Botão para testar e validar a conexão com a API na hora.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:** React, Vite, Vanilla CSS com Design System próprio (Dark Mode com Glassmorphism).
- **Backend:** Node.js, Express, Multer, `@google/genai`.
- **Banco de Dados:** SQLite (com tabelas `items`, `flyers`, `offers` e `settings`).

---

## 🚀 Como Rodar o Projeto

### 1. Iniciar o Backend
```bash
cd backend
node server.js
```
*O servidor iniciará em `http://localhost:3001`.*

### 2. Iniciar o Frontend
```bash
cd frontend
npm run dev
```
*O aplicativo estará disponível em `http://localhost:5173`.*
