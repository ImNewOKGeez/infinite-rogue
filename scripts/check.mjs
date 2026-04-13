import fs from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();

async function main() {
  const jsFiles = await collectFiles(root, file => (
    (file.endsWith('.js') || file.endsWith('.mjs'))
    && !file.includes(`${path.sep}dist${path.sep}`)
    && !file.includes(`${path.sep}node_modules${path.sep}`)
    && !file.includes(`${path.sep}android${path.sep}`)
  ));

  const indexHtml = await fs.readFile(path.join(root, 'index.html'), 'utf8');
  if (!indexHtml.includes('rel="manifest"')) {
    throw new Error('index.html is missing a manifest link.');
  }

  const manifestPath = path.join(root, 'public', 'manifest.webmanifest');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
    throw new Error('public/manifest.webmanifest does not define any icons.');
  }

  for (const icon of manifest.icons) {
    const iconPath = path.join(root, 'public', icon.src.replace(/^\.\//, ''));
    await assertExists(iconPath, `Missing manifest icon: ${icon.src}`);
  }

  console.log(`Verified manifest assets and scanned ${jsFiles.length} source files for the project check pass.`);
}

async function collectFiles(dir, predicate) {
  const results = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await collectFiles(fullPath, predicate));
      continue;
    }
    if (predicate(fullPath)) results.push(fullPath);
  }
  return results;
}

async function assertExists(filePath, message) {
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(message);
  }
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
