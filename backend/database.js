const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'app.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    
    // Create tables
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          is_active BOOLEAN DEFAULT 1,
          quantity INTEGER DEFAULT 1,
          brand_preference TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run("ALTER TABLE items ADD COLUMN quantity INTEGER DEFAULT 1", () => {});
      db.run("ALTER TABLE items ADD COLUMN brand_preference TEXT", () => {});
      db.run("ALTER TABLE items ADD COLUMN family_core_id INTEGER", () => {});
      db.run("ALTER TABLE items ADD COLUMN device_id TEXT", () => {});
      db.run("ALTER TABLE items ADD COLUMN offer_snapshot TEXT", () => {});
      db.run("ALTER TABLE items ADD COLUMN version INTEGER DEFAULT 0", () => {});
      db.run("ALTER TABLE items ADD COLUMN purchased INTEGER DEFAULT 0", () => {});
      db.run("ALTER TABLE items ADD COLUMN canonical_product_id TEXT", () => {});
      db.run("ALTER TABLE items ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP", () => {});
      db.run("CREATE INDEX IF NOT EXISTS idx_items_family_core ON items(family_core_id)", () => {});
      db.run("CREATE INDEX IF NOT EXISTS idx_items_device ON items(device_id)", () => {});

      db.run(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS flyers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          supermarket_name TEXT NOT NULL,
          original_filename TEXT,
          file_path TEXT,
          file_type TEXT,
          file_hash TEXT,
          uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run("ALTER TABLE flyers ADD COLUMN file_path TEXT", () => {});
      db.run("ALTER TABLE flyers ADD COLUMN file_type TEXT", () => {});
      db.run("ALTER TABLE flyers ADD COLUMN file_hash TEXT", () => {});
      db.run("ALTER TABLE flyers ADD COLUMN valid_until TEXT", () => {});
      db.run("ALTER TABLE flyers ADD COLUMN device_id TEXT", () => {});
      db.run("CREATE INDEX IF NOT EXISTS idx_flyers_device ON flyers(device_id)", () => {});

      db.run(`
        CREATE TABLE IF NOT EXISTS offers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          flyer_id INTEGER,
          product_name TEXT NOT NULL,
          price REAL NOT NULL,
          unit TEXT,
          regular_price REAL,
          deal_verdict TEXT,
          discount_percent REAL,
          matched_item_id INTEGER,
          matched_item_name TEXT,
          FOREIGN KEY (flyer_id) REFERENCES flyers (id),
          FOREIGN KEY (matched_item_id) REFERENCES items (id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS brazilian_cities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uf TEXT NOT NULL,
          name TEXT NOT NULL,
          normalized_name TEXT NOT NULL
        )
      `);
      db.run("CREATE INDEX IF NOT EXISTS idx_brazilian_cities_uf ON brazilian_cities(uf)", () => {});

      // --- SCHEMA COMERCIAL & ENTITLEMENTS (FREEMIUM / BILLING / FAMILY CORE / B2B) ---

      db.run(`
        CREATE TABLE IF NOT EXISTS accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE,
          device_id TEXT,
          role TEXT DEFAULT 'user',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS purchases (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_id INTEGER,
          product_id TEXT NOT NULL,
          transaction_id TEXT UNIQUE NOT NULL,
          store TEXT NOT NULL,
          status TEXT NOT NULL,
          verified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (account_id) REFERENCES accounts(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS family_cores (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          owner_account_id INTEGER NOT NULL,
          subscription_status TEXT DEFAULT 'active',
          subscription_expires_at DATETIME,
          max_devices INTEGER DEFAULT 3,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (owner_account_id) REFERENCES accounts(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS family_devices (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          family_core_id INTEGER NOT NULL,
          device_id TEXT NOT NULL,
          device_name TEXT,
          is_owner BOOLEAN DEFAULT 0,
          status TEXT DEFAULT 'active',
          authorized_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          revoked_at DATETIME,
          FOREIGN KEY (family_core_id) REFERENCES family_cores(id),
          UNIQUE(family_core_id, device_id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS family_invitations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          family_core_id INTEGER NOT NULL,
          code TEXT UNIQUE NOT NULL,
          expires_at DATETIME NOT NULL,
          is_used BOOLEAN DEFAULT 0,
          used_by_device_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (family_core_id) REFERENCES family_cores(id)
        )
      `);

      // Migrações incrementais para o ciclo de vida do Core Familiar e Sincronização
      db.run("ALTER TABLE family_cores ADD COLUMN status TEXT DEFAULT 'active'", () => {});
      db.run("ALTER TABLE family_cores ADD COLUMN canceled_at DATETIME", () => {});
      db.run("ALTER TABLE family_cores ADD COLUMN expired_at DATETIME", () => {});
      db.run("ALTER TABLE family_cores ADD COLUMN purge_at DATETIME", () => {});
      db.run("ALTER TABLE family_cores ADD COLUMN list_version INTEGER DEFAULT 0", () => {});
      db.run("ALTER TABLE family_cores ADD COLUMN updated_at DATETIME", () => {});

      db.run("ALTER TABLE family_devices ADD COLUMN left_at DATETIME", () => {});

      db.run(`
        CREATE TABLE IF NOT EXISTS sync_operations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          operation_id TEXT UNIQUE NOT NULL,
          family_core_id INTEGER NOT NULL,
          device_id TEXT NOT NULL,
          operation_type TEXT NOT NULL,
          entity_id TEXT,
          payload TEXT,
          client_version INTEGER,
          server_version INTEGER,
          status TEXT DEFAULT 'processed',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (family_core_id) REFERENCES family_cores(id)
        )
      `);
      db.run("CREATE INDEX IF NOT EXISTS idx_sync_ops_core ON sync_operations(family_core_id, server_version)", () => {});
      db.run("CREATE INDEX IF NOT EXISTS idx_sync_ops_opid ON sync_operations(operation_id)", () => {});

      db.run(`
        CREATE TABLE IF NOT EXISTS retailers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          legal_name TEXT NOT NULL,
          trade_name TEXT NOT NULL,
          cnpj TEXT UNIQUE,
          status TEXT DEFAULT 'pending_approval',
          verified_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS retail_stores (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          retailer_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          city TEXT NOT NULL,
          uf TEXT NOT NULL,
          address TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (retailer_id) REFERENCES retailers(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS retail_offers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          retailer_id INTEGER NOT NULL,
          store_id INTEGER,
          product_name TEXT NOT NULL,
          description TEXT,
          regular_price REAL,
          promo_price REAL NOT NULL,
          unit TEXT,
          conditions TEXT,
          valid_from DATETIME NOT NULL,
          valid_until DATETIME NOT NULL,
          city TEXT,
          uf TEXT NOT NULL,
          stock_declared INTEGER,
          status TEXT DEFAULT 'draft',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (retailer_id) REFERENCES retailers(id),
          FOREIGN KEY (store_id) REFERENCES retail_stores(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS offer_moderation_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          offer_id INTEGER NOT NULL,
          action TEXT NOT NULL,
          reason TEXT,
          performed_by TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (offer_id) REFERENCES retail_offers(id)
        )
      `);

      db.run("CREATE INDEX IF NOT EXISTS idx_retail_offers_region ON retail_offers(uf, city, status)", () => {});
      db.run("CREATE INDEX IF NOT EXISTS idx_family_devices_core ON family_devices(family_core_id, status)", () => {});
    });
  }
});

module.exports = db;
