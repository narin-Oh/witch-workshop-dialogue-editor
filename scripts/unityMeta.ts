/**
 * Unity requires a .meta file (with a stable GUID) for every file and folder in a package that is installed from Git
 * (such packages are read-only, and assets without a .meta are ignored). This module computes them deterministically.
 * Folders whose name ends with "~" (Samples~, Documentation~, Tests~) are ignored by Unity and need none.
 */
import { createHash } from 'node:crypto';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const PACKAGE = 'com.witchworkshop.dialogue';
const IGNORED_DIRS = new Set(['bin', 'obj', 'node_modules']);

export function guidFor(relPath: string): string {
  return createHash('md5').update(`${PACKAGE}:${relPath}`).digest('hex');
}

const importerBody = (name: string): string =>
  `${name}:\n  externalObjects: {}\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n`;

export function metaContent(relPath: string, isDirectory: boolean): string {
  const head = `fileFormatVersion: 2\nguid: ${guidFor(relPath)}\n`;
  if (isDirectory) return `${head}folderAsset: yes\n${importerBody('DefaultImporter')}`;
  if (relPath.endsWith('.cs'))
    return `${head}MonoImporter:\n  externalObjects: {}\n  serializedVersion: 2\n  defaultReferences: []\n  executionOrder: 0\n  icon: {instanceID: 0}\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n`;
  if (relPath.endsWith('.asmdef')) return `${head}${importerBody('AssemblyDefinitionImporter')}`;
  if (relPath === 'package.json') return `${head}${importerBody('PackageManifestImporter')}`;
  return `${head}${importerBody('TextScriptImporter')}`; // .json, .md, other text
}

export interface PackageEntry {
  rel: string;
  isDirectory: boolean;
}

/** Every file/folder Unity will import (those needing a .meta), relative to the package root with "/" separators. */
export function listImportedEntries(root: string): PackageEntry[] {
  const out: PackageEntry[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      if (name.endsWith('~') || name.endsWith('.meta') || name.startsWith('.') || IGNORED_DIRS.has(name)) continue;
      const full = join(dir, name);
      const rel = relative(root, full).split(sep).join('/');
      const isDirectory = statSync(full).isDirectory();
      out.push({ rel, isDirectory });
      if (isDirectory) walk(full);
    }
  };
  walk(root);
  return out;
}
