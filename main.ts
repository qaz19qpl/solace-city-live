// Solace City — the handover program.
//
// The game itself is the static site in game/ (open game/index.html in a
// browser and play; there is no build step and nothing is fetched). This
// program is the courier: it carries game/ and screenshots/ into the
// output folder the grader points at, then asks the vendored make.fun
// library to summarise what it just delivered into dossier.json — the
// document the judge reads.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Without MAKEFUN_OUTPUT_DIR the destination defaults to /output, which
// is where the grader mounts its writable volume.

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own limits (the kit's gate), passed through so an
// over-limit entry fails here, in the open, instead of failing silently
// at the gate: dossier text capped at 160 KiB, screenshots at 4 files of
// 256 KiB, the game tree at 993 entries and 48 MiB with no path over
// 1,000 bytes.
const DOSSIER_LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

// Copy one folder of the entry into the output, creating the destination
// first so a bare output directory never trips the copy.
function shipFolder(name: string, required: boolean): void {
  const from = join(repoDir, name);
  const to = join(outDir, name);
  mkdirSync(to, { recursive: true });
  if (existsSync(from)) {
    cpSync(from, to, { recursive: true });
  } else if (required) {
    throw new Error(`entry is missing its ${name}/ folder`);
  }
}

function shipEntry(): void {
  mkdirSync(outDir, { recursive: true });
  shipFolder('game', true);
  shipFolder('screenshots', false);
}

function writeDossier(): void {
  const dossier = buildDossier(outDir, DOSSIER_LIMITS);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
}

// A one-line receipt for whoever ran the courier: what left the building.
function printReceipt(): void {
  const gameEntries = readdirSync(join(outDir, 'game'), { recursive: true }).length;
  const shotCount = readdirSync(join(outDir, 'screenshots')).length;
  console.log(`solace-city: shipped ${gameEntries} game files and ${shotCount} screenshots to ${outDir}`);
}

shipEntry();
writeDossier();
printReceipt();
