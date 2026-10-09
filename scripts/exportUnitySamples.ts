/**
 * Writes the Unity package's sample dialogues and golden test data.
 * Usage: npm run export:unity-samples
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { buildUnitySampleFiles } from '../src/samples/unityExport';

const root = join(__dirname, '..', 'unity-package');
for (const [rel, content] of Object.entries(buildUnitySampleFiles())) {
  const target = join(root, rel);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
  console.log(`wrote unity-package/${rel}`);
}
