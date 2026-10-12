import { ensureElectronNative,run } from './native.mjs';
import electronPath from 'electron';
await ensureElectronNative();
process.exitCode=await run(electronPath,['apps/desktop/dist/main.cjs']);
