# Graph Report - lista de compras  (2026-10-11)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 143 nodes · 163 edges · 12 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- server.js
- mobile/package.json
- frontend/package.json
- expo
- backend/package.json
- dependencies
- database.js
- dependencies
- .oxlintrc.json
- devDependencies
- main.jsx
- scripts

## God Nodes (most connected - your core abstractions)
1. `expo` - 10 edges
2. `checkAndRunSundayPurge()` - 5 edges
3. `scripts` - 5 edges
4. `scripts` - 5 edges
5. `adaptiveIcon` - 5 edges
6. `processFlyerWithGemini()` - 4 edges
7. `getSetting()` - 3 edges
8. `App()` - 3 edges
9. `rules` - 3 edges
10. `generateWithFallback()` - 2 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (12 total, 0 thin omitted)

### Community 0 - "server.js"
Cohesion: 0.11
Nodes (21): app, checkAndRunSundayPurge(), COMMON_SUPERMARKET_ITEMS, cors, db, express, FALLBACK_MODELS, fs (+13 more)

### Community 1 - "mobile/package.json"
Cohesion: 0.14
Nodes (17): App(), getItemIcon(), styles, react, main, name, private, version (+9 more)

### Community 2 - "frontend/package.json"
Cohesion: 0.11
Nodes (18): dependencies, react, react-dom, react, name, private, scripts, build (+10 more)

### Community 3 - "expo"
Cohesion: 0.11
Nodes (17): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, expo, android, icon (+9 more)

### Community 4 - "backend/package.json"
Cohesion: 0.12
Nodes (15): allowScripts, sqlite3@6.0.1, description, keywords, main, name, scripts, test (+7 more)

### Community 5 - "dependencies"
Cohesion: 0.20
Nodes (10): dependencies, expo, expo-document-picker, expo-file-system, expo-image-picker, expo-status-bar, @expo/vector-icons, react (+2 more)

### Community 6 - "database.js"
Cohesion: 0.33
Nodes (5): db, dbPath, path, sqlite3, ref_path

### Community 7 - "dependencies"
Cohesion: 0.33
Nodes (6): dependencies, cors, express, @google/genai, multer, sqlite3

### Community 8 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 9 - "devDependencies"
Cohesion: 0.33
Nodes (6): devDependencies, oxlint, @types/react, @types/react-dom, vite, @vitejs/plugin-react

### Community 10 - "main.jsx"
Cohesion: 0.47
Nodes (4): App(), frontend_src_index, ref_react, react-dom

### Community 11 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, android, ios, start, web

## Knowledge Gaps
- **84 isolated node(s):** `app`, `COMMON_SUPERMARKET_ITEMS`, `cors`, `db`, `express` (+79 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 88 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react-dom` connect `main.jsx` to `frontend/package.json`?**
  _High betweenness centrality (0.106) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `mobile/package.json`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `frontend/package.json`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **What connects `app`, `COMMON_SUPERMARKET_ITEMS`, `cors` to the rest of the system?**
  _84 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `server.js` be split into smaller, more focused modules?**
  _Cohesion score 0.11462450592885376 - nodes in this community are weakly interconnected._
- **Should `mobile/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Should `frontend/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._