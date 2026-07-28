import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export function openDatabase(filename) {
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true })
  const db = new DatabaseSync(filename)
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;')
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
      plan TEXT NOT NULL DEFAULT 'trial', created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('owner','manager','agent')), created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS channel_connections (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      provider TEXT NOT NULL, external_id TEXT NOT NULL, display_name TEXT NOT NULL,
      encrypted_token TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', created_at INTEGER NOT NULL,
      UNIQUE(tenant_id, provider, external_id)
    );
    CREATE TABLE IF NOT EXISTS sync_events (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      provider TEXT NOT NULL, event_type TEXT NOT NULL, external_id TEXT,
      payload TEXT NOT NULL, created_at INTEGER NOT NULL, delivered_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS ai_profiles (
      tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
      business_name TEXT NOT NULL, tone TEXT NOT NULL DEFAULT 'friendly',
      instructions TEXT NOT NULL DEFAULT '', safety_mode TEXT NOT NULL DEFAULT 'suggest', updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ai_knowledge (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      title TEXT NOT NULL, content TEXT NOT NULL, tags TEXT NOT NULL DEFAULT '[]',
      enabled INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '',
      channel TEXT NOT NULL DEFAULT 'manual', external_id TEXT, tags TEXT NOT NULL DEFAULT '[]', note TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS customers_tenant_updated ON customers(tenant_id, updated_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS customers_social_identity ON customers(tenant_id, channel, external_id) WHERE external_id IS NOT NULL AND external_id <> '';
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      sku TEXT NOT NULL, name TEXT NOT NULL, price INTEGER NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      UNIQUE(tenant_id, sku)
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL, code TEXT NOT NULL,
      total INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'draft', note TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      UNIQUE(tenant_id, code)
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id TEXT REFERENCES products(id) ON DELETE SET NULL, name TEXT NOT NULL,
      quantity INTEGER NOT NULL, unit_price INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS oauth_flows (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, provider TEXT NOT NULL,
      state_hash TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'pending',
      error TEXT, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS oauth_assets (
      id TEXT PRIMARY KEY, flow_id TEXT NOT NULL REFERENCES oauth_flows(id) ON DELETE CASCADE,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, provider TEXT NOT NULL,
      external_id TEXT NOT NULL, display_name TEXT NOT NULL, encrypted_token TEXT NOT NULL,
      parent_external_id TEXT, metadata TEXT NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS sync_events_pending ON sync_events(tenant_id, delivered_at, created_at);
    CREATE INDEX IF NOT EXISTS oauth_flows_owner ON oauth_flows(tenant_id, user_id, created_at);
    CREATE INDEX IF NOT EXISTS ai_knowledge_tenant ON ai_knowledge(tenant_id, enabled, updated_at);
  `)
  ensureColumn(db,'channel_connections','webhook_secret_hash','TEXT')
  ensureColumn(db,'channel_connections','metadata',"TEXT NOT NULL DEFAULT '{}'")
  ensureColumn(db,'sync_events','source_connection_id','TEXT')
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS sync_event_dedupe ON sync_events(tenant_id,provider,source_connection_id,external_id,event_type) WHERE source_connection_id IS NOT NULL AND external_id IS NOT NULL')
  return db
}

function ensureColumn(db,table,column,declaration){const exists=db.prepare(`PRAGMA table_info(${table})`).all().some(row=>row.name===column);if(!exists)db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${declaration}`)}

export function publicTenant(row) { return row && { id: row.id, name: row.name, slug: row.slug, plan: row.plan, createdAt: row.created_at } }
export function publicUser(row) { return row && { id: row.id, tenantId: row.tenant_id, name: row.name, email: row.email, role: row.role, createdAt: row.created_at } }
