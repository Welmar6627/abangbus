import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const outputDirectory = join(process.cwd(), 'dist-check');
const emptyTitle = '<title data-rh="true"></title>';
const productionTitle = '<title data-rh="true">AbangBus — Live Provincial Transit</title>';

async function finalize(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return finalize(path);
    if (!entry.isFile() || !entry.name.endsWith('.html')) return;

    const html = await readFile(path, 'utf8');
    if (!html.includes(emptyTitle)) {
      throw new Error(`Expected Expo document title placeholder in ${path}`);
    }
    await writeFile(path, html.replace(emptyTitle, productionTitle), 'utf8');
  }));
}

await finalize(outputDirectory);
