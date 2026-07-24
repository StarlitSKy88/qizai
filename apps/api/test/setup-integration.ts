// T06+T07 stepping-stone setup file.
// Applies D1 migrations to the per-suite DB before integration tests run.
// T08 will harden this (per-test isolation, cleanup helpers).
import { applyD1Migrations } from 'cloudflare:test';
import { env } from 'cloudflare:workers';

await env.DB.exec("PRAGMA foreign_keys = ON;");
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);