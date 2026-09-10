#!/usr/bin/env node
// バージョンを 1 か所の指示で全ファイルへ反映する。
//
//   node scripts/bump-version.mjs patch          # 0.1.0 -> 0.1.1
//   node scripts/bump-version.mjs minor          # 0.1.0 -> 0.2.0
//   node scripts/bump-version.mjs major          # 0.1.0 -> 1.0.0
//   node scripts/bump-version.mjs 1.2.3          # 直接指定
//   node scripts/bump-version.mjs patch --dry-run
//
// 対象: package.json / package-lock.json / src-tauri/tauri.conf.json /
//       src-tauri/Cargo.toml / src-tauri/Cargo.lock
// 全ファイルの現在バージョンが一致していなければ何も書かずに失敗する。

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const spec = args.find((a) => !a.startsWith('--'));

if (!spec) {
  console.error('usage: node scripts/bump-version.mjs <patch|minor|major|X.Y.Z> [--dry-run]');
  process.exit(1);
}

const read = (rel) => readFileSync(join(root, rel), 'utf8');

/** 各ファイルの「現在のバージョン行」の見つけ方と書き換え方 */
const targets = [
  {
    file: 'package.json',
    // 先頭側にある top-level の "version"
    pattern: /("version":\s*")(\d+\.\d+\.\d+)(")/,
  },
  {
    file: 'src-tauri/tauri.conf.json',
    pattern: /("version":\s*")(\d+\.\d+\.\d+)(")/,
  },
  {
    file: 'src-tauri/Cargo.toml',
    // [package] の version 行（依存の { version = "..." } は行頭ではないので当たらない）
    pattern: /^(version = ")(\d+\.\d+\.\d+)(")/m,
  },
  {
    file: 'src-tauri/Cargo.lock',
    // [[package]] name = "quiet-md" の直後の version
    pattern: /(name = "quiet-md"\nversion = ")(\d+\.\d+\.\d+)(")/,
  },
];

// package-lock.json は root と packages[""] の 2 か所を持つので JSON として扱う
const lockPath = 'package-lock.json';
const lockJson = JSON.parse(read(lockPath));

const found = targets.map((t) => {
  const text = read(t.file);
  const m = text.match(t.pattern);
  if (!m) {
    console.error(`error: ${t.file} にバージョン行が見つからない`);
    process.exit(1);
  }
  return { ...t, text, current: m[2] };
});

const versions = new Set([
  ...found.map((f) => f.current),
  lockJson.version,
  lockJson.packages?.['']?.version,
].filter(Boolean));

if (versions.size !== 1) {
  console.error(`error: バージョンが揃っていない: ${[...versions].join(', ')}`);
  console.error('       手で揃えてからやり直すこと。');
  process.exit(1);
}

const current = [...versions][0];
let next;
if (SEMVER.test(spec)) {
  next = spec;
} else {
  const [, ma, mi, pa] = current.match(SEMVER).map(Number);
  if (spec === 'major') next = `${ma + 1}.0.0`;
  else if (spec === 'minor') next = `${ma}.${mi + 1}.0`;
  else if (spec === 'patch') next = `${ma}.${mi}.${pa + 1}`;
  else {
    console.error(`error: 不明な指定: ${spec}`);
    process.exit(1);
  }
}

const cmp = (a, b) => {
  const x = a.match(SEMVER).slice(1).map(Number);
  const y = b.match(SEMVER).slice(1).map(Number);
  for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};

if (cmp(next, current) <= 0) {
  console.error(`error: ${current} -> ${next} はバージョンが上がっていない`);
  process.exit(1);
}

if (!dryRun) {
  for (const t of found) {
    writeFileSync(join(root, t.file), t.text.replace(t.pattern, `$1${next}$3`));
  }
  lockJson.version = next;
  if (lockJson.packages?.['']) lockJson.packages[''].version = next;
  writeFileSync(join(root, lockPath), `${JSON.stringify(lockJson, null, 2)}\n`);
}

console.log(`${current} -> ${next}${dryRun ? ' (dry-run)' : ''}`);

// GitHub Actions から使うとき用
if (process.env.GITHUB_OUTPUT) {
  writeFileSync(process.env.GITHUB_OUTPUT, `version=${next}\nprevious=${current}\n`, { flag: 'a' });
}
