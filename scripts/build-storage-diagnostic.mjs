import {build} from 'esbuild';
await build({entryPoints:['scripts/check-lda-private-video-storage.mjs'],bundle:true,platform:'node',format:'esm',outfile:'.tmp/hazard-env-diagnostic/storage-diagnostic.mjs',banner:{js:"import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);"}});
