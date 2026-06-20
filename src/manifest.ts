import { promises as fs } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import type { Manifest } from './types.js';

/** Load and validate a vault's .brain/manifest.yaml. */
export async function loadManifest(vaultRoot: string): Promise<Manifest> {
  const p = path.join(vaultRoot, '.brain', 'manifest.yaml');
  let raw: string;
  try {
    raw = await fs.readFile(p, 'utf8');
  } catch {
    throw new Error(`No .brain/manifest.yaml found in ${vaultRoot}`);
  }
  const m = YAML.parse(raw) as Manifest;
  validateManifest(m);
  return m;
}

/** Throw if the manifest is missing required sections. */
export function validateManifest(m: Manifest): void {
  for (const k of ['vault', 'links', 'taxonomy', 'frontmatter'] as const) {
    if (!m || !m[k]) throw new Error(`manifest missing required section "${k}"`);
  }
  if (!m.links.id_field) throw new Error('manifest.links.id_field is required');
  if (!m.taxonomy.folders || Object.keys(m.taxonomy.folders).length === 0) {
    throw new Error('manifest.taxonomy.folders is required');
  }
}
