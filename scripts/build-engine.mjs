import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const output = path.join(root, 'runtime', 'build');
mkdirSync(output, { recursive: true });
const image = 'emscripten/emsdk@sha256:0d9172d4b153a9a1067db4c753f8ec1bcb1542bfe1ca61a3c2d9115080b1963f';
const result = spawnSync('docker', [
  'run', '--rm',
  '--mount', 'type=bind,source=' + root + ',target=/src,readonly',
  '--mount', 'type=bind,source=' + output + ',target=/src/runtime/build',
  '--workdir', '/src', image, 'bash', 'runtime/build-engine.sh'
], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
