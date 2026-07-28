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
  `)
  return db
}

export function publicTenant(row) { return row && { id: row.id, name: row.name, slug: row.slug, plan: row.plan, createdAt: row.created_at } }
export function publicUser(row) { return row && { id: row.id, tenantId: row.tenant_id, name: row.name, email: row.email, role: row.role, createdAt: row.created_at } }
