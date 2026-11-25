// Satay Smoke — entry program (Node 22, standard library only).
//
// The grader runs `node /bot/main.ts` twice, with no network, and the two runs
// must write the same bytes. So this program does nothing but copy files and
// write a dossier: game/ and screenshots/ go from beside this file to the
// output directory, and dossier.json is built from them with the vendored
// make.fun library (vendor/makefun-game.ts, the kit's copy, unchanged).
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The caps are the competition gate's own (3-4 screenshots at most 256 KiB,
// game/ at most 993 entries and 48 MiB, paths at most 1000 bytes). Only
// text_max_bytes shapes the dossier's bytes; the rest make this program fail
// exactly where the scorer would refuse the entry.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
