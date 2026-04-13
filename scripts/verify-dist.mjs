import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

async function main() {
  const distDir = path.join(root, 'dist');
  const distIndexPath = path.join(distDir, 'index.html');
  const distManifestPath = path.join(distDir, 'manifest.webmanifest');

  const distIndex = await fs.readFile(distIndexPath, 'utf8');
  if (!distIndex.includes('href="./manifest.webmanifest"')) {
    throw new Error('dist/index.html is missing the relative manifest link.');
  }
  if (!distIndex.includes('src="./assets/')) {
    throw new Error('dist/index.html is not using relative built asset paths.');
  }
  if (!distIndex.includes('href="./assets/')) {
    throw new Error('dist/index.html stylesheet path is not relative.');
  }

  const manifest = JSON.parse(await fs.readFile(distManifestPath, 'utf8'));
  for (const icon of manifest.icons || []) {
    const iconPath = path.join(distDir, icon.src.replace(/^\.\//, ''));
    await fs.access(iconPath);
  }

  console.log('Verified dist HTML and manifest asset links.');
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
