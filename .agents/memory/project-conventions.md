---
type: project
created: 2026-10-11
updated: 2026-10-11
---

# Project Conventions — MercadoFácil

## Estrutura da Aplicação
- `backend/`: Servidor Express na porta 3001, SQLite (`app.db`), `@google/genai` (SDK oficial do Gemini).
- `mobile/`: App em React Native (Expo SDK 57, React 19, React Native 0.86), compatível com Expo Go no Android/iOS.
- `frontend/`: Interface Web em React + Vite (legada/alternativa na porta 5173).

## Convenções de Código e UI
1. **Tema Visual (Inventário)**:
   - Tema Escuro: Fundo `#0d1410`, cartões `#131f19`, detalhes em verde-limão `#4ade80`/`#22c55e`.
   - Tema Claro: Fundo `#f1f5f3`, cartões `#ffffff`, texto escuro `#0f172a`, bordas `#e2e8f0`.
   - Alternância de tema via switch no header e na aba Ajustes, persistido via `AsyncStorage` (`user_theme`).
2. **Cesta de Compras**:
   - Adição direta por clique/seleção na sugestão do dropdown (sem botão 'adicionar' avulso).
   - Validação de produtos contra `COMMON_SUPERMARKET_ITEMS` normalizados.
3. **Limpeza Semanal de Encartes**:
   - Rotina automática em `backend/server.js` executada todo domingo a partir das 22:00h (`checkAndRunSundayPurge`).
   - Remove registros de `flyers` e `offers` da semana para manter o banco limpo e atualizado.
