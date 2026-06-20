import { promises as fs } from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';
import type { Note, VaultModel } from './types.js';
import { upsertNote } from './db.js';

export interface WriteNoteInput {
  type: string;
  title: string;
  body: string;
  summary?: string;
  links?: string[];
}

/** Validate a proposed note against the manifest (P0: type + required scalars). */
export function validateNote(model: VaultModel, input: WriteNoteInput): string[] {
  const errs: string[] = [];
  if (!input.type) errs.push('type is required');
  if (!input.title) errs.push('title is required');
  if (!input.body) errs.push('body is required');
  const folder = Object.entries(model.manifest.taxonomy.folders).find(
    ([, t]) => t === input.type,
  )?.[0];
  if (!folder) errs.push(`unknown type "${input.type}" (not in manifest.taxonomy.folders)`);
  return errs;
}

/** Reduce arbitrary text to a safe single-path-segment basename (no separators, no traversal). */
function safeBasename(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (!base) throw new Error(`title "${title}" has no usable filename characters`);
  return base;
}

/**
 * Append a new manifest-conformant note to the vault (agent memory write-back).
 * Validation gates the write; the host repo's git history is the audit log.
 * When `db` is supplied, the new note is indexed immediately (searchable now).
 */
export async function writeNote(
  model: VaultModel,
  input: WriteNoteInput,
  db?: Database.Database,
): Promise<string> {
  const errs = validateNote(model, input);
  if (errs.length) throw new Error('invalid note: ' + errs.join('; '));
  const folder = Object.entries(model.manifest.taxonomy.folders).find(
    ([, t]) => t === input.type,
  )![0];
  const slug = safeBasename(input.title);
  const file = `${folder}${slug}.md`;

  // Defense in depth: the resolved path must stay inside the vault root.
  const root = path.resolve(model.root);
  const full = path.resolve(root, file);
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new Error(`refusing to write outside vault root: ${file}`);
  }

  const notePath = file.replace(/\.md$/, '');
  const lines = [
    '---',
    `type: "${input.type}"`,
    `slug: "${slug}"`,
    ...(input.summary ? [`summary: ${JSON.stringify(input.summary)}`] : []),
    'tags:',
    `  - "type/${input.type}"`,
    '---',
    '',
    `# ${input.title}`,
    '',
    input.body,
  ];
  if (input.links?.length) {
    lines.push('', '## Related', ...input.links.map((l) => `- [[${l}]]`));
  }
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, lines.join('\n') + '\n', 'utf8');

  if (db) {
    const note: Note = {
      id: slug,
      path: notePath,
      file,
      type: input.type,
      title: input.title,
      summary: input.summary ?? '',
      aliases: [],
      tags: [`type/${input.type}`],
      frontmatter: { type: input.type, slug },
      body: input.body,
      outlinks: input.links ?? [],
      relations: [],
    };
    upsertNote(db, model.root, note, model.manifest.retrieval?.chunk === 'by-heading');
  }

  return file;
}
