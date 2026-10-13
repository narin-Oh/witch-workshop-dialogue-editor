/**
 * Writes the .meta files for unity-package/. Usage: npm run unity:meta
 * (Run again after adding files to the package; existing .meta files with the right content are left alone.)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { listImportedEntries, metaContent } from './unityMeta';

const root = join(__dirname, '..', 'unity-package');
let written = 0;
for (const { rel, isDirectory } of listImportedEntries(root)) {
  const metaPath = join(root, `${rel}.meta`);
  const content = metaContent(rel, isDirectory);
  if (existsSync(metaPath) && readFileSync(metaPath, 'utf8') === content) continue;
  writeFileSync(metaPath, content);
  written++;
}
console.log(`unity-package: wrote ${written} .meta file(s)`);
