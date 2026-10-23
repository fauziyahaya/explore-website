// Bundles the functions together with the shared @smartspend/core workspace
// package (which is not published to npm) into lib/index.js for deployment.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));
await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile: 'lib/index.js',
  sourcemap: true,
  // Runtime dependencies are installed by Cloud Functions from package.json.
  external: Object.keys(pkg.dependencies ?? {}),
});
console.log('Built lib/index.js');
