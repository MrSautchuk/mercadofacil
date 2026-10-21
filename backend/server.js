// Carregamento seguro e nativo de variáveis de ambiente (.env) sem expor segredos no repositório
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch (_) {
    // Arquivo .env é opcional (em produção pode ser injetado pelo ambiente do servidor)
  }
}

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { GoogleGenAI } = require('@google/genai');
const db = require('./database');
const monetizationRoutes = require('./monetizationRoutes');
const familySyncRoutes = require('./familySyncRoutes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});
const port = process.env.PORT || 3001;

// Gerenciamento de conexões WebSocket para sincronização em tempo real do Core Familiar
io.on('connection', (socket) => {
  const { deviceId, familyCoreId } = socket.handshake.query;

  if (deviceId) {
    socket.join(`device_${deviceId}`);
  }
  if (familyCoreId) {
    socket.join(`family_${familyCoreId}`);
  }

  socket.on('join_room', (payload) => {
    const fId = typeof payload === 'object' && payload !== null 
      ? (payload.familyCoreId || payload.family_core_id || payload.room) 
      : payload;
    if (fId) {
      const room = String(fId).startsWith('family_') ? fId : `family_${fId}`;
      socket.join(room);
    }
  });

  socket.on('join_family', (payload) => {
    const fId = typeof payload === 'object' && payload !== null ? (payload.familyCoreId || payload.family_core_id) : payload;
    if (fId) {
      socket.join(`family_${fId}`);
    }
  });

  socket.on('leave_family', (payload) => {
    const fId = typeof payload === 'object' && payload !== null ? (payload.familyCoreId || payload.family_core_id) : payload;
    if (fId) {
      socket.leave(`family_${fId}`);
    }
  });

  // Evento emitido por um dispositivo ao encontrar um novo snapshot de melhor oferta local
  socket.on('item_offer_updated', ({ itemId, offerSnapshot, familyCoreId: fId, deviceId: dId }) => {
    if (!itemId) return;
    const snapshotStr = typeof offerSnapshot === 'object' ? JSON.stringify(offerSnapshot) : offerSnapshot;
    db.run(
      'UPDATE items SET offer_snapshot = ? WHERE id = ?',
      [snapshotStr, itemId],
      (err) => {
        if (!err) {
          const targetRoom = fId ? `family_${fId}` : (dId ? `device_${dId}` : null);
          if (targetRoom) {
            io.to(targetRoom).emit('item_offer_updated', { itemId, offer_snapshot: offerSnapshot });
            io.to(targetRoom).emit('list_updated', { reason: 'item_offer_updated', itemId });
          }
        }
      }
    );
  });
});

// Helper de broadcast para lista e eventos do core (Isolamento Estrito: sem vazamento global)
function notifyListUpdated(familyCoreId, deviceId, meta = {}) {
  if (familyCoreId) {
    io.to(`family_${familyCoreId}`).emit('list_updated', meta);
  } else if (deviceId) {
    io.to(`device_${deviceId}`).emit('list_updated', meta);
  }
}

function notifyItemUpdated(familyCoreId, deviceId, payload = {}) {
  if (familyCoreId) {
    io.to(`family_${familyCoreId}`).emit('item_updated', payload);
  } else if (deviceId) {
    io.to(`device_${deviceId}`).emit('item_updated', payload);
  }
}

function notifyCoreAccessRevoked(targetDeviceId, familyCoreId) {
  io.to(`device_${targetDeviceId}`).emit('core_access_revoked', {
    deviceId: targetDeviceId,
    familyCoreId,
    reason: 'access_revoked_by_owner'
  });
  if (familyCoreId) {
    io.to(`family_${familyCoreId}`).emit('family_members_updated', { familyCoreId });
  }
}

app.set('io', io);
app.set('notifyListUpdated', notifyListUpdated);
app.set('notifyItemUpdated', notifyItemUpdated);
app.set('notifyCoreAccessRevoked', notifyCoreAccessRevoked);

// Modelos ordenados para máxima robustez e menor chance de 429/503
const PRIMARY_MODEL = 'gemini-3.8-flash';
const FALLBACK_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-flash-lite-latest'
];

app.disable('x-powered-by');

// Middleware de Cabeçalhos de Segurança (Defesa contra MIME Sniffing, Clickjacking e XSS)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

app.use(cors());
app.use(express.json({ limit: '35mb' }));
app.use(express.urlencoded({ extended: true, limit: '35mb' }));

// Helper de Sanitização XSS Estrita
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Helper Robusto e Universal de Sanitização de Nomes de Produtos Padronizados por IA
function sanitizeStandardizedProductName(rawInput, originalTerm = '') {
  if (!rawInput || typeof rawInput !== 'string') {
    return (originalTerm || '').trim();
  }

  let text = rawInput.trim();

  // 1. Remove blocos de código markdown (```json ... ``` ou ``` ... ```)
  text = text.replace(/```(?:json|yaml|text|markdown)?/gi, '').replace(/```/g, '');

  // 2. Remove tags HTML
  text = text.replace(/<[^>]*>/g, '');

  // 3. Tenta extrair de JSON se contiver chaves
  const jsonMatch = text.match(/\{[\s\S]*?\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed && typeof parsed === 'object') {
        const candidate = parsed.standardized_name ||
                          parsed.standard_name ||
                          parsed.product_name ||
                          parsed.name ||
                          parsed.produto ||
                          parsed.nome ||
                          parsed.item;
        if (candidate && typeof candidate === 'string') {
          text = candidate;
        }
      }
    } catch (_) {}
  }

  // 4. Se houver múltiplas linhas, pega a linha relevante (ignora preâmbulos como "Aqui está o nome:")
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (/^(aqui está|segue|resposta|olá|com certeza|claro|resultado|abaixo)/i.test(line)) {
      continue;
    }
    text = line;
    break;
  }

  // 5. Remove prefixos comuns de chaves/labels (ex: "standardized_name:", "produto:", "nome:", etc.)
  text = text.replace(/^["'{]?\s*(?:standardized[_\s]+name|standard[_\s]+name|product[_\s]+name|product|item[_\s]+name|item|produto[_\s]+padronizado|produto|nome[_\s]+padronizado|nome|termo|sugest[aã]o|resultado)\s*["']?\s*[:=-]\s*["']?/i, '');

  // 6. Remove aspas externas residuais e chaves/colchetes (preserva parênteses que denotam unidade ex: (kg), (un), (bandeja 125g))
  text = text.replace(/^["'“”«»{}\[\]]+|["'“”«»{}\[\]]+$/g, '').trim();

  // 7. Remove ponto final residual no fim da frase (se não fizer parte de abreviação interna)
  text = text.replace(/\.+$/, '').trim();

  // 8. Normaliza espaços duplicados
  text = text.replace(/\s+/g, ' ').trim();

  return text || (originalTerm || '').trim();
}

// Rate Limiter em memória para proteção de rotas com consumo de IA e upload (Prevenção de DoS / Esgotamento de Quota)
const aiRateLimiterMap = new Map();
function aiRateLimiter(maxRequests = 25, windowMs = 60000) {
  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'client';
    const now = Date.now();
    const userHistory = aiRateLimiterMap.get(ip) || [];
    const validHistory = userHistory.filter(ts => now - ts < windowMs);

    if (validHistory.length >= maxRequests) {
      return res.status(429).json({
        error: 'Limite de requisições excedido. Aguarde alguns instantes para nova tentativa.',
        retryAfterMs: Math.max(0, windowMs - (now - validHistory[0]))
      });
    }

    validHistory.push(now);
    aiRateLimiterMap.set(ip, validHistory);
    next();
  };
}

// Garantir diretório de uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Garantir diretório de bibliotecas locais (ex: PDF.js para renderização nativa de PDFs)
const vendorDir = path.join(__dirname, 'vendor');
if (!fs.existsSync(vendorDir)) {
  fs.mkdirSync(vendorDir, { recursive: true });
}
app.use('/vendor', express.static(vendorDir));
app.use('/api/vendor', express.static(vendorDir));

// Rotas de Monetização (Entitlements, In-App Billing, Family Core, B2B Offers)
app.use('/api', monetizationRoutes);
app.use('/api', familySyncRoutes);

// Whitelist Estrita de Tipos de Arquivo (Proteção contra Arbitrary File Upload)
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype;
    if (ALLOWED_MIME_TYPES.includes(mime) || ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido. Apenas PDF, JPG, PNG e WEBP são aceitos.'));
    }
  }
});

// Rota raiz para confirmação visual de status no navegador
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>MercadoFácil Backend API</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0c1512; color: #f0fdf4; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .card { background: #121e19; padding: 2.5rem; border-radius: 18px; border: 1px solid rgba(74,222,128,0.2); box-shadow: 0 10px 30px rgba(0,0,0,0.6); text-align: center; max-width: 480px; }
        h1 { color: #34d399; margin-top: 0; }
        .status-badge { background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #34d399; padding: 0.4rem 1rem; border-radius: 999px; display: inline-block; font-weight: bold; margin-bottom: 1rem; }
        p { color: #86a896; line-height: 1.5; }
        a { color: #6ee7b7; text-decoration: none; font-weight: bold; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="status-badge">● BACKEND MERCADOFÁCIL ONLINE</div>
        <h1>MercadoFácil API</h1>
        <p>Servidor ativo com Termômetro de Ofertas Reais e Comparação Inteligente de Preços!</p>
        <p>Acesse o aplicativo web em:<br><br><a href="http://localhost:5173" target="_blank">👉 Abrir Frontend (http://localhost:5173)</a></p>
      </div>
    </body>
    </html>
  `);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ==============================================================================
// DASHBOARD & API DO ROBÔ PESCADOR ORACLE CLOUD (MOBILE-FIRST)
// ==============================================================================
app.get('/api/robo/status', (req, res) => {
  const statePath = '/tmp/oci_catcher_state.json';
  let catcherData = null;
  if (fs.existsSync(statePath)) {
    try {
      catcherData = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    } catch (e) {
      console.error('Erro ao ler estado do catcher:', e);
    }
  }

  const freeMemMb = Math.round(os.freemem() / 1024 / 1024);
  const totalMemMb = Math.round(os.totalmem() / 1024 / 1024);
  const memUsedMb = totalMemMb - freeMemMb;
  const memUsedPercent = Math.round((memUsedMb / totalMemMb) * 100);
  const load = os.loadavg()[0].toFixed(2);
  const hostUptimeDays = (os.uptime() / 86400).toFixed(1);

  res.json({
    success: true,
    server_time: new Date().toISOString(),
    robo: catcherData || {
      attempt: 0,
      uptime_formatted: 'Carregando...',
      last_status: 'Aguardando ciclo do robô...',
      last_cycle: 'Recém-iniciado',
      vm_created: false,
      target: {
        shape: 'VM.Standard.A1.Flex',
        ocpus: 4.0,
        memory_gb: 24.0,
        boot_volume_gb: 200,
        region: 'sa-vinhedo-1 (Vinhedo AD-1)'
      },
      keepalives: {
        supabase: 'Ativo (Auth & PostgREST DB)'
      }
    },
    system: {
      free_mem_mb: freeMemMb,
      used_mem_mb: memUsedMb,
      total_mem_mb: totalMemMb,
      mem_used_percent: memUsedPercent,
      cpu_load: load,
      host_uptime_days: hostUptimeDays
    }
  });
});

const roboDashboardHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>Robô Pescador Oracle ARM 24/7</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #070B12;
      --card-bg: rgba(15, 23, 42, 0.75);
      --card-border: rgba(255, 255, 255, 0.08);
      --emerald: #10B981;
      --emerald-glow: rgba(16, 185, 129, 0.25);
      --cyan: #06B6D4;
      --amber: #F59E0B;
      --amber-glow: rgba(245, 158, 11, 0.2);
      --text-main: #F8FAFC;
      --text-muted: #94A3B8;
      --text-dim: #64748B;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: var(--bg);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      padding: 16px 12px 32px;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      width: 100%;
      max-width: 480px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .header {
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(6, 182, 212, 0.05));
      border: 1px solid rgba(16, 185, 129, 0.25);
      border-radius: 20px;
      padding: 18px 20px;
      backdrop-filter: blur(16px);
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    }
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .badge-live {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid var(--emerald);
      color: var(--emerald);
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      background: var(--emerald);
      border-radius: 50%;
      box-shadow: 0 0 10px var(--emerald);
      animation: pulse 1.6s infinite ease-in-out;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }
    .server-tag {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: var(--text-dim);
    }
    h1 {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.5px;
      background: linear-gradient(90deg, #F8FAFC, #34D399);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle {
      font-size: 13px;
      color: var(--text-muted);
      margin-top: 2px;
    }
    .hero-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      padding: 22px 20px;
      backdrop-filter: blur(16px);
      box-shadow: 0 8px 30px rgba(0,0,0,0.3);
      position: relative;
      overflow: hidden;
    }
    .hero-card::after {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
      background: linear-gradient(90deg, var(--emerald), var(--cyan));
    }
    .hero-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    .hero-value {
      font-family: 'JetBrains Mono', monospace;
      font-size: 44px;
      font-weight: 800;
      color: var(--text-main);
      line-height: 1.1;
      margin: 8px 0 4px;
    }
    .hero-sub {
      font-size: 13px;
      color: var(--emerald);
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
    }
    .stats-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 16px;
      backdrop-filter: blur(12px);
    }
    .stat-card-label {
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .stat-card-val {
      font-family: 'JetBrains Mono', monospace;
      font-size: 18px;
      font-weight: 700;
      color: var(--text-main);
      margin-top: 6px;
    }
    .status-box {
      background: rgba(245, 158, 11, 0.08);
      border: 1px solid rgba(245, 158, 11, 0.25);
      border-radius: 16px;
      padding: 16px;
    }
    .status-box-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
      color: var(--amber);
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .status-box-text {
      font-size: 13px;
      color: #FEF3C7;
      line-height: 1.45;
    }
    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin: 4px 4px 0;
    }
    .specs-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .spec-item {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      padding: 12px 14px;
    }
    .spec-item.highlight {
      background: linear-gradient(135deg, rgba(6, 182, 212, 0.12), rgba(16, 185, 129, 0.08));
      border: 1px solid rgba(6, 182, 212, 0.35);
    }
    .spec-name {
      font-size: 11px;
      color: var(--text-dim);
      font-weight: 600;
    }
    .spec-val {
      font-family: 'JetBrains Mono', monospace;
      font-size: 15px;
      font-weight: 700;
      color: var(--text-main);
      margin-top: 4px;
    }
    .spec-val.accent {
      color: var(--cyan);
    }
    .sentinelas-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .sentinela-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
    }
    .badge-on {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: var(--emerald);
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 999px;
      font-weight: 600;
    }
    .footer-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      font-size: 12px;
      color: var(--text-muted);
    }
    .btn-refresh {
      background: rgba(16, 185, 129, 0.2);
      border: 1px solid var(--emerald);
      color: #34D399;
      font-weight: 700;
      padding: 6px 14px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s;
    }
    .btn-refresh:active {
      transform: scale(0.96);
    }
    .refresh-bar {
      height: 3px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 3px;
      overflow: hidden;
      margin-top: 4px;
    }
    .refresh-progress {
      height: 100%;
      background: var(--emerald);
      width: 100%;
      transition: width 0.1s linear;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-top">
        <div class="badge-live">
          <div class="pulse-dot"></div>
          ATIVO 24/7 NO OCI
        </div>
        <div class="server-tag">204.216.176.48</div>
      </div>
      <h1>Robô Pescador ARM</h1>
      <div class="subtitle">Sentinela Autônoma & Auto-Retry Always Free</div>
    </div>

    <div class="hero-card">
      <div class="hero-label">Tentativas de Provisionamento</div>
      <div class="hero-value" id="attemptsCount">...</div>
      <div class="hero-sub">
        <span>⚡ Frequência: 1 requisição a cada 50s</span>
      </div>
    </div>

    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-card-label">Tempo Ativo</div>
        <div class="stat-card-val" id="uptimeFormatted">...</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Último Ciclo</div>
        <div class="stat-card-val" id="lastCycle" style="font-size: 14px; margin-top: 8px;">...</div>
      </div>
    </div>

    <div class="status-box">
      <div class="status-box-header">
        <span>📡 Resposta da Oracle Cloud (API)</span>
      </div>
      <div class="status-box-text" id="statusMessage">Consultando instância...</div>
    </div>

    <div class="section-title">🎯 Especificações do Alvo (Always Free Teto)</div>
    <div class="specs-grid">
      <div class="spec-item highlight">
        <div class="spec-name">OCPU ARM Flex</div>
        <div class="spec-val accent">4 Cores (Teto)</div>
      </div>
      <div class="spec-item highlight">
        <div class="spec-name">Memória RAM</div>
        <div class="spec-val accent">24 GB (Teto)</div>
      </div>
      <div class="spec-item highlight">
        <div class="spec-name">Armazenamento SSD</div>
        <div class="spec-val accent">200 GB (Teto)</div>
      </div>
      <div class="spec-item">
        <div class="spec-name">Região & AD</div>
        <div class="spec-val" style="font-size: 13px;">Vinhedo AD-1</div>
      </div>
    </div>

    <div class="section-title">🛡️ Sentinela & Servidor Host</div>
    <div class="sentinelas-card">
      <div class="sentinela-row">
        <span>Supabase Cloud (DB & Auth):</span>
        <span class="badge-on" id="supabaseStatus">Ativo (Keepalive)</span>
      </div>
      <div class="sentinela-row">
        <span>Host VM RAM Livre:</span>
        <span style="font-family: 'JetBrains Mono', monospace; font-size: 13px;" id="ramStatus">...</span>
      </div>
      <div class="sentinela-row">
        <span>Host CPU Load / Uptime:</span>
        <span style="font-family: 'JetBrains Mono', monospace; font-size: 13px;" id="cpuStatus">...</span>
      </div>
    </div>

    <div class="footer-bar">
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <span id="refreshLabel">Atualizando ao vivo em 3s</span>
        <div class="refresh-bar" style="width: 140px;">
          <div class="refresh-progress" id="refreshProgress"></div>
        </div>
      </div>
      <button class="btn-refresh" onclick="fetchStatus(true)">↻ Atualizar</button>
    </div>
  </div>

  <script>
    let countdown = 30; // 3 seconds (30 * 100ms)
    const REFRESH_INTERVAL = 30;

    async function fetchStatus(isManual = false) {
      try {
        const res = await fetch('/api/robo/status');
        const data = await res.json();
        if (data.success && data.robo) {
          const r = data.robo;
          document.getElementById('attemptsCount').textContent = Number(r.attempt || 0).toLocaleString('pt-BR');
          document.getElementById('uptimeFormatted').textContent = r.uptime_formatted || '--';
          document.getElementById('lastCycle').textContent = r.last_cycle || '--';
          document.getElementById('statusMessage').textContent = r.last_status || '--';

          if (r.keepalives) {
            document.getElementById('supabaseStatus').textContent = r.keepalives.supabase || 'Ativo (Keepalive)';
          }

          if (data.system) {
            document.getElementById('ramStatus').textContent = data.system.free_mem_mb + ' MB / ' + data.system.total_mem_mb + ' MB';
            document.getElementById('cpuStatus').textContent = 'Load ' + data.system.cpu_load + ' (' + data.system.host_uptime_days + 'd up)';
          }
        }
      } catch (err) {
        console.error('Falha ao obter status:', err);
      }
      if (isManual) countdown = REFRESH_INTERVAL;
    }

    setInterval(() => {
      countdown--;
      const pct = (countdown / REFRESH_INTERVAL) * 100;
      document.getElementById('refreshProgress').style.width = pct + '%';
      if (countdown <= 0) {
        countdown = REFRESH_INTERVAL;
        fetchStatus();
      }
    }, 100);

    fetchStatus();
  </script>
</body>
</html>
`;

app.get('/robo', (req, res) => {
  res.send(roboDashboardHtml);
});

app.get('/catcher', (req, res) => {
  res.send(roboDashboardHtml);
});


// Helper para obter configuração do banco
function getSetting(key) {
  return new Promise((resolve, reject) => {
    db.get('SELECT value FROM settings WHERE key = ?', [key], (err, row) => {
      if (err) return reject(err);
      resolve(row ? row.value : null);
    });
  });
}

// Helper para salvar configuração
function setSetting(key, value) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, value],
      function (err) {
        if (err) return reject(err);
        resolve(true);
      }
    );
  });
}

// Helper para buscar itens ativos com isolamento por dispositivo e família
function getActiveItems(deviceId = null, familyCoreId = null) {
  return new Promise((resolve, reject) => {
    let sql = 'SELECT * FROM items WHERE is_active = 1';
    const params = [];
    if (familyCoreId) {
      sql += ' AND (family_core_id = ? OR (device_id = ? AND family_core_id IS NULL))';
      params.push(Number(familyCoreId), deviceId ? String(deviceId).trim() : '');
    } else if (deviceId) {
      sql += ' AND device_id = ? AND family_core_id IS NULL';
      params.push(String(deviceId).trim());
    }
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

// Helper para tentar gerar conteúdo com o modelo correto e fallbacks (trata 503 e 429)
async function generateWithFallback(ai, requestConfig) {
  const modelsToTry = [PRIMARY_MODEL, ...FALLBACK_MODELS];
  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        ...requestConfig,
        model,
      });
      return response;
    } catch (err) {
      console.warn(`Tentativa com modelo ${model} falhou: ${err.message}`);
      lastError = err;
      // Se deu rate limit ou indisponibilidade, tenta o próximo modelo na cadeia
    }
  }
  throw lastError;
}

// Helper para inferir ou mapear mimeType
function getMimeType(file) {
  if (file.mimetype && file.mimetype !== 'application/octet-stream') {
    return file.mimetype;
  }
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'application/pdf';
}

// --- ROTAS DE CONFIGURAÇÃO (BYOK - Bring Your Own Key ou Variável de Ambiente .env) ---

app.get('/api/settings', async (req, res) => {
  try {
    const envKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';
    const dbKey = await getSetting('gemini_api_key');
    const key = envKey || dbKey;
    const userCity = (await getSetting('user_city')) || '';
    const userState = (await getSetting('user_state')) || '';

    const maskedKey = key
      ? (key.length > 8 ? `${key.slice(0, 4)}...${key.slice(-4)}` : '****')
      : '';

    res.json({
      configured: !!key,
      isEnvConfigured: !!envKey,
      maskedKey,
      user_city: userCity,
      user_state: userState
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings', async (req, res) => {
  const { gemini_api_key, user_city, user_state } = req.body;

  try {
    if (gemini_api_key !== undefined) {
      if (!gemini_api_key.trim()) {
        return res.status(400).json({ error: 'Chave de API não pode ser vazia.' });
      }
      await setSetting('gemini_api_key', gemini_api_key.trim());
    }

    if (user_city !== undefined) {
      await setSetting('user_city', user_city.trim());
    }

    if (user_state !== undefined) {
      await setSetting('user_state', user_state.trim().toUpperCase());
    }

    res.json({ success: true, message: 'Configurações salvas com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings/test-key', aiRateLimiter(10, 60000), async (req, res) => {
  let apiKey = req.body.gemini_api_key;
  if (!apiKey) {
    apiKey = process.env.GEMINI_API_KEY || (await getSetting('gemini_api_key'));
  }

  if (!apiKey) {
    return res.status(400).json({ error: 'Nenhuma chave fornecida para teste.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await generateWithFallback(ai, {
      contents: 'Responda apenas com a palavra: OK',
    });

    if (response && response.text) {
      res.json({ success: true, message: 'Conexão com Gemini validada com sucesso!' });
    } else {
      res.status(400).json({ error: 'Resposta inesperada do Gemini.' });
    }
  } catch (err) {
    console.error('Erro ao testar chave Gemini:', err);
    res.status(400).json({ error: `Chave inválida ou erro na API: ${err.message}` });
  }
});

// --- ROTAS DE LOCALIZAÇÃO (ESTADOS E CIDADES DO BRASIL - IBGE) ---

const BRAZILIAN_STATES = [
  { uf: 'AC', name: 'Acre' },
  { uf: 'AL', name: 'Alagoas' },
  { uf: 'AP', name: 'Amapá' },
  { uf: 'AM', name: 'Amazonas' },
  { uf: 'BA', name: 'Bahia' },
  { uf: 'CE', name: 'Ceará' },
  { uf: 'DF', name: 'Distrito Federal' },
  { uf: 'ES', name: 'Espírito Santo' },
  { uf: 'GO', name: 'Goiás' },
  { uf: 'MA', name: 'Maranhão' },
  { uf: 'MT', name: 'Mato Grosso' },
  { uf: 'MS', name: 'Mato Grosso do Sul' },
  { uf: 'MG', name: 'Minas Gerais' },
  { uf: 'PA', name: 'Pará' },
  { uf: 'PB', name: 'Paraíba' },
  { uf: 'PR', name: 'Paraná' },
  { uf: 'PE', name: 'Pernambuco' },
  { uf: 'PI', name: 'Piauí' },
  { uf: 'RJ', name: 'Rio de Janeiro' },
  { uf: 'RN', name: 'Rio Grande do Norte' },
  { uf: 'RS', name: 'Rio Grande do Sul' },
  { uf: 'RO', name: 'Rondônia' },
  { uf: 'RR', name: 'Roraima' },
  { uf: 'SC', name: 'Santa Catarina' },
  { uf: 'SP', name: 'São Paulo' },
  { uf: 'SE', name: 'Sergipe' },
  { uf: 'TO', name: 'Tocantins' }
];

app.get('/api/locations/states', (req, res) => {
  res.json({ states: BRAZILIAN_STATES });
});

app.get('/api/locations/cities', async (req, res) => {
  const uf = (req.query.uf || '').trim().toUpperCase();
  const query = (req.query.q || '').trim();

  if (!uf) {
    return res.status(400).json({ error: 'UF é obrigatório (ex: SP, PR, RJ).' });
  }

  try {
    // 1. Checa se o estado já foi populado no banco local
    const countRow = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM brazilian_cities WHERE uf = ?', [uf], (err, row) => {
        if (err) return reject(err);
        resolve(row ? row.count : 0);
      });
    });

    // 2. Se ainda não foi populado para essa UF, busca da API oficial do IBGE e salva no SQLite
    if (countRow === 0) {
      try {
        const ibgeRes = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`);
        if (ibgeRes.ok) {
          const ibgeCities = await ibgeRes.json();
          if (Array.isArray(ibgeCities) && ibgeCities.length > 0) {
            await new Promise((resolveInsert, rejectInsert) => {
              db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                const insertStmt = db.prepare('INSERT INTO brazilian_cities (uf, name, normalized_name) VALUES (?, ?, ?)');
                ibgeCities.forEach(c => {
                  const cityName = c.nome.trim();
                  const norm = cityName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                  insertStmt.run([uf, cityName, norm]);
                });
                insertStmt.finalize((err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    return rejectInsert(err);
                  }
                  db.run('COMMIT', (commitErr) => {
                    if (commitErr) rejectInsert(commitErr);
                    else resolveInsert();
                  });
                });
              });
            });
          }
        }
      } catch (ibgeErr) {
        console.warn(`[IBGE] Não foi possível carregar cidades da UF ${uf}:`, ibgeErr.message);
      }
    }

    // 3. Busca cidades com filtro
    const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const normalizedQuery = normalize(query);

    let sql = 'SELECT name FROM brazilian_cities WHERE uf = ?';
    let params = [uf];

    if (normalizedQuery) {
      sql += ' AND normalized_name LIKE ?';
      params.push(`%${normalizedQuery}%`);
    }

    sql += ' ORDER BY name ASC LIMIT 25';

    db.all(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        uf,
        cities: rows.map(r => r.name)
      });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- ROTA DE AUTOCOMPLETE & PADRONIZAÇÃO DE ITENS (SUPERMERCADO) ---

const COMMON_SUPERMARKET_ITEMS = [
  // Refrigerantes e Bebidas Não Alcoólicas
  "Refrigerante Coca-Cola 2L", "Refrigerante Coca-Cola Zero 2L", "Refrigerante Coca-Cola 600ml", "Refrigerante Coca-Cola Lata 350ml", "Refrigerante Coca-Cola 2,5L", "Refrigerante Coca-Cola Garrafa 1L",
  "Refrigerante Guaraná Antarctica 2L", "Refrigerante Guaraná Antarctica Zero 2L", "Refrigerante Guaraná Antarctica Lata 350ml",
  "Refrigerante Fanta Laranja 2L", "Refrigerante Fanta Uva 2L", "Refrigerante Sprite 2L", "Refrigerante Pepsi 2L", "Refrigerante Pepsi Black 2L", "Refrigerante Dolly Guaraná 2L",
  "Água Mineral sem Gás 500ml", "Água Mineral com Gás 500ml", "Água Mineral 1.5L", "Água Mineral Galão 20L", "Água de Coco 1L", "Água de Coco 200ml", "Água Tônica 350ml",
  "Suco de Laranja Integral 1L", "Suco de Uva Integral 1.5L", "Suco de Uva Integral 1L", "Suco Del Valle Uva 1L", "Suco Del Valle Pêssego 1L", "Néctar de Frutas 1L",
  "Energético Red Bull 250ml", "Energético Monster 473ml", "Isotônico Gatorade 500ml", "Chá Gelado Mate 1.5L", "Chá Gelado Pêssego 1.5L",

  // Cervejas e Bebidas Alcoólicas
  "Cerveja Heineken Lata 350ml", "Cerveja Heineken Long Neck 330ml", "Cerveja Heineken Garrafa 600ml", "Cerveja Heineken 0.0% sem Álcool 330ml", "Cerveja Heineken Barril 5L",
  "Cerveja Brahma Chopp Lata 350ml", "Cerveja Brahma Duplo Malte 350ml", "Cerveja Brahma Chopp Garrafa 600ml", "Cerveja Brahma Duplo Malte 600ml",
  "Cerveja Skol Lata 350ml", "Cerveja Skol Pilsen 600ml",
  "Cerveja Amstel Puro Malte Lata 350ml", "Cerveja Amstel 600ml",
  "Cerveja Stella Artois Long Neck 330ml", "Cerveja Stella Artois Lata 350ml", "Cerveja Corona Extra 330ml", "Cerveja Budweiser Lata 350ml", "Cerveja Budweiser Long Neck 330ml",
  "Cerveja Original Garrafa 600ml", "Cerveja Spaten Puro Malte 350ml", "Cerveja Spaten Garrafa 600ml", "Cerveja Eisenbahn Pilsen 350ml", "Cerveja Petra Puro Malte 350ml", "Cerveja Antarctica Boa 350ml",
  "Vinho Tinto de Mesa Suave 750ml", "Vinho Tinto de Mesa Seco 750ml", "Vinho Fino Chileno Cabernet 750ml", "Espumante Brut 750ml", "Espumante Moscatel 750ml",
  "Cachaça 51 965ml", "Vodka Smirnoff 998ml", "Gin Tanqueray 750ml", "Whisky Red Label 1L",

  // Hortifrúti (Frutas)
  "Abacate (kg)", "Abacate Manteiga (kg)", "Abacaxi Pérola (un)", "Abacaxi Havaí (un)", "Abacaxi (kg)",
  "Banana Prata (kg)", "Banana Nanica (kg)", "Banana Maçã (kg)", "Banana da Terra (kg)",
  "Maçã Gala (kg)", "Maçã Fuji (kg)", "Maçã Verde (kg)", "Laranja Pêra (kg)", "Laranja Lima (kg)", "Limão Taiti (kg)", "Limão Siciliano (kg)",
  "Mamão Papaia (un)", "Mamão Formosa (kg)", "Melancia (kg)", "Melão Amarelo (kg)", "Melão Espanhol (kg)",
  "Manga Palmer (kg)", "Manga Tommy (kg)", "Uva Thompson sem Semente (bdj 500g)", "Uva Niágara (bdj 500g)", "Uva Crimson (bdj 500g)", "Morango (bdj 250g)",
  "Maracujá Azedo (kg)", "Pera Williams (kg)", "Goiaba Vermelha (kg)", "Kiwi (kg)", "Ameixa Nacional (kg)", "Pêssego Nacional (kg)", "Coco Verde (un)", "Coco Seco (un)", "Tangerina Ponkan (kg)",

  // Hortifrúti (Legumes e Verduras)
  "Batata Inglesa (kg)", "Batata Doce (kg)", "Batata Baroa / Mandioquinha (kg)", "Mandioca Descascada (kg)",
  "Cebola Nacional (kg)", "Cebola Roxa (kg)", "Alho (pct 200g)", "Alho Descascado (pct 200g)",
  "Tomate Longa Vida (kg)", "Tomate Italiano (kg)", "Tomate Cereja (bdj 200g)",
  "Cenoura (kg)", "Beterraba (kg)", "Chuchu (kg)", "Abobrinha Italiana (kg)", "Abobrinha Menina (kg)", "Abóbora Cabotiá (kg)", "Abóbora Menina (kg)",
  "Pepino Japonês (kg)", "Pepino Caipira (kg)", "Pimentão Verde (kg)", "Pimentão Vermelho (kg)", "Pimentão Amarelo (kg)", "Berinjela (kg)", "Quiabo (kg)", "Jiló (kg)",
  "Alface Crespa (un)", "Alface Americana (un)", "Alface Lisa (un)", "Rúcula (un)", "Agrião (un)", "Couve Manteiga Picada (pct)", "Espinafre (maço)",
  "Cheiro Verde / Salsinha e Cebolinha (maço)", "Coentro (maço)", "Brócolis Ninja (un)", "Couve-Flor (un)", "Repolho Verde (kg)", "Repolho Roxo (kg)", "Milho Verde na Espiga (bdj)",
  "Ovos Brancos Grandes (cx c/ 12)", "Ovos Vermelhos Grandes (cx c/ 20)", "Ovos Brancos (cx c/ 30)", "Ovos Caipiras (cx c/ 10)",

  // Açúcar, Café e Mercearia Básica
  "Açúcar Refinado 1kg", "Açúcar Cristal 1kg", "Açúcar Cristal 2kg", "Açúcar Cristal 5kg", "Açúcar Demerara 1kg", "Açúcar Mascavo 500g", "Adoçante Líquido 100ml",
  "Arroz Branco Tipo 1 1kg", "Arroz Branco Tipo 1 5kg", "Arroz Integral 1kg", "Arroz Parboilizado 1kg", "Arroz Parboilizado 5kg",
  "Feijão Carioca 1kg", "Feijão Preto 1kg", "Feijão Fradinho 1kg", "Feijão Vermelho 1kg", "Lentilha 500g", "Grão de Bico 500g",
  "Café Torrado e Moído 250g", "Café Torrado e Moído 500g", "Café Solúvel 100g", "Cápsulas de Café (cx c/ 10)", "Filtro de Papel para Café (cx c/ 30)",
  "Achocolatado em Pó 400g", "Achocolatado em Pó 800g", "Achocolatado Líquido Toddy / Nescau 200ml",
  "Óleo de Soja 900ml", "Óleo de Girassol 900ml", "Óleo de Canola 900ml", "Óleo de Milho 900ml",
  "Azeite de Oliva Extra Virgem 500ml", "Azeite de Oliva Tradicional 500ml", "Vinagre de Álcool 750ml", "Vinagre de Maçã 500ml",
  "Molho de Tomate Tradicional 300g", "Extrato de Tomate 340g", "Passata de Tomate 500g",
  "Maionese Tradicional 500g", "Ketchup 400g", "Mostarda 200g", "Molho Shoyu 150ml", "Molho de Pimenta 150ml", "Sal Refinado 1kg", "Sal Grosso para Churrasco 1kg",

  // Massas e Farinhas
  "Macarrão Espaguete 500g", "Macarrão Parafuso 500g", "Macarrão Penne 500g", "Macarrão Instantâneo 85g", "Lasanha Massa Fresca 500g",
  "Farinha de Trigo Tradicional 1kg", "Farinha de Trigo com Fermento 1kg", "Farinha de Mandioca Torrada 1kg", "Farinha de Mandioca Crua 1kg",
  "Farinha de Milho / Fubá 500g", "Amido de Milho 500g", "Polvilho Doce 500g", "Polvilho Azedo 500g", "Aveia em Flocos 170g",

  // Laticínios e Frios
  "Leite Integral UHT 1L", "Leite Desnatado UHT 1L", "Leite Semidesnatado UHT 1L", "Leite sem Lactose 1L", "Leite Condensado 395g", "Creme de Leite 200g",
  "Manteiga com Sal 200g", "Manteiga sem Sal 200g", "Margarina com Sal 500g", "Margarina sem Sal 500g",
  "Queijo Mussarela Fatiado 200g", "Queijo Mussarela Pedaço (kg)", "Queijo Prato Fatiado 200g", "Queijo Minas Frescal (kg)", "Queijo Parmesão Ralado 50g", "Queijo Provolone (kg)", "Queijo Gorgonzola (kg)",
  "Presunto Cozido Fatiado 200g", "Peito de Peru Fatiado 200g", "Mortadela Fatiada 200g", "Salame Italiano Fatiado 100g",
  "Requeijão Cremoso 200g", "Cream Cheese 150g", "Iogurte Natural 170g", "Iogurte de Morango 850g", "Bebida Láctea Morango 850g", "Petit Suisse Danoninho 320g",

  // Carnes, Aves e Peixes
  "Picanha Bovina (kg)", "Alcatra Bovina (kg)", "Contrafilé Bovino (kg)", "Maminha Bovina (kg)", "Fraldinha Bovina (kg)", "Costela Bovina (kg)", "Cupim Bovino (kg)",
  "Carne Moída Patinho (kg)", "Carne Moída Acém (kg)", "Músculo Bovino (kg)", "Coxão Mole (kg)", "Coxão Duro (kg)",
  "Peito de Frango sem Osso (kg)", "Filé de Peito de Frango (pct 1kg)", "Coxa e Sobrecoxa de Frango (kg)", "Asa de Frango (kg)", "Frango Inteiro Congelado (kg)", "Coração de Frango (kg)",
  "Linguiça Toscana (kg)", "Linguiça Calabresa Defumada (kg)", "Linguiça de Frango (kg)", "Bacon em Pedaço (kg)", "Bacon Fatiado 200g",
  "Costelinha de Porco (kg)", "Lombo Suíno (kg)", "Bisteca Suína (kg)", "Pernil Suíno com Osso (kg)",
  "Filé de Tilápia Congelado (pct 800g)", "Camarão Limpo Congelado 400g", "Sardinha Fresca (kg)", "Bacalhau Desfiado (pct 500g)",

  // Limpeza e Lavanderia
  "Sabão em Pó 800g", "Sabão em Pó 1,6kg", "Sabão em Pó 2,4kg", "Sabão Líquido para Roupas 1L", "Sabão Líquido para Roupas 3L",
  "Amaciante de Roupas Tradicional 2L", "Amaciante Concentrado 1L", "Amaciante Concentrado 1,5L",
  "Detergente Líquido 500ml", "Desinfetante Perfumado 1L", "Desinfetante 2L", "Água Sanitária 2L", "Água Sanitária 5L",
  "Limpador Multiuso 500ml", "Lustra Móveis 200ml", "Limpador de Vidros 500ml", "Tira Manchas em Pó 450g", "Cloro Gel 500ml",
  "Esponja de Aço (pct c/ 8)", "Esponja Dupla Face (pct c/ 3)", "Saco de Lixo 30L (pct c/ 10)", "Saco de Lixo 50L (pct c/ 10)", "Saco de Lixo 100L (pct c/ 10)",
  "Papel Toalha (pct c/ 2 rolos)", "Guardanapo de Papel (pct c/ 50)", "Pano Multiuso (rolo c/ 50 panos)", "Vassoura de Pelo", "Rodo Simples 40cm",

  // Higiene Pessoal e Cuidados
  "Papel Higiênico Folha Dupla (pct c/ 12)", "Papel Higiênico Folha Tripla (pct c/ 12)", "Papel Higiênico Folha Simples (pct c/ 16)",
  "Sabonete em Barra 85g", "Sabonete Líquido 250ml", "Creme Dental 90g", "Escova Dental Macia", "Fio Dental 50m", "Enxaguante Bucal 500ml",
  "Shampoo 350ml", "Condicionador 350ml", "Máscara de Tratamento Capilar 300g",
  "Desodorante Antitranspirante Aerosol 150ml", "Desodorante Roll-on 50ml", "Protetor Solar FPS 50 200ml",
  "Absorvente com Abas (pct c/ 16)", "Lâmina de Barbear Descartável (pct c/ 2)", "Fralda Descartável Tam M (pct)", "Fralda Descartável Tam G (pct)", "Lenço Umedecido (pct c/ 50)",

  // Padaria, Biscoitos e Sobremesas
  "Pão de Forma Tradicional 500g", "Pão de Forma Integral 500g", "Bisnaguinha 300g", "Torrada Tradicional 140g",
  "Biscoito Recheado Chocolate 130g", "Biscoito Cream Cracker 400g", "Biscoito Maisena 400g", "Biscoito Wafer Chocolate 115g",
  "Chocolate em Barra 90g", "Caixa de Bombom 250g", "Gelatina em Pó 20g", "Mistura para Bolo 400g", "Fermento Químico em Pó 100g", "Fermento Biológico Seco 10g",

  // Pet Shop
  "Ração para Cães Adultos 1kg", "Ração para Cães Adultos 10kg", "Ração para Cães Filhotes 1kg", "Ração para Gatos Adultos 1kg", "Areia Sanitária para Gatos 4kg", "Sachê para Cães 100g", "Sachê para Gatos 85g"
];

app.get('/api/items/suggestions', (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query) {
    return res.json({ suggestions: [] });
  }

  const cleanStr = (str) => (str || '')
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const cleanQuery = cleanStr(query);
  const queryTokens = cleanQuery.split(' ').filter(Boolean);

  const matchItem = (item) => {
    const cleanItem = cleanStr(item);
    if (cleanItem.includes(cleanQuery)) return true;
    if (queryTokens.length > 1 && queryTokens.every(token => cleanItem.includes(token))) return true;
    return false;
  };

  // Busca prioritária na gôndola ampla
  const localMatches = COMMON_SUPERMARKET_ITEMS.filter(matchItem);

  // Também busca itens já cadastrados pelo usuário no banco
  db.all('SELECT DISTINCT name FROM items WHERE is_active = 1', [], (err, itemRows) => {
    let customMatches = [];
    if (!err && itemRows) {
      customMatches = itemRows
        .map(r => r.name)
        .filter(n => matchItem(n) && !localMatches.includes(n));
    }

    // Também inclui ofertas recentes de encartes cadastrados
    db.all('SELECT DISTINCT product_name FROM offers ORDER BY id DESC LIMIT 50', [], (errOff, offerRows) => {
      let offerMatches = [];
      if (!errOff && offerRows) {
        offerMatches = offerRows
          .map(r => r.product_name)
          .filter(n => n && matchItem(n) && !localMatches.includes(n) && !customMatches.includes(n));
      }

      // Combina resultados: Matches diretos da gôndola -> Itens da cesta -> Ofertas recentes de encartes
      const combined = [...localMatches, ...customMatches, ...offerMatches].slice(0, 12);
      res.json({ suggestions: combined });
    });
  });
});

// Endpoint opcional para padronização inteligente sob demanda com Gemini
app.post('/api/items/standardize-ai', aiRateLimiter(30, 60000), async (req, res) => {
  const term = (req.body.query || req.body.raw_name || req.body.name || '').trim();
  if (!term) {
    return res.status(400).json({ error: 'Termo de busca é obrigatório.' });
  }

  let apiKey = await getSetting('gemini_api_key');
  if (!apiKey) {
    return res.status(400).json({ error: 'Chave Gemini não configurada em Ajustes.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Você é um especialista em catálogo de supermercados no Brasil.
O usuário digitou o seguinte termo para adicionar à cesta de compras: "${term}".
Padronize esse termo para um nome limpo e comum de gôndola de supermercado brasileiro, incluindo unidade comum ou embalagem típica se fizer sentido (ex: "coca 2l" -> "Refrigerante Coca-Cola 2L", "cerveja heineken" -> "Cerveja Heineken Lata 350ml", "abacaxi" -> "Abacaxi Pérola (un)", "abacate" -> "Abacate (kg)", "contra file" -> "Contrafilé Bovino (kg)").

Return ONLY the raw string of the product name. NO markdown, NO JSON, NO backticks.`;

    const response = await generateWithFallback(ai, {
      contents: prompt
    });

    const rawText = (response.text || '').trim();
    const stdName = sanitizeStandardizedProductName(rawText, term);

    res.json({
      success: true,
      standard_name: stdName,
      standardized_name: stdName
    });
  } catch (err) {
    console.error('Erro ao padronizar com IA:', err);
    res.status(500).json({ error: 'Não foi possível padronizar com IA: ' + err.message });
  }
});

// --- ROTAS DA LISTA DE ITENS COM ISOLAMENTO MULTI-TENANT / CORE FAMILIAR ---

app.get('/api/items', (req, res) => {
  const deviceId = req.query.deviceId || req.headers['x-device-id'];
  const familyCoreId = req.query.familyCoreId || req.headers['x-family-core-id'];

  // Sem deviceId e sem familyCoreId, retorna lista vazia para proteção
  if (!deviceId && !familyCoreId) {
    return res.json({ data: [] });
  }

  const dId = deviceId ? String(deviceId).trim() : '';
  const fCoreId = familyCoreId ? Number(familyCoreId) : null;

  // Query estritamente parametrizada (defesa total contra SQL Injection)
  // Isolamento estrito: membros do Core Familiar compartilham a lista entre si,
  // enquanto usuários avulsos vêem apenas seus próprios itens sem core familiar.
  let sql = 'SELECT * FROM items';
  const params = [];

  if (fCoreId) {
    // Retorna todos os itens cadastrados pelo núcleo familiar (compartilhado entre os integrantes)
    // mais itens locais pré-existentes deste dispositivo ainda não associados à família
    sql += ' WHERE (family_core_id = ? OR (device_id = ? AND family_core_id IS NULL))';
    params.push(fCoreId, dId);
  } else {
    // Usuário avulso: visualiza estritamente os itens do seu próprio aparelho
    sql += ' WHERE device_id = ? AND family_core_id IS NULL';
    params.push(dId);
  }

  sql += ' ORDER BY created_at DESC';

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ data: rows || [] });
  });
});

app.post('/api/items', (req, res) => {
  const name = req.body.name;
  const deviceId = req.body.deviceId || req.headers['x-device-id'];
  const familyCoreId = req.body.familyCoreId || req.headers['x-family-core-id'];
  const offer_snapshot = req.body.offer_snapshot;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nome do item é obrigatório.' });
  }

  // Isolamento estrito P0: Exige deviceId ou familyCoreId
  if (!deviceId && !familyCoreId) {
    return res.status(400).json({ error: 'Identificador do dispositivo (deviceId) ou família é obrigatório para registrar o item.' });
  }

  const fCoreId = familyCoreId ? Number(familyCoreId) : null;
  const dId = deviceId ? String(deviceId).trim() : null;
  const snap = typeof offer_snapshot === 'object' ? JSON.stringify(offer_snapshot) : (offer_snapshot || null);

  db.run(
    'INSERT INTO items (name, is_active, family_core_id, device_id, offer_snapshot) VALUES (?, 1, ?, ?, ?)',
    [name.trim(), fCoreId, dId, snap],
    function (err) {
      if (err) return res.status(400).json({ error: err.message });
      const newItem = {
        id: this.lastID,
        name: name.trim(),
        is_active: 1,
        family_core_id: fCoreId,
        device_id: dId,
        offer_snapshot: snap
      };

      const notifier = req.app.get('notifyListUpdated');
      if (typeof notifier === 'function') {
        notifier(fCoreId, dId, { action: 'item_added', item: newItem });
      }

      res.json(newItem);
    }
  );
});

app.put('/api/items/:id', (req, res) => {
  const itemId = parseInt(req.params.id, 10);
  if (isNaN(itemId)) {
    return res.status(400).json({ error: 'ID inválido.' });
  }
  const { is_active, name, quantity, brand_preference, offer_snapshot, familyCoreId, deviceId } = req.body;
  
  const updates = [];
  const params = [];

  if (name !== undefined) {
    updates.push('name = ?');
    params.push(name.trim());
  }
  if (is_active !== undefined) {
    updates.push('is_active = ?');
    params.push(is_active);
  }
  if (quantity !== undefined) {
    updates.push('quantity = ?');
    params.push(parseInt(quantity, 10) || 1);
  }
  if (brand_preference !== undefined) {
    updates.push('brand_preference = ?');
    params.push(brand_preference ? brand_preference.trim() : null);
  }
  if (offer_snapshot !== undefined) {
    updates.push('offer_snapshot = ?');
    params.push(typeof offer_snapshot === 'object' ? JSON.stringify(offer_snapshot) : offer_snapshot);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'Nenhum campo para atualizar.' });
  }

  params.push(itemId);
  const sql = `UPDATE items SET ${updates.join(', ')} WHERE id = ?`;

  db.run(sql, params, function (err) {
    if (err) return res.status(400).json({ error: err.message });

    db.get('SELECT * FROM items WHERE id = ?', [itemId], (errGet, row) => {
      const targetCore = familyCoreId || (row ? row.family_core_id : null);
      const targetDev = deviceId || (row ? row.device_id : null);

      // 1. Notifica evento específico 'item_updated' para espelhar instantaneamente o snapshot nos dispositivos
      const itemNotifier = req.app.get('notifyItemUpdated');
      if (typeof itemNotifier === 'function') {
        itemNotifier(targetCore, targetDev, {
          itemId,
          item: row,
          offer_snapshot: row ? row.offer_snapshot : offer_snapshot
        });
      }

      // 2. Notifica atualização geral da lista
      const listNotifier = req.app.get('notifyListUpdated');
      if (typeof listNotifier === 'function') {
        listNotifier(targetCore, targetDev, { action: 'item_updated', itemId });
      }
    });

    res.json({ updated: this.changes });
  });
});

app.delete('/api/items/:id', (req, res) => {
  const itemId = parseInt(req.params.id, 10);
  if (isNaN(itemId)) {
    return res.status(400).json({ error: 'ID inválido.' });
  }
  const { familyCoreId, deviceId } = req.query;

  db.get('SELECT family_core_id, device_id FROM items WHERE id = ?', [itemId], (errGet, row) => {
    const targetCore = familyCoreId || (row ? row.family_core_id : null);
    const targetDev = deviceId || (row ? row.device_id : null);

    db.run('DELETE FROM items WHERE id = ?', [itemId], function (err) {
      if (err) return res.status(400).json({ error: err.message });

      const notifier = req.app.get('notifyListUpdated');
      if (typeof notifier === 'function') {
        notifier(targetCore, targetDev, { action: 'item_deleted', itemId });
      }

      res.json({ deleted: this.changes });
    });
  });
});

// --- ROTAS DO CORE DE ECONOMIA & ENCARTES ---

app.get('/api/flyers', (req, res) => {
  const deviceId = req.query.deviceId || req.headers['x-device-id'];
  if (!deviceId) {
    // Isolamento estrito de encartes: cada aparelho só visualiza os seus próprios encartes
    return res.json({ data: [] });
  }

  const dId = String(deviceId).trim();
  const query = `
    SELECT 
      f.id as flyer_id,
      f.supermarket_name,
      f.original_filename,
      f.file_path,
      f.file_type,
      f.uploaded_at,
      f.valid_until,
      o.id as offer_id,
      o.product_name,
      o.price,
      o.unit,
      o.regular_price,
      o.deal_verdict,
      o.discount_percent,
      o.matched_item_id,
      o.matched_item_name
    FROM flyers f
    LEFT JOIN offers o ON f.id = o.flyer_id
    WHERE f.device_id = ?
    ORDER BY f.uploaded_at DESC
  `;

  db.all(query, [dId], (err, rows) => {
    if (err) return res.status(400).json({ error: err.message });

    const flyersMap = {};
    rows.forEach(row => {
      if (!flyersMap[row.flyer_id]) {
        const fileName = row.file_path ? path.basename(row.file_path) : null;
        flyersMap[row.flyer_id] = {
          id: row.flyer_id,
          supermarket_name: row.supermarket_name,
          original_filename: row.original_filename,
          file_path: row.file_path,
          file_type: row.file_type || (fileName && fileName.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
          file_url: fileName ? `/uploads/${fileName}` : null,
          uploaded_at: row.uploaded_at,
          valid_until: row.valid_until || null,
          offers: []
        };
      }
      if (row.offer_id) {
        flyersMap[row.flyer_id].offers.push({
          id: row.offer_id,
          product_name: row.product_name,
          price: row.price,
          unit: row.unit,
          regular_price: row.regular_price,
          deal_verdict: row.deal_verdict || 'preco_normal',
          discount_percent: row.discount_percent || 0,
          matched_item_id: row.matched_item_id,
          matched_item_name: row.matched_item_name
        });
      }
    });

    res.json({ data: Object.values(flyersMap) });
  });
});

// Servir arquivo bruto do encarte para visualização nativa
app.get('/api/flyers/:id/file', (req, res) => {
  const flyerId = parseInt(req.params.id, 10);
  if (isNaN(flyerId)) {
    return res.status(400).json({ error: 'ID do encarte inválido.' });
  }
  db.get('SELECT file_path, file_type, original_filename FROM flyers WHERE id = ?', [flyerId], (err, row) => {
    if (err || !row || !row.file_path || !fs.existsSync(row.file_path)) {
      return res.status(404).json({ error: 'Arquivo do encarte não encontrado no servidor.' });
    }
    const targetPath = path.resolve(row.file_path);
    const resolvedUploads = path.resolve(uploadsDir);
    if (!targetPath.startsWith(resolvedUploads)) {
      return res.status(403).json({ error: 'Acesso negado: caminho de arquivo restrito.' });
    }
    const contentType = row.file_type || (row.file_path.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
    res.setHeader('Content-Type', contentType);
    res.sendFile(targetPath);
  });
});

// Servir visualizador HTML completo compatível com PDFs de múltiplas páginas (ex: Tome Leve - 15 páginas) e imagens (WebP, JPG, PNG)
app.get('/api/flyers/:id/viewer', (req, res) => {
  const flyerId = parseInt(req.params.id, 10);
  if (isNaN(flyerId)) {
    return res.status(400).send('<h3 style="color:#f87171;font-family:sans-serif;text-align:center;margin-top:40px;">ID do encarte inválido.</h3>');
  }
  db.get('SELECT file_path, file_type, original_filename, supermarket_name FROM flyers WHERE id = ?', [flyerId], (err, row) => {
    if (err || !row || !row.file_path || !fs.existsSync(row.file_path)) {
      return res.status(404).send('<h3 style="color:#f87171;font-family:sans-serif;text-align:center;margin-top:40px;">Arquivo do encarte não encontrado no servidor.</h3>');
    }
    const targetPath = path.resolve(row.file_path);
    const resolvedUploads = path.resolve(uploadsDir);
    if (!targetPath.startsWith(resolvedUploads)) {
      return res.status(403).send('<h3 style="color:#f87171;font-family:sans-serif;text-align:center;margin-top:40px;">Acesso negado: caminho de arquivo restrito.</h3>');
    }

    const safeSupermarket = escapeHtml(row.supermarket_name || 'Encarte');
    const safeFilename = escapeHtml(row.original_filename || 'encarte');
    const ext = path.extname(row.file_path || row.original_filename || '').toLowerCase();
    const isPdf = row.file_type === 'application/pdf' || ext === '.pdf';

    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    if (!isPdf) {
      // VISUALIZADOR UNIVERSAL DE IMAGENS (JPEG, PNG, WEBP, GIF) COM PINCH-TO-ZOOM E CONTROLES
      return res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
  <title>${safeSupermarket} - Encarte</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      background-color: #0b1411;
      color: #f0fdf4;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: auto;
      touch-action: pan-x pan-y pinch-zoom;
    }
    .top-toolbar {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(11, 20, 17, 0.96);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border-bottom: 1px solid rgba(74, 222, 128, 0.25);
      padding: 10px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .toolbar-info {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 700;
      color: #4ade80;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      max-width: 50%;
    }
    .toolbar-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .btn-zoom {
      background: #162620;
      border: 1px solid rgba(74, 222, 128, 0.35);
      color: #f0fdf4;
      border-radius: 8px;
      padding: 6px 12px;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
      touch-action: manipulation;
    }
    .btn-zoom:active { background: #22c55e; color: #000; }
    .zoom-level {
      font-size: 12px;
      font-weight: 800;
      color: #86efac;
      min-width: 44px;
      text-align: center;
    }
    .image-viewport {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 12px 10px 60px;
      overflow: auto;
    }
    #flyer-img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.7);
      transition: transform 0.15s ease-out;
      transform-origin: top center;
    }
  </style>
</head>
<body>
  <div class="top-toolbar">
    <div class="toolbar-info">
      <span>🖼️</span>
      <span>${safeFilename}</span>
    </div>
    <div class="toolbar-actions">
      <button class="btn-zoom" onclick="adjustZoom(-0.25)">-</button>
      <span class="zoom-level" id="zoom-text">100%</span>
      <button class="btn-zoom" onclick="adjustZoom(0.25)">+</button>
      <button class="btn-zoom" onclick="resetZoom()">100%</button>
    </div>
  </div>
  <div class="image-viewport">
    <img id="flyer-img" src="/api/flyers/${flyerId}/file" alt="${safeSupermarket}" />
  </div>
  <script>
    let currentZoom = 1.0;
    function adjustZoom(delta) {
      currentZoom = Math.min(4.0, Math.max(0.5, currentZoom + delta));
      applyZoom();
    }
    function resetZoom() {
      currentZoom = 1.0;
      applyZoom();
    }
    function applyZoom() {
      const img = document.getElementById('flyer-img');
      const zoomText = document.getElementById('zoom-text');
      if (zoomText) zoomText.innerText = Math.round(currentZoom * 100) + '%';
      if (img) img.style.transform = currentZoom === 1.0 ? 'none' : 'scale(' + currentZoom + ')';
    }
  </script>
</body>
</html>`);
    }

    // VISUALIZADOR PROFISSIONAL DE PDF COM LAZY-LOADING E VIRTUALIZAÇÃO PARA MULTI-PÁGINAS (EX: TOME LEVE - 15 PÁGINAS)
    res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
  <title>${safeSupermarket} - Encarte</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background-color: #0b1411;
      color: #f0fdf4;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
      touch-action: pan-x pan-y pinch-zoom;
    }
    .top-toolbar {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(11, 20, 17, 0.96);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border-bottom: 1px solid rgba(74, 222, 128, 0.25);
      padding: 8px 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      flex-wrap: wrap;
    }
    .toolbar-info {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 700;
      color: #4ade80;
    }
    .page-select {
      background: #162620;
      border: 1px solid rgba(74, 222, 128, 0.35);
      color: #f0fdf4;
      border-radius: 6px;
      padding: 4px 6px;
      font-size: 12px;
      font-weight: 700;
      outline: none;
    }
    .toolbar-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .btn-action {
      background: #162620;
      border: 1px solid rgba(74, 222, 128, 0.35);
      color: #f0fdf4;
      border-radius: 6px;
      padding: 5px 9px;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
      touch-action: manipulation;
    }
    .btn-action:active { background: #22c55e; color: #000; }
    .zoom-level {
      font-size: 11px;
      font-weight: 800;
      color: #86efac;
      min-width: 36px;
      text-align: center;
    }
    #viewer-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 10px 8px 60px;
      gap: 16px;
      width: 100%;
      transform-origin: top center;
      transition: transform 0.15s ease-out;
    }
    .page-wrapper {
      background: #18221e;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
      width: 100%;
      max-width: 850px;
      min-height: 250px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      position: relative;
    }
    .page-tag {
      position: absolute;
      top: 8px;
      right: 8px;
      background: rgba(0,0,0,0.75);
      color: #4ade80;
      font-size: 11px;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 6px;
      pointer-events: none;
      z-index: 5;
    }
    canvas {
      width: 100%;
      height: auto;
      display: block;
    }
    .page-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      gap: 10px;
      color: #86efac;
      font-size: 12px;
    }
    .spinner {
      width: 28px;
      height: 28px;
      border: 3px solid rgba(74, 222, 128, 0.2);
      border-top-color: #4ade80;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .error-box {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #fca5a5;
      padding: 16px;
      border-radius: 12px;
      max-width: 90%;
      margin: 30px auto;
      text-align: center;
      font-size: 13px;
    }
  </style>
  <script src="/vendor/pdf.min.js"></script>
</head>
<body>
  <div class="top-toolbar">
    <div class="toolbar-info">
      <span>📄</span>
      <select id="page-select" class="page-select" onchange="jumpToPage(this.value)">
        <option value="1">Carregando...</option>
      </select>
    </div>
    <div class="toolbar-actions">
      <button class="btn-action" onclick="changePage(-1)">‹ Ant</button>
      <button class="btn-action" onclick="changePage(1)">Próx ›</button>
      <button class="btn-action" onclick="adjustZoom(-0.25)">-</button>
      <span class="zoom-level" id="zoom-text">100%</span>
      <button class="btn-action" onclick="adjustZoom(0.25)">+</button>
      <button class="btn-action" onclick="resetZoom()">100%</button>
    </div>
  </div>

  <div id="viewer-container">
    <div id="global-loading" class="page-placeholder" style="padding: 50px 20px;">
      <div class="spinner"></div>
      <div style="font-weight:700;">Carregando encarte...</div>
      <div style="font-size:11px;opacity:0.8;">Preparando páginas</div>
    </div>
  </div>

  <script>
    const FLYER_ID = ${JSON.stringify(flyerId)};
    let currentZoom = 1.0;
    let pdfDoc = null;
    let totalPages = 1;
    let currentPage = 1;
    const renderedPages = new Set();
    const renderingPages = new Set();

    function adjustZoom(delta) {
      currentZoom = Math.min(3.0, Math.max(0.6, currentZoom + delta));
      applyZoom();
    }

    function resetZoom() {
      currentZoom = 1.0;
      applyZoom();
    }

    function applyZoom() {
      const container = document.getElementById('viewer-container');
      const zoomText = document.getElementById('zoom-text');
      if (zoomText) zoomText.innerText = Math.round(currentZoom * 100) + '%';
      if (currentZoom === 1.0) {
        container.style.transform = 'none';
        container.style.width = '100%';
      } else {
        container.style.transform = 'scale(' + currentZoom + ')';
        container.style.width = (100 / currentZoom) + '%';
      }
    }

    function jumpToPage(num) {
      const target = document.getElementById('page-wrapper-' + num);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        currentPage = parseInt(num);
        updatePageSelect();
        renderPage(currentPage);
      }
    }

    function changePage(delta) {
      const targetPage = Math.min(totalPages, Math.max(1, currentPage + delta));
      jumpToPage(targetPage);
    }

    function updatePageSelect() {
      const sel = document.getElementById('page-select');
      if (sel) sel.value = currentPage;
    }

    async function renderPage(pageNum) {
      if (!pdfDoc || renderedPages.has(pageNum) || renderingPages.has(pageNum)) return;
      renderingPages.add(pageNum);

      try {
        const page = await pdfDoc.getPage(pageNum);
        const unscaledViewport = page.getViewport({ scale: 1.0 });

        // Calibra a escala para ficar nítido sem estourar a memória (largura entre 800px e 1200px)
        const dpr = Math.min(window.devicePixelRatio || 1.0, 1.6);
        const targetWidth = Math.min(window.innerWidth || 360, 600);
        const scale = Math.min(1.8, Math.max(1.1, (targetWidth / unscaledViewport.width) * dpr));

        const viewport = page.getViewport({ scale });
        const wrapper = document.getElementById('page-wrapper-' + pageNum);
        if (!wrapper) return;

        // Limpa placeholder
        wrapper.innerHTML = '';

        const tag = document.createElement('div');
        tag.className = 'page-tag';
        tag.innerText = 'Página ' + pageNum + ' de ' + totalPages;
        wrapper.appendChild(tag);

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { alpha: false });
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        wrapper.appendChild(canvas);

        await page.render({ canvasContext: ctx, viewport }).promise;
        renderedPages.add(pageNum);
      } catch (err) {
        console.error('Erro render page ' + pageNum, err);
      } finally {
        renderingPages.delete(pageNum);
      }
    }

    async function initPdfViewer() {
      const container = document.getElementById('viewer-container');
      const globalLoading = document.getElementById('global-loading');
      const pageSelect = document.getElementById('page-select');

      if (typeof pdfjsLib === 'undefined') {
        try {
          await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            s.onload = resolve;
            s.onerror = () => reject(new Error('Falha ao carregar motor de PDF.'));
            document.head.appendChild(s);
          });
        } catch (err) {
          if (globalLoading) globalLoading.innerHTML = '<div class="error-box">Não foi possível carregar a biblioteca de visualização.</div>';
          return;
        }
      }

      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdf.worker.min.js';
      } catch (e) {
        console.warn('Worker notice:', e);
      }

      const pdfUrl = '/api/flyers/' + FLYER_ID + '/file';

      try {
        const loadingTask = pdfjsLib.getDocument({
          url: pdfUrl,
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
          cMapPacked: true,
          enableXfa: false
        });

        pdfDoc = await loadingTask.promise;
        totalPages = pdfDoc.numPages;

        if (globalLoading) globalLoading.remove();

        // Popula seletor de páginas
        pageSelect.innerHTML = '';
        for (let i = 1; i <= totalPages; i++) {
          const opt = document.createElement('option');
          opt.value = i;
          opt.innerText = 'Página ' + i + ' de ' + totalPages;
          pageSelect.appendChild(opt);
        }

        // Cria os wrappers das páginas com placeholder leve
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          const wrapper = document.createElement('div');
          wrapper.className = 'page-wrapper';
          wrapper.id = 'page-wrapper-' + pageNum;
          wrapper.setAttribute('data-page', pageNum);
          wrapper.innerHTML = '<div class="page-placeholder"><div class="spinner"></div><div>Carregando página ' + pageNum + '...</div></div>';
          container.appendChild(wrapper);
        }

        // Renderiza a primeira página imediatamente
        await renderPage(1);

        // Se tiver mais páginas, configura IntersectionObserver para renderização sob demanda
        if (totalPages > 1 && 'IntersectionObserver' in window) {
          const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
              if (entry.isIntersecting) {
                const pNum = parseInt(entry.target.getAttribute('data-page'));
                currentPage = pNum;
                updatePageSelect();
                renderPage(pNum);
              }
            });
          }, { rootMargin: '350px 0px 350px 0px' });

          document.querySelectorAll('.page-wrapper').forEach(w => observer.observe(w));
        } else if (totalPages > 1) {
          // Fallback para navegadores sem IntersectionObserver: renderiza sequencial
          for (let p = 2; p <= Math.min(5, totalPages); p++) {
            await renderPage(p);
          }
        }
      } catch (err) {
        console.error('Erro ao abrir PDF:', err);
        container.innerHTML = '<div class="error-box"><b>Não foi possível carregar o encarte</b><br>' + (err.message || 'Erro desconhecido') + '</div>';
      }
    }

    window.addEventListener('DOMContentLoaded', initPdfViewer);
  </script>
</body>
</html>`);
  });
});

// Servir arquivo em base64 (ótimo para renderização no app sem falhas de rede)
app.get('/api/flyers/:id/base64', (req, res) => {
  const flyerId = parseInt(req.params.id, 10);
  if (isNaN(flyerId)) {
    return res.status(400).json({ error: 'ID do encarte inválido.' });
  }
  db.get('SELECT file_path, file_type, original_filename, supermarket_name FROM flyers WHERE id = ?', [flyerId], (err, row) => {
    if (err || !row || !row.file_path || !fs.existsSync(row.file_path)) {
      return res.status(404).json({ error: 'Arquivo do encarte não encontrado no disco.' });
    }
    const targetPath = path.resolve(row.file_path);
    const resolvedUploads = path.resolve(uploadsDir);
    if (!targetPath.startsWith(resolvedUploads)) {
      return res.status(403).json({ error: 'Acesso negado: caminho de arquivo restrito.' });
    }
    try {
      const fileBuffer = fs.readFileSync(targetPath);
      const base64 = fileBuffer.toString('base64');
      const mimeType = row.file_type || (row.file_path.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
      res.json({
        success: true,
        dataUri: `data:${mimeType};base64,${base64}`,
        rawBase64: base64,
        mimeType,
        original_filename: row.original_filename,
        supermarket_name: row.supermarket_name
      });
    } catch (readErr) {
      res.status(500).json({ error: 'Erro ao ler arquivo: ' + readErr.message });
    }
  });
});

// Função interna de limpeza de encartes expirados (limpa flyers, ofertas e arquivos do disco)
function purgeAllFlyers(reason = 'agendamento automático de domingo às 22:00h', deviceId = null) {
  return new Promise((resolve, reject) => {
    let selectSql = 'SELECT id, file_path FROM flyers';
    const selectParams = [];
    if (deviceId) {
      selectSql += ' WHERE device_id = ?';
      selectParams.push(String(deviceId).trim());
    }

    db.all(selectSql, selectParams, (errSelect, rows) => {
      if (rows && rows.length > 0) {
        const resolvedUploads = path.resolve(uploadsDir);
        rows.forEach(r => {
          if (r.file_path && fs.existsSync(r.file_path)) {
            const targetPath = path.resolve(r.file_path);
            if (targetPath.startsWith(resolvedUploads)) {
              try { fs.unlinkSync(targetPath); } catch (e) {}
            }
          }
        });
      }
      db.serialize(() => {
        let delOffersSql = 'DELETE FROM offers';
        const delOffersParams = [];
        if (deviceId) {
          delOffersSql += ' WHERE flyer_id IN (SELECT id FROM flyers WHERE device_id = ?)';
          delOffersParams.push(String(deviceId).trim());
        }

        db.run(delOffersSql, delOffersParams, (errOffers) => {
          if (errOffers) {
            console.error(`[LIMPEZA DE ENCARTES] Erro ao limpar ofertas:`, errOffers.message);
            return reject(errOffers);
          }
          let delFlyersSql = 'DELETE FROM flyers';
          const delFlyersParams = [];
          if (deviceId) {
            delFlyersSql += ' WHERE device_id = ?';
            delFlyersParams.push(String(deviceId).trim());
          }
          db.run(delFlyersSql, delFlyersParams, function (errFlyers) {
            if (errFlyers) {
              console.error(`[LIMPEZA DE ENCARTES] Erro ao limpar encartes:`, errFlyers.message);
              return reject(errFlyers);
            }
            console.log(`🧹 [LIMPEZA DE ENCARTES] Encartes e ofertas removidos com sucesso (${reason}). Registros deletados: ${this.changes}.`);
            resolve(this.changes);
          });
        });
      });
    });
  });
}

// Rota para remover todos os encartes manualmente ou via front
app.delete('/api/flyers', async (req, res) => {
  const deviceId = req.query.deviceId || req.headers['x-device-id'];
  try {
    const deletedCount = await purgeAllFlyers('solicitação manual', deviceId ? String(deviceId).trim() : null);
    res.json({ success: true, message: 'Todos os encartes foram removidos com sucesso.', deleted: deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/flyers/:id', (req, res) => {
  const flyerId = parseInt(req.params.id, 10);
  const deviceId = req.query.deviceId || req.headers['x-device-id'];
  if (isNaN(flyerId)) {
    return res.status(400).json({ error: 'ID do encarte inválido.' });
  }

  let getSql = 'SELECT file_path, device_id FROM flyers WHERE id = ?';
  const getParams = [flyerId];
  if (deviceId) {
    getSql += ' AND device_id = ?';
    getParams.push(String(deviceId).trim());
  }

  db.get(getSql, getParams, (err, row) => {
    if (err || !row) {
      return res.status(404).json({ error: 'Encarte não encontrado ou não pertence a este dispositivo.' });
    }
    if (row && row.file_path && fs.existsSync(row.file_path)) {
      const targetPath = path.resolve(row.file_path);
      const resolvedUploads = path.resolve(uploadsDir);
      if (targetPath.startsWith(resolvedUploads)) {
        try { fs.unlinkSync(targetPath); } catch (e) {}
      }
    }
    db.serialize(() => {
      db.run('DELETE FROM offers WHERE flyer_id = ?', [flyerId]);
      db.run('DELETE FROM flyers WHERE id = ?', [flyerId], function (delErr) {
        if (delErr) return res.status(400).json({ error: delErr.message });
        res.json({ deleted: this.changes });
      });
    });
  });
});

// --- AUXILIARES DE PREVENÇÃO DE ENCARTES DUPLICADOS (CAMADA 1 & CAMADA 2) ---

function calculateBufferHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function checkDuplicateFlyerByHash(fileHash, deviceId = null) {
  return new Promise((resolve, reject) => {
    if (!fileHash) return resolve(null);
    let sql = 'SELECT id, supermarket_name, original_filename, uploaded_at FROM flyers WHERE file_hash = ?';
    const params = [fileHash];
    if (deviceId) {
      sql += ' AND device_id = ?';
      params.push(String(deviceId).trim());
    }
    sql += ' ORDER BY id DESC LIMIT 1';
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function checkDuplicateOffersForSupermarket(supermarketName, newOffers, deviceId = null) {
  return new Promise((resolve, reject) => {
    if (!supermarketName || !Array.isArray(newOffers) || newOffers.length === 0) {
      return resolve(null);
    }

    const cleanSupermarket = supermarketName.trim().toLowerCase();
    
    // Busca encartes existentes do mesmo supermercado cadastrados para este dispositivo
    let sql = `SELECT f.id, f.supermarket_name, f.original_filename, f.uploaded_at, o.product_name, o.price
       FROM flyers f
       JOIN offers o ON f.id = o.flyer_id
       WHERE LOWER(f.supermarket_name) LIKE ?`;
    const params = [`%${cleanSupermarket}%`];
    if (deviceId) {
      sql += ' AND f.device_id = ?';
      params.push(String(deviceId).trim());
    }
    sql += ' ORDER BY f.id DESC';

    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      if (!rows || rows.length === 0) return resolve(null);

        // Agrupa ofertas por encarte existente
        const existingFlyersMap = {};
        rows.forEach(r => {
          if (!existingFlyersMap[r.id]) {
            existingFlyersMap[r.id] = {
              id: r.id,
              supermarket_name: r.supermarket_name,
              original_filename: r.original_filename,
              uploaded_at: r.uploaded_at,
              offers: []
            };
          }
          existingFlyersMap[r.id].offers.push({
            name: (r.product_name || '').toLowerCase().trim(),
            price: Number(r.price)
          });
        });

        // Compara o novo encarte com os existentes
        for (const fId of Object.keys(existingFlyersMap)) {
          const existing = existingFlyersMap[fId];
          if (existing.offers.length === 0) continue;

          let matches = 0;
          newOffers.forEach(newOff => {
            const newName = (newOff.product_name || '').toLowerCase().trim();
            const newPrice = Number(newOff.price);

            const isDuplicateItem = existing.offers.some(exOff => {
              const samePrice = Math.abs(exOff.price - newPrice) < 0.05;
              const nameSimilarity = exOff.name === newName ||
                (exOff.name.length > 5 && newName.includes(exOff.name)) ||
                (newName.length > 5 && exOff.name.includes(newName));
              return samePrice && nameSimilarity;
            });

            if (isDuplicateItem) {
              matches++;
            }
          });

          // Se mais de 60% das ofertas ou mais de 8 ofertas forem idênticas ao encarte já existente
          const similarityRatio = matches / Math.min(newOffers.length, existing.offers.length);
          if (similarityRatio >= 0.60 || (matches >= 8 && similarityRatio >= 0.45)) {
            return resolve({
              duplicateFlyer: existing,
              matchesCount: matches,
              totalOffers: newOffers.length,
              similarityPercentage: Math.round(similarityRatio * 100)
            });
          }
        }

        resolve(null);
      }
    );
  });
}

// Função modular que audita encartes com o Gemini independente de ser multipart ou base64
async function processFlyerWithGemini({ base64Data, mimeType, originalName, apiKeyOverride, savedFilePath, savedFileType, fileHash, deviceId = null, familyCoreId = null }) {
  let apiKey = apiKeyOverride;
  if (!apiKey) {
    apiKey = process.env.GEMINI_API_KEY || (await getSetting('gemini_api_key'));
  }

  if (!apiKey) {
    throw new Error('Chave de API do Gemini não configurada! Vá até Ajustes para adicionar sua chave gratuita ou defina GEMINI_API_KEY no arquivo .env.');
  }

  // Busca itens ativos isolados estritamente pelo dispositivo e família
  const activeItems = await getActiveItems(deviceId, familyCoreId);
  const itemsListString = activeItems.map(i => {
    const brandConstraint = i.brand_preference && i.brand_preference.trim() 
      ? ` [MARCA OBRIGATÓRIA: "${i.brand_preference.trim()}"]` 
      : ' [MARCA LIVRE: buscar a opção mais barata do encarte]';
    const qtyConstraint = (i.quantity && i.quantity > 1) ? ` [QTD: ${i.quantity}]` : '';
    return `[ID: ${i.id}] ${i.name}${qtyConstraint}${brandConstraint}`;
  }).join('\n');

  const userCity = (await getSetting('user_city')) || '';
  const userState = (await getSetting('user_state')) || '';
  const locationString = userCity 
    ? `${userCity}${userState ? ` - ${userState}` : ''}` 
    : 'Brasil (mercado consumidor comum)';

  const ai = new GoogleGenAI({ apiKey });

    const prompt = `
Você é um auditor e comparador inteligente de encartes e ofertas de supermercados brasileiros especializado na economia da cidade/microrregião: "${locationString}".

TRAVA DE SEGURANÇA E VERIFICAÇÃO RIGOROSA DE ENCARTE (PRIMEIRO PASSO OBRIGATÓRIO):
Sua PRIMEIRA e mais importante missão é checar se o arquivo anexado é REALMENTE um encarte, panfleto, tabloide, cartaz ou folheto promocional de supermercado/atacado/hortifrúti contendo ofertas e preços anunciados.

- SE A IMAGEM FOR UMA FOTO COMUM DE CELULAR (selfie, pessoa, ambiente, sala, mesa, chão, teto, comida avulsa no prato, computador, recibo/cupom fiscal avulso, boleto, documento pessoal, objeto qualquer) ou QUALQUER coisa que NÃO seja claramente um folheto/cartaz promocional de supermercado com ofertas e preços:
  Você DEVE responder ESTRITAMENTE:
  {
    "is_valid_flyer": false,
    "rejection_reason": "Isso não é um encarte promocional de supermercado. O sistema descartou esta foto e nada foi cadastrado.",
    "supermarket_name": null,
    "offers": []
  }
  ATENÇÃO: NUNCA defina o nome do supermercado como "Desconhecido" nem "Supermercado" e NUNCA invente ofertas para imagens que não sejam encartes reais!

- SE A IMAGEM FOR UM ENCARTE/FOLHETO LEGÍTIMO COM PRODUTOS E PREÇOS:
  Defina "is_valid_flyer": true e extraia as ofertas e o nome real da rede de supermercado.

VARREDURA MULTI-PÁGINAS COMPLETA (MUITO IMPORTANTE):
- Documentos PDF podem conter MÚLTIPLAS PÁGINAS (folheie e analise TODAS as páginas do folheto: capa, páginas internas de todos os setores e contracapa). NUNCA pare na primeira página!
- O seu objetivo é extrair um conjunto rico e representativo de 35 a 55 ofertas no total, cobrindo o folheto de ponta a ponta.

CRUZAMENTO SEMÂNTICO INTELIGENTE COM A CESTA DO USUÁRIO (FAMÍLIA DE PRODUTO & PREFERÊNCIA DE MARCA):
Abaixo está a lista atual de compras cadastrada pelo usuário:
${itemsListString.length > 0 ? itemsListString : '(Nenhum item cadastrado no momento)'}

COMO FAZER O CRUZAMENTO COM A CESTA:
1. REGRA RIGOROSA DE MARCA ("brand_preference"):
   - Se o item tiver [MARCA OBRIGATÓRIA: "Marca X"], a IA DEVE ESTRITAMENTE corresponder àquela marca específica anunciada no encarte. IGNORE alternativas de marcas mais baratas se a marca não corresponder (ex: NÃO corresponda 'Arroz Alegrete' se a preferência for 'Pileco Nobre' ou 'Tio João').
   - Se o item tiver [MARCA LIVRE], busque a opção mais vantajosa dentro daquela família de produtos, mantendo coerência de qualidade.

2. REGRA RIGOROSA DE PESO, VOLUME E QUANTIDADE (OBRIGATÓRIO):
   - You MUST strictly match weight, volume, and quantity. A 5kg item on the list cannot be matched with a 2kg offer. If the exact weight/volume is not found, do NOT return a match.
   - Exemplo: Se o usuário tem "Açúcar Cristal 5kg" na lista, e a oferta anunciada no folheto é "Açúcar Cristal 2kg" ou "1kg", NÃO faça o match! (defina "matched_item_id": null e "matched_item_name": null).
   - Exemplo: Se o usuário tem "Arroz Tipo 1 5kg", NÃO vincule a pacotes de 1kg ou 2kg.
   - Exemplo: Se o usuário tem "Cerveja Lata 350ml", NÃO vincule a garrafas de 600ml ou latas de 269ml.
   - Somente faça o vínculo se o produto corresponder no tipo E exatamente no peso/volume/unidade especificados na lista. Caso o item da lista não especifique peso/unidade, vincule à embalagem padrão mais comum da família.

3. Prioridade de Coleta:
   - PRIORIDADE 1: Todas as ofertas encontradas em QUALQUER página do folheto que atendam à cesta do usuário (respeitando rigorosamente a restrição de marca e peso/volume exato).
   - PRIORIDADE 2: As maiores e melhores SUPER OFERTAS GERAIS do folheto (carnes, hortifrúti, laticínios, mercearia, higiene e limpeza com desconto expressivo) espalhadas pelas diversas páginas, para que o usuário conheça as grandes oportunidades da semana.
   - Se um produto do encarte NÃO tiver relação com a cesta do usuário ou tiver peso/marca divergente, defina "matched_item_id": null e "matched_item_name": null.

4. DATA DE VALIDADE DAS OFERTAS ("valid_until"):
   - Localize atentamente no encarte a data limite ou período de vigência das promoções (ex: "ofertas válidas de 10/10 a 18/10/2026", "válido até 18/10", "preços válidos até domingo 18/10").
   - Retorne no formato DD/MM/AAAA (ex: "18/10/2026"). Se o ano não estiver explícito, assuma o ano corrente. Se não houver qualquer menção de validade no encarte, retorne null.

LOCALIZAÇÃO E AUDITORIA DE PREÇOS (CRITÉRIOS RIGOROSOS):
- Cidade/Região do Usuário: "${locationString}".
- O preço regular ("estimated_regular_price") DEVE refletir com precisão e realismo o preço de gôndola comum e habitual praticado nos supermercados dessa cidade/microrregião específica para aquela EXATA quantidade/unidade anunciada no encarte. Seja realista e não infle o preço regular!
- "discount_percent": Math.round(((estimated_regular_price - price) / estimated_regular_price) * 100). (Mínimo 0).
- "deal_verdict" (SEJA CRITERIOSO - apenas ofertas realmente agressivas merecem super_oferta):
  * "super_oferta": Apenas para descontos agressivos reais (desconto >= 22% em relação à gôndola habitual).
  * "preco_normal": Para descontos moderados de rotina ou preço padrão de encarte (desconto entre 5% e 21%).
  * "falsa_promocao": Se o desconto for irrelevante (<= 4%) ou se o preço for igual/superior ao praticado no mercado.

Retorne ESTRITAMENTE um objeto JSON válido no formato:
{
  "is_valid_flyer": true | false,
  "rejection_reason": null ou "motivo caso não seja encarte",
  "supermarket_name": "Nome do Supermercado" ou null,
  "valid_until": "DD/MM/AAAA" ou null,
  "offers": [
    {
      "product_name": "Nome completo do produto com marca e peso",
      "price": 0.00,
      "unit": "un / kg / pack / pct / litro",
      "estimated_regular_price": 0.00,
      "discount_percent": 0,
      "deal_verdict": "super_oferta" | "preco_normal" | "falsa_promocao",
      "matched_item_id": 123 ou null,
      "matched_item_name": "Nome do item do usuário ou null"
    }
  ]
}
`;

  const response = await generateWithFallback(ai, {
    contents: [
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType || 'image/jpeg',
        },
      },
      prompt
    ],
    config: {
      responseMimeType: 'application/json',
    }
  });

  let parsedResult;
  try {
    const responseText = response.text.trim();
    parsedResult = JSON.parse(responseText);
  } catch (parseErr) {
    console.error('Falha ao parsear JSON retornado:', response.text);
    throw new Error('A IA não retornou um formato JSON válido. Tente novamente.');
  }

  const offers = Array.isArray(parsedResult.offers) ? parsedResult.offers : [];
  const rawSupermarket = (parsedResult.supermarket_name || '').trim();
  const validUntil = parsedResult.valid_until ? String(parsedResult.valid_until).trim() : null;
  const isSupermarketInvalid = !rawSupermarket || 
    rawSupermarket.toLowerCase().includes('desconhecido') || 
    rawSupermarket.toLowerCase().includes('não identificado') ||
    rawSupermarket.toLowerCase() === 'supermercado';

  // Trava de Segurança: Se não for encarte ou não tiver ofertas válidas, joga fora e avisa o usuário sem gravar nada no banco
  if (
    parsedResult.is_valid_flyer === false || 
    offers.length === 0 || 
    (isSupermarketInvalid && offers.length < 2)
  ) {
    const reason = parsedResult.rejection_reason || 'Isso não é um encarte promocional de supermercado. O sistema descartou esta foto e nada foi cadastrado.';
    console.log(`🛡️ [TRAVA DE SEGURANÇA ATIVADA] Imagem descartada pelo Gemini: ${reason}`);
    const rejectionError = new Error(reason);
    rejectionError.isFlyerRejection = true;
    throw rejectionError;
  }

  const supermarketName = rawSupermarket || 'Supermercado';

  // CAMADA 2: Verificação Semântica por Supermercado e Ofertas Similares (escopada por dispositivo)
  const duplicateOffersCheck = await checkDuplicateOffersForSupermarket(supermarketName, offers, deviceId);
  if (duplicateOffersCheck) {
    const dupMsg = `O encarte do "${supermarketName}" já possui ${duplicateOffersCheck.matchesCount} ofertas idênticas cadastradas (${duplicateOffersCheck.similarityPercentage}% de similaridade). O sistema descartou para evitar ofertas duplicadas na sua lista.`;
    console.log(`🛡️ [DUPLICIDADE SEMÂNTICA BLOQUEADA] ${dupMsg}`);
    const dupErr = new Error(dupMsg);
    dupErr.isDuplicateFlyer = true;
    dupErr.duplicateDetails = duplicateOffersCheck;
    throw dupErr;
  }

  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO flyers (supermarket_name, original_filename, file_path, file_type, file_hash, valid_until, device_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [supermarketName, originalName || 'Encarte', savedFilePath || null, savedFileType || mimeType || null, fileHash || null, validUntil, deviceId ? String(deviceId).trim() : null],
      function (err) {
        if (err) return reject(err);
        const flyerId = this.lastID;

        const stmt = db.prepare(`
          INSERT INTO offers (
            flyer_id, product_name, price, unit, regular_price, deal_verdict, discount_percent, matched_item_id, matched_item_name
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        offers.forEach(offer => {
          const price = typeof offer.price === 'number' ? offer.price : parseFloat(offer.price) || 0;
          const regPrice = typeof offer.estimated_regular_price === 'number' 
            ? offer.estimated_regular_price 
            : parseFloat(offer.estimated_regular_price) || (price > 0 ? Number((price * 1.05).toFixed(2)) : 0);
          
          let discount = typeof offer.discount_percent === 'number' 
            ? offer.discount_percent 
            : (regPrice > price ? Math.round(((regPrice - price) / regPrice) * 100) : 0);

          let verdict = offer.deal_verdict;
          // Calibração Razoável: Super Oferta somente com desconto real >= 22%
          if (!['super_oferta', 'preco_normal', 'falsa_promocao'].includes(verdict)) {
            verdict = discount >= 22 ? 'super_oferta' : (discount >= 5 ? 'preco_normal' : 'falsa_promocao');
          } else if (verdict === 'super_oferta' && discount < 22) {
            // Re-calibra caso o modelo tenha forçado super_oferta em um desconto pequeno
            verdict = discount >= 5 ? 'preco_normal' : 'falsa_promocao';
          }

          stmt.run([
            flyerId,
            offer.product_name,
            price,
            offer.unit || 'un',
            regPrice,
            verdict,
            discount,
            offer.matched_item_id || null,
            offer.matched_item_name || null
          ]);
        });

        stmt.finalize(() => {
          const matchedCount = offers.filter(o => o.matched_item_id !== null).length;
          resolve({
            success: true,
            flyer_id: flyerId,
            supermarket_name: supermarketName,
            total_offers: offers.length,
            matched_offers_count: matchedCount,
            offers: offers,
            file_path: savedFilePath,
            file_type: savedFileType || mimeType
          });
        });
      }
    );
  });
}

// Rota 1: Upload multipart/form-data tradicional
app.post('/api/flyers/upload', aiRateLimiter(15, 60000), upload.single('flyer'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado. Selecione um PDF ou Imagem.' });
  }

  const deviceId = req.body.deviceId || req.query.deviceId || req.headers['x-device-id'] || null;
  const familyCoreId = req.body.familyCoreId || req.query.familyCoreId || req.headers['x-family-core-id'] || null;

  const tempFilePath = req.file.path;
  const originalName = req.file.originalname;
  const mimeType = req.file.mimetype || (originalName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
  const ext = mimeType === 'application/pdf' ? '.pdf' : (path.extname(originalName) || '.jpg');
  const permanentFileName = `flyer_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`;
  const permanentFilePath = path.join(uploadsDir, permanentFileName);

  try {
    fs.renameSync(tempFilePath, permanentFilePath);
    const fileBuffer = fs.readFileSync(permanentFilePath);
    
    // CAMADA 1: Checagem por Hash SHA-256 antes de consumir IA (escopada por aparelho)
    const fileHash = calculateBufferHash(fileBuffer);
    const duplicateByHash = await checkDuplicateFlyerByHash(fileHash, deviceId);
    if (duplicateByHash) {
      if (fs.existsSync(permanentFilePath)) fs.unlinkSync(permanentFilePath);
      return res.status(409).json({
        success: false,
        is_duplicate: true,
        error: `Este encarte já foi cadastrado anteriormente (${duplicateByHash.supermarket_name}) e está ativo no sistema.`
      });
    }

    const base64Data = fileBuffer.toString('base64');
    const apiKey = req.headers['x-gemini-api-key'] || req.body.gemini_api_key;

    const result = await processFlyerWithGemini({
      base64Data,
      mimeType,
      originalName,
      apiKeyOverride: apiKey,
      savedFilePath: permanentFilePath,
      savedFileType: mimeType,
      fileHash,
      deviceId,
      familyCoreId
    });

    res.json(result);
  } catch (err) {
    console.error('Erro ao processar encarte multipart:', err.message);
    if (fs.existsSync(permanentFilePath)) fs.unlinkSync(permanentFilePath);
    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    const isRejection = err.isFlyerRejection || err.message.includes('não é um encarte') || err.message.includes('descartad');
    const isDuplicate = err.isDuplicateFlyer || err.message.includes('duplicad');
    res.status(isDuplicate ? 409 : (isRejection ? 400 : 500)).json({ 
      success: false,
      is_not_flyer: isRejection,
      is_duplicate: isDuplicate,
      error: err.message 
    });
  }
});

// Rota 2: Upload base64 (Ultra robusto para React Native / Expo no Android e iOS)
app.post('/api/flyers/upload-base64', aiRateLimiter(15, 60000), async (req, res) => {
  const { base64Data, mimeType, fileName } = req.body;
  const deviceId = req.body.deviceId || req.query.deviceId || req.headers['x-device-id'] || null;
  const familyCoreId = req.body.familyCoreId || req.query.familyCoreId || req.headers['x-family-core-id'] || null;

  if (!base64Data) {
    return res.status(400).json({ error: 'Nenhum dado base64 recebido.' });
  }

  const cleanBase64 = base64Data.replace(/^data:([A-Za-z-+\/]+);base64,/, '');
  const detectedMime = mimeType || (cleanBase64.startsWith('JVBERi0') ? 'application/pdf' : 'image/jpeg');

  // Validação estrita de tipo de arquivo
  if (!ALLOWED_MIME_TYPES.includes(detectedMime)) {
    return res.status(400).json({ error: 'Tipo de arquivo não permitido. Apenas PDF, JPG, PNG e WEBP são aceitos.' });
  }

  const ext = detectedMime === 'application/pdf' ? '.pdf' : (detectedMime === 'image/png' ? '.png' : (detectedMime === 'image/webp' ? '.webp' : '.jpg'));
  const permanentFileName = `flyer_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`;
  const permanentFilePath = path.join(uploadsDir, permanentFileName);

  try {
    const fileBuffer = Buffer.from(cleanBase64, 'base64');

    // CAMADA 1: Checagem por Hash SHA-256 antes de consumir IA (escopada por aparelho)
    const fileHash = calculateBufferHash(fileBuffer);
    const duplicateByHash = await checkDuplicateFlyerByHash(fileHash, deviceId);
    if (duplicateByHash) {
      return res.status(409).json({
        success: false,
        is_duplicate: true,
        error: `Este encarte já foi cadastrado anteriormente (${duplicateByHash.supermarket_name}) e está ativo no sistema.`
      });
    }

    fs.writeFileSync(permanentFilePath, fileBuffer);

    const apiKey = req.headers['x-gemini-api-key'] || req.body.gemini_api_key;
    const result = await processFlyerWithGemini({
      base64Data: cleanBase64,
      mimeType: detectedMime,
      originalName: fileName || `encarte${ext}`,
      apiKeyOverride: apiKey,
      savedFilePath: permanentFilePath,
      savedFileType: detectedMime,
      fileHash,
      deviceId,
      familyCoreId
    });

    res.json(result);
  } catch (err) {
    console.error('Erro ao processar encarte base64:', err.message);
    if (fs.existsSync(permanentFilePath)) fs.unlinkSync(permanentFilePath);
    const isRejection = err.isFlyerRejection || err.message.includes('não é um encarte') || err.message.includes('descartad');
    const isDuplicate = err.isDuplicateFlyer || err.message.includes('duplicad');
    res.status(isDuplicate ? 409 : (isRejection ? 400 : 500)).json({ 
      success: false,
      is_not_flyer: isRejection,
      is_duplicate: isDuplicate,
      error: err.message 
    });
  }
});

// --- AGENDADOR AUTOMÁTICO DE LIMPEZA DE ENCARTES (DOMINGO ÀS 22:00h) ---

async function checkAndRunSundayPurge() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Domingo
  const hour = now.getHours();     // 22 = 22h

  // Verifica se é domingo a partir das 22:00h
  if (dayOfWeek === 0 && hour >= 22) {
    const todayKey = `last_sunday_purge_${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}_${String(now.getDate()).padStart(2, '0')}`;
    try {
      const alreadyPurged = await getSetting(todayKey);
      if (!alreadyPurged) {
        console.log(`⏰ [AGENDADOR] Domingo ${now.toLocaleTimeString('pt-BR')} detectado. Iniciando limpeza automática dos encartes da semana...`);
        await purgeAllFlyers(`Rotina semanal automática de Domingo às 22:00h (${now.toLocaleDateString('pt-BR')})`);
        await setSetting(todayKey, now.toISOString());
        console.log(`✅ [AGENDADOR] Limpeza de domingo concluída e registrada com sucesso.`);
      }
    } catch (err) {
      console.error(`[AGENDADOR] Falha ao verificar/executar limpeza automática de domingo:`, err.message);
    }
  }
}

function startWeeklyFlyerPurgeScheduler() {
  console.log(`🕒 [AGENDADOR] Monitor de ciclo de encartes ativado: Limpeza automática configurada para todo Domingo às 22:00h.`);
  // Executa uma checagem imediata na inicialização
  checkAndRunSundayPurge();
  // Checa periodicamente a cada 60 segundos
  setInterval(checkAndRunSundayPurge, 60 * 1000);
}

server.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
  startWeeklyFlyerPurgeScheduler();
});
