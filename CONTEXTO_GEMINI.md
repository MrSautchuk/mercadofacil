# 🛒 MERCADOFÁCIL — CONTEXTO GERAL E MEMÓRIA DE DESENVOLVIMENTO

> **Guia Executivo de Contexto para Inteligência Artificial & Agentes Autônomos**  
> *Aplicação: MercadoFácil (Lista de Compras Inteligente & Ecossistema de Varejo Local)*  
> *Versão: 2.0 (Alinhado com a Implementação do Core Familiar, Monorepo e Build Standalone)*  
> *Documento Mestre de Referência Detalhada: [CONTEXTO_PROJETO.md](file:///c:/Users/allan/OneDrive/Área de Trabalho/lista de compras/CONTEXTO_PROJETO.md)*

---

## 1. 📌 SÍNTESE DO PROJETO & PROPOSTA DE VALOR

O **MercadoFácil** é uma plataforma e ecossistema de compras de supermercado projetado para conectar consumidores e supermercados locais.
Ele resolve 3 dores centrais:
1. **Promoções Falsas:** Auditoria de encartes via IA discriminando *Super Oferta* (desconto real >= 22%), *Preço Normal* (5% a 21%) e *Falsa Promoção* (< 5%).
2. **Desorganização Familiar:** Sincronização offline-first de listas de compras em tempo real entre até 3 aparelhos da casa (**Core Familiar**).
3. **Custo de Mídia do Varejo:** Portal SaaS B2B onde supermercados publicam encartes e saldões de perecíveis direto para a cidade com 0% de comissão.

---

## 2. 🏛️ ESTRUTURA DO MONOREPO & REPOSITÓRIO

* 🌐 **GitHub Oficial:** [github.com/MrSautchuk/mercadofacil](https://github.com/MrSautchuk/mercadofacil) (Branch `main`)
* 📲 **APK Android Standalone:** [Download APK via Expo EAS](https://expo.dev/artifacts/eas/LUIWa9KUVc3wWe0f5JxQAWAZNUqQUrsRazPnmECa57U.apk) (Build `734ffa97-8da4-4764-b35f-d04b83356f2a`)
* 🎨 **Design System Figma:** [Figma Institucional](https://www.figma.com/make/ulG9eg9UhuiMD7YwrHjdfK/Institucional-website-design--Community-?code-node-id=0-9&p=f&t=hR3sndl8FahccdyX-0&fullscreen=1)

```
lista de compras/
├── backend/                  # Node.js 24 + Express 5 + SQLite + Socket.io + Gemini SDK
├── mobile/                   # React Native (Expo SDK 57, React 19) com tema Nubank escuro/claro
├── frontend/                 # Portal Web & B2B (React 19 + Vite) com 12 seções institucionais
├── .agents/                  # Memória persistente (MEMORY.md), regras e workflows (/continuar)
├── backend/tests/            # Suíte de 14 testes automatizados de integração
├── mobile/tests/             # 16 testes unitários de monetização e resiliência
└── CONTEXTO_PROJETO.md       # Documento mestre consolidado de arquitetura
```

---

## 3. ⚙️ DECISÕES TÉCNICAS E ARQUITETURA ATUAL

1. **Core Familiar Offline-First & Concorrência:**
   * Limite estrito de **3 aparelhos** (1 titular financeiro + até 2 secundários).
   * Fila idempotente local `SyncQueueService` gravada no `AsyncStorage` com `operation_id`.
   * Versionamento monotônico de lista (`list_version`) e detecção de conflitos de quantidade com modal consensual.
   * Salas WebSocket seletivas (`family_${familyCoreId}` e `device_${deviceId}`).
   * Algoritmo "Lowest Price Wins": menor preço auditado em encartes espelha instantaneamente na lista da família.

2. **Auditoria de Encartes (Google Gemini):**
   * Modelo primário `gemini-3.8-flash` com cadeia de fallbacks automáticos.
   * **Trava Anti-Spam:** Validação obrigatória `is_valid_flyer: true` (fotos comuns ou aleatórias são descartadas com HTTP 400 sem gravar no banco).
   * **Dupla Trava Anti-Duplicidade:** Camada 1 por Hash SHA-256 pré-IA; Camada 2 por similaridade semântica de ofertas pós-IA.
   * **Isolamento Estrito:** A lista é compartilhada, mas os encartes escaneados pertencem estritamente ao `device_id` local.
   * **Expurgo Semanal:** Rotina cron automática todo domingo às 22h00 (`checkAndRunSundayPurge`).

3. **Monetização e Ciclo de Vida:**
   * **Freemium:** Gratuito com anúncios discretos.
   * **Sem Anúncios:** R$ 3,99 (compra única vitalícia protegida contra expiração de assinaturas).
   * **Core Familiar:** R$ 5,99/mês (1 titular + 2 secundários). Ciclo com 30 dias de retenção de dados após cancelamento.
   * **MercadoFácil Business:** R$ 149 a R$ 299/mês (0% comissão sobre vendas físicas).

4. **Segurança de Credenciais:**
   * Suporte nativo a `.env` (`process.loadEnvFile()`).
   * Chave Gemini lida com prioridade de `process.env.GEMINI_API_KEY` ou configurada via Ajustes no app (BYOK).
   * Banco SQLite higienizado e `.gitignore` blindado contra commit de chaves, fotos de uploads ou arquivos `.db`.

5. **Infraestrutura em Nuvem (Oracle Cloud):**
   * Servidor de produção configurado na Oracle Cloud Always Free (`http://204.216.176.48:3001`).
   * Painel de monitoramento e robô pescador ARM 24/7 acessível em `/robo` e `/catcher`.

---

## 4. 🧪 STATUS DOS TESTES AUTOMATIZADOS

* **Backend:** 14/14 testes aprovados (`family_core_spec_tests.mjs` e `monetization_api_tests.mjs`).
* **Mobile:** 16/16 testes unitários aprovados (`monetization_unit_tests.mjs`).
* **Total:** 100% dos testes passando sem falhas.

---

## 5. 🎯 PRÓXIMOS PASSOS IMEDIATOS

1. Instalar e validar o APK Standalone em celulares Android físicos (teste do emparelhamento por QR Code entre múltiplos aparelhos).
2. Implementar OCR de encartes em PDF direto pelo navegador no Portal do Lojista B2B.
3. Configurar tabelas PostgreSQL no Supabase para migração do banco SQLite em escala.
