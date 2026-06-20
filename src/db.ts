import type Database from 'better-sqlite3';
import { mkdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { Note, SearchHit, VaultModel } from './types.js';

const require = createRequire(import.meta.url);

/**
 * Lazily load the better-sqlite3 native module so a missing/unbuilt binding
 * fails with an actionable message instead of an opaque import-time crash.
 */
let DatabaseCtor: typeof import('better-sqlite3') | undefined;
function loadDatabase(): typeof import('better-sqlite3') {
  if (!DatabaseCtor) {
    try {
      DatabaseCtor = require('better-sqlite3') as typeof import('better-sqlite3');
    } catch (e) {
      throw new Error(
        'vault-brain: failed to load the better-sqlite3 native module. ' +
          'Run `npm rebuild better-sqlite3` (needs Python 3 + a C/C++ toolchain), ' +
          'or reinstall with `npm ci`. Original error: ' +
          (e as Error).message,
      );
    }
  }
  return DatabaseCtor;
}

export interface IndexStats {
  total: number;
  updated: number;
  removed: number;
  links: number;
}

/** Create tables and FTS5 virtual table. Safe to call on an existing db (no-ops). */
export function createSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id        TEXT PRIMARY KEY,
      path      TEXT NOT NULL,
      title     TEXT,
      type      TEXT,
      summary   TEXT,
      body      TEXT,
      file_hash TEXT
    );
    CREATE TABLE IF NOT EXISTS links (
      source_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      PRIMARY KEY (source_id, target_id)
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
      id      UNINDEXED,
      title,
      summary,
      body,
      tokenize = 'unicode61'
    );
  `);
}

/** Open (or create) the vault's SQLite index at <vaultRoot>/.brain/vault-brain.sqlite. */
export function openDb(vaultRoot: string): Database.Database {
  const DB = loadDatabase();
  const dbPath = path.join(vaultRoot, '.brain', 'vault-brain.sqlite');
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DB(dbPath);
  db.pragma('journal_mode = WAL');
  createSchema(db);
  return db;
}

function fileHash(absPath: string): string {
  try {
    const s = statSync(absPath);
    return createHash('sha1').update(`${s.mtimeMs}:${s.size}`).digest('hex');
  } catch {
    return '';
  }
}

interface WriteStmts {
  getNote: Database.Statement<[string], { file_hash: string | null }>;
  upsertNote: Database.Statement;
  deleteFts: Database.Statement;
  insertFts: Database.Statement;
  deleteLinks: Database.Statement;
  insertLink: Database.Statement;
}

function writeStmts(db: Database.Database): WriteStmts {
  return {
    getNote: db.prepare<[string], { file_hash: string | null }>(
      'SELECT file_hash FROM notes WHERE id = ?',
    ),
    upsertNote: db.prepare(`
      INSERT INTO notes (id, path, title, type, summary, body, file_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        path=excluded.path, title=excluded.title, type=excluded.type,
        summary=excluded.summary, body=excluded.body, file_hash=excluded.file_hash
    `),
    deleteFts: db.prepare('DELETE FROM notes_fts WHERE id = ?'),
    insertFts: db.prepare('INSERT INTO notes_fts (id, title, summary, body) VALUES (?, ?, ?, ?)'),
    deleteLinks: db.prepare('DELETE FROM links WHERE source_id = ?'),
    insertLink: db.prepare('INSERT OR IGNORE INTO links (source_id, target_id) VALUES (?, ?)'),
  };
}

/** Write one note's row + FTS + links if its file hash changed. Returns true if written. */
function writeOne(s: WriteStmts, vaultRoot: string, n: Note): boolean {
  const hash = fileHash(path.join(vaultRoot, n.file));
  const existing = s.getNote.get(n.id);
  if (existing?.file_hash === hash) return false;
  s.upsertNote.run(n.id, n.path, n.title, n.type, n.summary, n.body, hash);
  s.deleteFts.run(n.id);
  s.insertFts.run(n.id, n.title ?? '', n.summary ?? '', n.body ?? '');
  s.deleteLinks.run(n.id);
  for (const target of n.outlinks) s.insertLink.run(n.id, target);
  return true;
}

/**
 * Upsert vault notes into SQLite with incremental re-index by file hash, and
 * prune rows for notes that no longer exist in the vault.
 */
export function indexVault(vault: VaultModel, db: Database.Database): IndexStats {
  const s = writeStmts(db);
  const allIds = db.prepare<[], { id: string }>('SELECT id FROM notes');
  let updated = 0;
  let removed = 0;

  const tx = db.transaction((notes: Note[]) => {
    for (const n of notes) {
      if (writeOne(s, vault.root, n)) updated++;
    }
    // prune: delete rows for ids no longer present in the vault
    const present = new Set(notes.map((n) => n.id));
    for (const { id } of allIds.all()) {
      if (!present.has(id)) {
        s.deleteFts.run(id);
        s.deleteLinks.run(id);
        db.prepare('DELETE FROM notes WHERE id = ?').run(id);
        removed++;
      }
    }
  });

  tx(vault.notes);

  const totalLinks = vault.notes.reduce((acc, n) => acc + n.outlinks.length, 0);
  return { total: vault.notes.length, updated, removed, links: totalLinks };
}

/** Upsert a single note into the index (used by memory write-back). */
export function upsertNote(db: Database.Database, vaultRoot: string, note: Note): void {
  const s = writeStmts(db);
  db.transaction(() => writeOne(s, vaultRoot, note))();
}

function buildFtsQuery(raw: string): string {
  const terms = (raw.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length > 1);
  // Prefix search: "store*" matches "store", "stored", "stores", etc.
  return terms.map((t) => `${t}*`).join(' ');
}

/** Full-text search via FTS5 with BM25 ranking. Falls back to [] on parse errors. */
export function searchFts(
  db: Database.Database,
  query: string,
  k: number,
  excludeTypes: string[] = [],
): SearchHit[] {
  const q = buildFtsQuery(query);
  if (!q) return [];
  try {
    type Row = { id: string; path: string; title: string; summary: string; rank: number };
    const exFilter = excludeTypes.length
      ? `AND n.type NOT IN (${excludeTypes.map(() => '?').join(', ')})`
      : '';
    const rows = db
      .prepare(`
        SELECT n.id, n.path, n.title, n.summary, bm25(notes_fts) AS rank
        FROM notes_fts
        JOIN notes n ON n.id = notes_fts.id
        WHERE notes_fts MATCH ? ${exFilter}
        ORDER BY rank
        LIMIT ?
      `)
      .all(q, ...excludeTypes, k) as Row[];
    return rows.map((r) => ({
      id: r.id,
      path: r.path,
      title: r.title ?? r.id,
      score: Math.round(-r.rank * 100) / 100,
      snippet: r.summary || '',
    }));
  } catch {
    return [];
  }
}
