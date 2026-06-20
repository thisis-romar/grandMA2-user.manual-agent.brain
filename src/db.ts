import Database from 'better-sqlite3';
import { mkdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import type { Note, SearchHit, VaultModel } from './types.js';

export interface IndexStats {
  total: number;
  updated: number;
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
  const dbPath = path.join(vaultRoot, '.brain', 'vault-brain.sqlite');
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
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

/**
 * Upsert vault notes into SQLite with incremental re-index by file hash.
 * Only notes whose mtime/size changed (or new notes) are written.
 */
export function indexVault(vault: VaultModel, db: Database.Database): IndexStats {
  const getNote = db.prepare<[string], { file_hash: string | null }>(
    'SELECT file_hash FROM notes WHERE id = ?',
  );
  const upsertNote = db.prepare(`
    INSERT INTO notes (id, path, title, type, summary, body, file_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      path=excluded.path, title=excluded.title, type=excluded.type,
      summary=excluded.summary, body=excluded.body, file_hash=excluded.file_hash
  `);
  const deleteFts = db.prepare('DELETE FROM notes_fts WHERE id = ?');
  const insertFts = db.prepare(
    'INSERT INTO notes_fts (id, title, summary, body) VALUES (?, ?, ?, ?)',
  );
  const deleteLinks = db.prepare('DELETE FROM links WHERE source_id = ?');
  const insertLink = db.prepare(
    'INSERT OR IGNORE INTO links (source_id, target_id) VALUES (?, ?)',
  );

  let updated = 0;

  const tx = db.transaction((notes: Note[]) => {
    for (const n of notes) {
      const hash = fileHash(path.join(vault.root, n.file));
      const existing = getNote.get(n.id);
      if (existing?.file_hash !== hash) {
        upsertNote.run(n.id, n.path, n.title, n.type, n.summary, n.body, hash);
        deleteFts.run(n.id);
        insertFts.run(n.id, n.title ?? '', n.summary ?? '', n.body ?? '');
        deleteLinks.run(n.id);
        for (const target of n.outlinks) {
          insertLink.run(n.id, target);
        }
        updated++;
      }
    }
  });

  tx(vault.notes);

  const totalLinks = vault.notes.reduce((acc, n) => acc + n.outlinks.length, 0);
  return { total: vault.notes.length, updated, links: totalLinks };
}

function buildFtsQuery(raw: string): string {
  const terms = (raw.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length > 1);
  // Prefix search: "store*" matches "store", "stored", "stores", etc.
  return terms.map((t) => `${t}*`).join(' ');
}

/** Full-text search via FTS5 with BM25 ranking. Falls back to [] on parse errors. */
export function searchFts(db: Database.Database, query: string, k: number): SearchHit[] {
  const q = buildFtsQuery(query);
  if (!q) return [];
  try {
    type Row = { id: string; path: string; title: string; summary: string; rank: number };
    const rows = db
      .prepare<[string, number], Row>(`
        SELECT n.id, n.path, n.title, n.summary, bm25(notes_fts) AS rank
        FROM notes_fts
        JOIN notes n ON n.id = notes_fts.id
        WHERE notes_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `)
      .all(q, k);
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
