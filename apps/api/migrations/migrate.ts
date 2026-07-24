// apps/api/migrations/migrate.ts
import fs from 'node:fs';
import path from 'node:path';

const MIGRATIONS_DIR = path.join(import.meta.dirname, '..', 'migrations');

export async function applyMigrations(local: D1Database): Promise<void> {
  const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    const statements = sql.split('--> statement-breakpoint');
    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (trimmed) await local.exec(trimmed);
    }
  }
}

// CLI usage: `wrangler d1 migrations apply qizai-db --local`
export function main() {
  console.log('Run via: cd apps/api && npx wrangler d1 migrations apply qizai-db --local');
}
if (import.meta.main) main();
