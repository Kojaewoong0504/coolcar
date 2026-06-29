export {};

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const required = [
  'public/icons/icon-192.png',
  'public/icons/icon-512.png',
  'public/icons/maskable-icon-192.png',
  'public/icons/maskable-icon-512.png',
  'public/apple-touch-icon.png',
  'src/app/manifest.ts',
];

function assertPng(path: string) {
  const buffer = readFileSync(path);
  const signature = buffer.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') throw new Error(`${path} is not a valid PNG`);
}

async function main() {
  for (const rel of required) {
    const abs = join(root, rel);
    if (!existsSync(abs)) throw new Error(`missing ${rel}`);
    if (rel.endsWith('.png')) assertPng(abs);
  }
  const manifestSource = readFileSync(join(root, 'src/app/manifest.ts'), 'utf8');
  for (const token of ['시원칸 CoolCar', 'standalone', '/icons/icon-192.png', '/icons/icon-512.png', 'maskable']) {
    if (!manifestSource.includes(token)) throw new Error(`manifest missing ${token}`);
  }
  console.log(JSON.stringify({ ok: true, checked: required.length, icons: required.filter((p) => p.endsWith('.png')).length }, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
