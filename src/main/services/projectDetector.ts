import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { ProjectInfo } from '@shared/types';

/**
 * Minimal project detection for this milestone: walks up from `cwd` looking
 * for the nearest `package.json` and uses its `name` field. Framework
 * detection (Next.js, Vite, etc.) and non-Node ecosystems (go.mod,
 * Cargo.toml, ...) are deferred to a later milestone.
 */
export async function detectProject(cwd: string | null): Promise<ProjectInfo | null> {
  if (!cwd) return null;

  let dir = cwd;
  for (let depth = 0; depth < 20; depth += 1) {
    const pkgPath = join(dir, 'package.json');
    try {
      const raw = await readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(raw) as { name?: unknown };
      if (typeof pkg.name === 'string' && pkg.name.length > 0) {
        return { name: pkg.name, root: dir, framework: null, kind: 'node' };
      }
      return null;
    } catch {
      const parent = dirname(dir);
      if (parent === dir) return null;
      dir = parent;
    }
  }
  return null;
}
