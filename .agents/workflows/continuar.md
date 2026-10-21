---
name: continuar
description: Retoma o trabalho em um projeto carregando todo o contexto dos bancos de dados (Neo4j, Obsidian AI-Vault) e memória local do workspace a partir do último checkpoint registrado.
---

# Workflow: /continuar <nome do projeto>

> Disparado quando o usuário envia `/continuar <nome do projeto>` ou `/continuar` (ex: `/continuar MercadoFácil` ou apenas `/continuar`).

## Protocolo de Execução Obrigatório

Quando este comando for acionado, execute os passos abaixo sequencialmente:

### 1. Identificar o Projeto
- Se o `<nome do projeto>` foi fornecido, use-o diretamente (ex: `MercadoFacil`).
- Se não foi informado parâmetro, assuma o projeto do workspace ativo atual (para a pasta `lista de compras`, é o `MercadoFacil`).

### 2. Recuperar Contexto no Neo4j
Execute uma consulta via ferramenta `read-cypher` no MCP `neo4j`:
```cypher
MATCH (p:Project)
WHERE toLower(p.name) CONTAINS toLower($projectName)
OPTIONAL MATCH (p)-[:HAS_DOCUMENTATION]->(doc:ObsidianNote)
OPTIONAL MATCH (p)-[:HAS_DESIGN]->(design:DesignArtifact)
RETURN p, doc, design
LIMIT 1;
```
Recupere também os últimos `MemoryChunk` da agência relacionados ao projeto:
```cypher
MATCH (s:SoftwareHouse)-[:HAS_MEMORY]->(m:MemoryChunk)
WHERE toLower(m.summary) CONTAINS toLower($projectName) OR toLower(m.type) CONTAINS toLower($projectName)
RETURN m
ORDER BY m.updated_at DESC
LIMIT 5;
```

### 3. Recuperar Contexto no Obsidian (`AI-Vault`)
Verifique e leia a nota de checkpoint mais recente do projeto em:
- `C:\Users\allan\AI-Vault\02-Projetos\` correspondente ao projeto (ex: `MercadoFacil-Checkpoint-Atual.md` ou `MercadoFacil-Status-Arquitetura.md`).

### 4. Recuperar Memória Local do Workspace
- Leia o arquivo local de contexto, se existir (ex: `CONTEXTO_PROJETO.md` ou `.agents/memory/MEMORY.md`).

### 5. Apresentar Síntese de Retomada e Próxima Ação
Responda ao usuário com uma síntese executiva e objetiva:
1. 📍 **Ponto Exato Onde Paramos:** Último checkpoint registrado e decisões já tomadas.
2. 🛠️ **Status Técnico Atual:** O que está rodando, testado e funcional.
3. 🎯 **Próximo Passo Imediato:** A primeira ação da fila recomendada para dar sequência sem atrito.
