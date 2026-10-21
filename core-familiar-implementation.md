# Plano de Implementação — MercadoFácil: Core Familiar
> Baseado estritamente na especificação técnica `mercadofacil_core_familiar_especificacao-1.md`

## 1. Auditoria e Diagnóstico da Arquitetura Atual
- **Banco de Dados (Backend)**: SQLite em `backend/app.db`, gerenciado por `backend/database.js`. Tabelas existentes: `items`, `family_cores`, `family_devices`, `family_invitations`, `accounts`, `purchases`.
- **Rotas de Negócio**: `backend/monetizationRoutes.js` (entitlements, billing, convites, gerenciamento de dispositivos) e `backend/server.js` (itens da lista, WebSocket, upload de encartes).
- **Mobile (React Native/Expo)**: `mobile/App.js`, `mobile/src/domain/family/FamilyCoreService.js`, `mobile/src/domain/family/useFamilySync.js`, `mobile/src/domain/entitlements/EntitlementEngine.js`.
- **WebSocket**: Socket.io no backend com salas `family_${familyCoreId}` e `device_${deviceId}`.

## 2. Mapa de Fases de Execução

### Fase 1: Extensão do Modelo de Dados & Migrations Seguras (Backend)
- Adicionar colunas e tabelas necessárias no SQLite:
  - `family_cores`: `canceled_at`, `expired_at`, `purge_at`, `list_version`
  - `items`: `version`, `purchased` (mapeado com `is_active`), `canonical_product_id`
  - Nova tabela `sync_operations` para idempotência e auditoria de sincronização.
- Preservar integridade de todas as tabelas já existentes sem perda de dados.

### Fase 2: Autorização, Ciclo de Vida da Assinatura e Retenção de 30 Dias (Backend)
- Implementar máquina de estados da assinatura:
  - `ACTIVE` -> `CANCELED_PENDING_EXPIRY` (mantém benefícios até fim do período) -> `EXPIRED` (bloqueia benefícios e lista, mantém dados por 30 dias) -> `PURGED` (após 30 dias).
- Endpoints:
  - `POST /api/family/core/:coreId/cancel` (cancelar renovação)
  - `POST /api/family/core/:coreId/reactivate` (reativar dentro dos 30 dias)
  - `POST /api/family/core/:coreId/leave` (saída voluntária de membro)
  - `POST /api/family/core/recover` (recuperação do Core pelo responsável em outro dispositivo)
  - Validação estrita de autorização em todas as operações da lista e do core.

### Fase 3: Protocolo de Sincronização Monotônica, Idempotência e Conflitos (Backend)
- Endpoint `POST /api/family/core/:coreId/list/operations`:
  - Recebe lista de operações locais com `operation_id` (idempotência).
  - Incrementa versão monotônica da lista (`list_version`).
  - Detecta conflitos de quantidade em edições concorrentes.
  - Detecta e mescla itens duplicados (mesmo nome/produto adicionados offline).
  - Emite notificações WebSocket em tempo real para os demais membros.
- Endpoint `GET /api/family/core/:coreId/list/changes?afterVersion=N`:
  - Retorna mudanças ocorridas após a versão conhecida pelo cliente (reconexão rápida).

### Fase 4: Persistência Offline-First e Fila de Sincronização (Mobile)
- Criar serviço `SyncQueueService` no mobile:
  - Persistência em armazenamento local resiliente (`AsyncStorage` / SQLite local).
  - Grava operações pendentes com `operation_id` único, timestamp, tipo de operação.
  - Sobrevive ao fechamento do app e reinício do celular.
  - Processa a fila automaticamente quando houver conexão com o backend.
  - Suporte a retry exponencial e atualização de versão monotônica local.

### Fase 5: UX, Conflitos, Dois Cliques e Indicador Discreto (Mobile)
- Separar rigorosamente os dois cliques no item:
  - Clique no corpo: alternar status comprado (`purchased`).
  - Clique no ícone de lápis/edição: abrir edição de nome, quantidade, marca.
- Modal de Resolução de Conflitos quando o backend acusar conflito de quantidades concorrentes.
- Indicador de Sincronização minimalista conforme ADR-012:
  - Exibe "Sincronizando..." enquanto houver operações na fila.
  - Exibe "Sem conexão" quando offline.
  - Oculto quando sincronizado.
- Diálogo de saída/remoção do Core oferecendo preservar cópia local da lista ou descartar.

### Fase 6: Bateria Completa de Testes Automatizados (Backend e Mobile)
- Testes unitários e de integração cobrindo a matriz de testes da Seção 33:
  1. Criação e recuperação do Core pelo titular.
  2. Entrada via QR Code temporário e bloqueio de limite de 3 aparelhos.
  3. Adição, edição e marcação de comprado online e offline.
  4. Fila offline e idempotência (envio repetido de operação).
  5. Detecção de conflito e mesclagem de produtos duplicados.
  6. Remoção de membro e saída voluntária com revogação imediata.
  7. Cancelamento de renovação com retenção até o término do ciclo.
  8. Expiração e reativação em até 30 dias.
  9. Regras de anúncio e benefícios (preservação de compra vitalícia).
  10. Bloqueio de titular tentando sair sem cancelar.

### Fase 7: Build do APK Standalone no Expo EAS
- Executar `eas build -p android --profile preview` no mobile.
- Validar conclusão da build e fornecer o link direto do APK para o usuário.
