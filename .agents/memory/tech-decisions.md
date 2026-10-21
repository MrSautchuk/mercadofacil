---
type: tech-decisions
created: 2026-10-11
updated: 2026-10-11
---

# Technical Decisions — MercadoFácil

## 1. Trava de Segurança contra Fotos Aleatórias (Gemini)
- **Problema**: Ao tirar fotos pela câmera de ambientes, objetos ou itens aleatórios, o sistema criava encartes com `supermarket_name: 'Desconhecido'` e poluía o banco.
- **Decisão**: 
  - Regra mandatória no início do prompt do Gemini: checar `is_valid_flyer`. Se não for folheto/cartaz promocional de supermercado com ofertas impressas, retornar `is_valid_flyer: false`, `supermarket_name: null`, `offers: []`.
  - Backend verifica `parsedResult.is_valid_flyer === false` ou `offers.length === 0` e lança erro 400 (`is_not_flyer: true`) sem gravar absolutamente nada no SQLite.
  - Front mobile exibe alerta explicativo: *"⚠️ Isso não é um Encarte!"* e descarta a imagem.

## 2. Upload de Arquivos em Base64 no React Native
- **Problema**: `FormData` / `multipart` no Android/iOS apresentava falhas com Expo Go (`Unsupported FormDataPart implementation` e `Cannot read property 'MULTIPART'`).
- **Decisão**: 
  - Implementado endpoint dedicado `POST /api/flyers/upload-base64` com `express.json({ limit: '35mb' })`.
  - No Expo, fotos e PDFs são lidos via `readUriAsBase64` usando `expo-file-system/legacy` (`FileSystem.readAsStringAsync` com base64) e fallback universal para `fetch(uri)` + blob + `FileReader`.

## 3. Compatibilidade Expo SDK 54+ (expo-file-system)
- **Problema**: Importar `readAsStringAsync` de `'expo-file-system'` dispara exceção em runtime avisando sobre depreciação.
- **Decisão**: 
  - Importação de `import * as FileSystem from 'expo-file-system/legacy';` que preserva total compatibilidade e funcionamento síncrono/assíncrono sem erros.

## 4. Calibração Microrregional e Unidades de Medida
- **Problema**: Preços genéricos nacionais tachavam produtos com grandes descontos locais como "preço normal" (ex: Alho 100g a R$ 1,69 vs gôndola R$ 2,99; Cebola kg a R$ 3,99 vs gôndola R$ 8,99).
- **Decisão**: 
  - Cidade e estado configurados (ex: Olímpia - SP) inseridos diretamente no prompt do Gemini.
  - O Gemini calibra o preço regular para a EXATA unidade anunciada (100g vs kg).

## 5. Bloqueio Duplo de Encartes Duplicados
- **Decisão**:
  - **Camada 1 (SHA-256 imediato sem custo de IA):** Gera hash do buffer antes de chamar a API Gemini. Se o mesmo arquivo já estiver ativo no banco (`flyers.file_hash`), rejeita imediatamente com HTTP 409.
  - **Camada 2 (Semântica por Supermercado e Ofertas):** Compara se >60% das ofertas ou mais de 8 ofertas são idênticas a um encarte ativo recente da mesma rede. Rejeita fotos em ângulos diferentes do mesmo folheto.

## 6. Calibração Rigorosa de "Super Oferta"
- **Problema**: 97% dos itens de encarte recebiam a tag `super_oferta`, banalizando o diferencial visual.
- **Decisão**:
  - Nova régua: `super_oferta` exige desconto real `>= 22%` em relação à gôndola habitual da microrregião.
  - `preco_normal`: entre `5%` e `21%`.
  - `falsa_promocao`: desconto irrelevante `<= 4%`.
  - Fallback neutro do backend ajustado para `1.05` caso não haja dados regulares.

## 7. Terminologia: "Minha Lista"
- **Decisão**: Todas as referências da antiga "Cesta" foram unificadas para "Minha Lista" em todo o mobile, web showcase e alertas.

## 8. Compatibilidade Expo 57 (SafeArea & AsyncStorage)
- **Decisão**:
  - `react-native-safe-area-context` e `SafeAreaProvider` substituem o `SafeAreaView` nativo depreciado.
  - `@react-native-async-storage/async-storage` fixado na versão estável 2.2.0 suportada pelo Expo Go.

## 9. Leitor de QRCode e Câmera Sem Tela Preta
- **Decisão**:
  - Resolução da tela preta com solicitação e checagem ativa de permissão (`useCameraPermissions`) sincronizada com o foco da tela.
  - Interface centralizada com mira óptica, marcadores neon e laser de varredura animado no centro da tela.
  - Feedback tátil via `Vibration` ao decodificar convite familiar.

## 10. Sanitização Recursiva Anti-Vazamento de JSON na IA
- **Decisão**:
  - Implementação do algoritmo `sanitizeStandardizedProductName` no backend e frontend.
  - Elimina blocos de código markdown (` ```json `), chaves como `"standardized_name":` ou prefixos acidentais, garantindo apenas o nome textual limpo do produto.

## 11. Isolamento Estrito de Encartes por Aparelho (`device_id`)
- **Decisão**:
  - Encartes e arquivos de imagem/PDF ficam estritamente confinados ao dispositivo que realizou o upload.
  - Coluna `device_id TEXT` indexada na tabela `flyers` do SQLite.
  - Rota `GET /api/flyers` exige e filtra por `device_id`.
  - Expurgo semanal de domingo (`purgeOldFlyers`) limpa apenas encartes e cache do próprio aparelho.

## 12. Sincronização em Tempo Real do Core Familiar (3 Membros)
- **Decisão**:
  - Usuários solo visualizam apenas sua própria lista (`WHERE device_id = ? AND family_core_id IS NULL`).
  - Integrantes do Core Familiar compartilham a lista completa (`family_core_id = ?`).
  - Qualquer adição, alteração de quantidade ou exclusão por qualquer um dos 3 membros reflete instantaneamente nos demais via broadcast WebSocket na sala `family_${familyCoreId}`.

## 13. Build Standalone Android (Expo EAS Preview)
- **Decisão**:
  - Inclusão do plugin `expo-build-properties` no `app.json` com `android.usesCleartextTraffic: true` para homologação HTTP com o backend na nuvem Oracle.
  - Geração de APK independente via `eas build -p android --profile preview`.

## 14. Core Familiar — Sincronização Offline-First e Ciclo de Vida (Especificação Seção 33)
- **Contexto**: Implementação dos requisitos da especificação `mercadofacil_core_familiar_especificacao-1.md` de forma não-destrutiva, integrando a lista compartilhada de até 3 aparelhos, compras no app, encartes locais e inteligência de ofertas.
- **Decisões Arquiteturais Adotadas**:
  - **ADR-001 (Persistência no Backend)**: A lista compartilhada persiste de forma canônica no SQLite do backend vinculada ao `family_core_id`, com histórico monotônico em `sync_operations` e `list_version`.
  - **ADR-002 (Papel do WebSocket)**: WebSocket opera estritamente como mecanismo de notificação e difusão em tempo real (`LIST_CHANGED`, `list_updated`), jamais como camada de persistência.
  - **ADR-003 (Isolamento de Encartes)**: Encartes e processamento por visão computacional permanecem 100% locais por `device_id` no SQLite.
  - **ADR-012 (Indicador Discreto de Sincronização)**: NUNCA exibe ponto verde fixo. Badge discreto aparece apenas durante `isSyncing` ("Sincronizando lista...") ou offline com alterações pendentes ("Modo offline (X pendentes)"); quando sincronizado, fica completamente invisível.
  - **Fila Offline-First Resiliente (`SyncQueueService`)**: Operações de lista são gravadas de forma atômica no AsyncStorage local antes de qualquer envio de rede, sobrevivendo ao fechamento e reinício do app. Ao reconectar, a fila é descarregada em lote via `POST /api/family/core/:coreId/list/operations`.
  - **Mesclagem Automática de Duplicatas (Seção 17.3)**: Quando dois membros adicionam o mesmo item offline, o backend normaliza fonética e acentos via `normalizeProductName` e mescla os registros somando suas quantidades.
  - **Detecção de Conflito de Quantidade (Seção 17.1 & 17.2)**: Quando dois aparelhos editam a quantidade do mesmo item em versões concorrentes, o backend identifica o conflito e o app exibe modal consensual para o usuário escolher entre manter a quantidade do servidor ou a local.
  - **Ciclo de Vida da Assinatura (Seção 4)**: 
    * Ao cancelar a renovação, o Core entra em `canceled_pending_expiry` mantendo todos os direitos até `subscription_expires_at`.
    * Quando faltam <= 5 dias, exibe aviso prévio visual na lista e no modal familiar.
    * Ao expirar, entra no período de retenção de 30 dias (`purge_at`) bloqueando sincronização (`CORE_EXPIRED`), mas permitindo reativação instantânea com restauração total da lista.
    * Após 30 dias de inadimplência, o Core é purgado permanentemente e rejeita reativação com HTTP 410.
  - **Saída Voluntária e Revogação (Seção 4.1)**: Membros convidados podem sair voluntariamente e o titular pode revogar aparelhos, liberando a vaga imediatamente. O titular é impedido de sair voluntariamente sem antes cancelar a assinatura. Ao perder acesso ao Core, o membro escolhe se deseja manter uma cópia local da lista no aparelho ou descartá-la.
  - **UX de Itens na Lista (Seção 18)**: Toque no corpo/checkbox do item marca ou desmarca como comprado (`purchased = 1`) com risco tachado e checkmark; toque no ícone de lápis abre o modal de edição de nome, quantidade e preferência de marca.
- **Status dos Testes Automatizados**:
  - `mobile/tests/monetization_unit_tests.mjs`: 13/13 testes aprovados.
  - `backend/tests/monetization_api_tests.mjs`: 4/4 testes aprovados.
  - `backend/tests/family_core_spec_tests.mjs`: 10/10 cenários completos da Seção 33 aprovados.
  - Total: 27/27 testes com 100% de aprovação.
- **Build Standalone Gerada**:
  - Build ID: `734ffa97-8da4-4764-b35f-d04b83356f2a`
  - Download direto do APK: https://expo.dev/artifacts/eas/LUIWa9KUVc3wWe0f5JxQAWAZNUqQUrsRazPnmECa57U.apk
  - Página da Build no Expo EAS: https://expo.dev/accounts/gothar/projects/mobile/builds/734ffa97-8da4-4764-b35f-d04b83356f2a
