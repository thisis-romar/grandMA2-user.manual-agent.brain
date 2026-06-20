export interface Manifest {
  spec_version?: number;
  vault: { name: string; description?: string; source?: string };
  links: { style: string; resolution: string; id_field: string };
  taxonomy: { folders: Record<string, string>; moc_glob?: string };
  frontmatter: { all: string[]; by_type: Record<string, string[]> };
  relations?: Record<string, { from: string; to: string; kind: string }>;
  retrieval?: {
    chunk?: string;
    summary_field?: string;
    embed_text?: string[];
    exclude_types?: string[];
  };
}

export interface Note {
  id: string; // stable id (manifest.links.id_field, e.g. slug)
  path: string; // vault-relative path without .md
  file: string; // vault-relative path with .md
  type: string;
  title: string;
  summary: string;
  aliases: string[];
  tags: string[];
  frontmatter: Record<string, unknown>;
  body: string;
  outlinks: string[]; // resolved note paths
  relations: Array<{ kind: string; to: string }>;
}

export interface VaultModel {
  root: string;
  manifest: Manifest;
  notes: Note[];
  byId: Map<string, Note>;
  byPath: Map<string, Note>;
  backlinks: Map<string, string[]>;
}

export interface SearchHit {
  id: string;
  path: string;
  title: string;
  score: number;
  snippet: string;
  breadcrumb?: string[]; // ancestor section titles (root -> immediate parent)
}
