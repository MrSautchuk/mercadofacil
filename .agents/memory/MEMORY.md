# Memory Index — MercadoFácil (Lista de Compras Inteligente)

## Project
- [project] MercadoFácil: App mobile em React Native Expo + backend Node.js Express e SQLite → project-conventions.md
- [project] Auditoria de encartes com Gemini 3.5 Flash Lite e calibração por microrregião → tech-decisions.md
- [project] Trava de segurança no Gemini descarta fotos que não sejam encartes sem cadastrar no banco → tech-decisions.md
- [project] Bloqueio duplo de encartes duplicados por SHA-256 (pre-IA) e similaridade semântica de ofertas → tech-decisions.md
- [project] Calibração rigorosa de Super Oferta (>=22% de desconto real) e Preço Normal (5% a 21%) → tech-decisions.md
- [project] Unificação da terminologia Cesta para Minha Lista em todo o app e portal → tech-decisions.md
- [project] Upload resiliente em base64 usando expo-file-system/legacy para Android e iOS → tech-decisions.md
- [project] Limpeza automática de encartes aos domingos 22:00h configurada no backend → project-conventions.md
- [project] Leitor de QRCode com permissão ativa, mira óptica centralizada e laser guia animado → tech-decisions.md
- [project] Sanitização recursiva anti-vazamento de JSON na padronização de produtos por IA → tech-decisions.md
- [project] Encartes estritamente locais salvos no dispositivo por device_id (sem compartilhamento externo) → tech-decisions.md
- [project] Sincronização em tempo real das listas do Core Familiar (3 dispositivos) via WebSocket → tech-decisions.md
- [project] Core Familiar offline-first com fila idempotente, resolução de conflitos e retenção de 30 dias (Seção 33) → tech-decisions.md
- [project] Suíte de 27 testes automatizados cobrindo monetização, B2B e Core Familiar 100% aprovada → tech-decisions.md
- [project] Build Android Standalone APK gerada com sucesso via Expo EAS Preview (SDK 57) → tech-decisions.md

## User Preferences
- [user] Preferência por tema escuro inspirado em apps de inventário de supermercado (com suporte a tema claro alternável) → project-conventions.md
- [user] Adição de itens na lista direta pela seleção no dropdown/autocomplete sem botão avulso → project-conventions.md
- [user] Cidade base do usuário configurada para Olímpia - SP (microrregião) → tech-decisions.md

## Architecture & Conventions
- [architecture] Backend na porta 3001 com SQLite em `backend/app.db` → project-conventions.md
- [architecture] Mobile em `mobile/` com SDK 57, safe-area-context e branch `fix/json-sync-and-duplicates` → tech-decisions.md
- [architecture] Endpoint `/api/flyers/upload-base64` com limite de 35MB para tráfego móvel → tech-decisions.md
- [architecture] Salas WebSocket `family_${familyCoreId}` e `device_${deviceId}` para sincronização seletiva → tech-decisions.md
- [architecture] Fila offline-first `SyncQueueService` com persistência local no AsyncStorage e sync monotônico → tech-decisions.md
- [architecture] Compilação nativa Android no EAS com `usesCleartextTraffic: true` para testes HTTP → tech-decisions.md
- [architecture] Chave Gemini protegida fora do Git com expurgo do app.db, suporte nativo a .env e .gitignore reforçado → tech-decisions.md
- [architecture] Repositório oficial GitHub sincronizado em https://github.com/MrSautchuk/mercadofacil (branch main) → tech-decisions.md
