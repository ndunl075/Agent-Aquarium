import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Dependency-free distribution sanity check; not a substitute for clean-install QA.
const required = ['LICENSE','README.md','CONTRIBUTING.md','docs/privacy.md','docs/acceptance.md','pnpm-lock.yaml','apps/desktop/dist/main.cjs','apps/desktop/dist/preload.cjs','apps/desktop/dist/renderer/index.html'];
const missing=[];
required.push(`apps/desktop/dist/cli/${process.platform==='win32'?'node.exe':'node'}`,'apps/desktop/dist/cli/bin.cjs','apps/desktop/dist/cli/LICENSE.txt');
for (const file of required) {
  try { await access(resolve(file)); } catch { missing.push(file); }
}
try {
  const cli=JSON.parse(await readFile('packages/cli/package.json','utf8'));
  const bins=typeof cli.bin === 'string' ? [cli.bin]:Object.values(cli.bin ?? {});
  if (!bins.length) missing.push('companion CLI package bin declaration');
  for (const bin of bins) await access(resolve('packages/cli',bin));
} catch { missing.push('built companion CLI/package metadata'); }
if (missing.length) {
  console.error(`Release files missing; run pnpm build first:\n${missing.map(file=>`- ${file}`).join('\n')}`);
  process.exitCode=1;
} else console.log('Release source and compiled entrypoints present. Manual acceptance remains required.');
