import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { VaultModel } from './types.js';

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

/**
 * Append a new manifest-conformant note to the vault (agent memory write-back).
 * Validation gates the write; the host repo's git history is the audit log.
 */
export async function writeNote(model: VaultModel, input: WriteNoteInput): Promise<string> {
  const errs = validateNote(model, input);
  if (errs.length) throw new Error('invalid note: ' + errs.join('; '));
  const folder = Object.entries(model.manifest.taxonomy.folders).find(
    ([, t]) => t === input.type,
  )![0];
  const slug = input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const file = `${folder}${input.title}.md`;
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
  await fs.writeFile(path.join(model.root, file), lines.join('\n') + '\n', 'utf8');
  return file;
}
