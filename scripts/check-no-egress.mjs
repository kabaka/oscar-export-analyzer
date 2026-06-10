#!/usr/bin/env node
/* eslint-env node */
/* global console */
/**
 * No-egress guard (ADR-0005 §5 — provable local-first).
 *
 * OSCAR Export Analyzer processes all data (OSCAR CSV + wearable exports) on-device.
 * With the former Fitbit OAuth/API integration removed, there are NO legitimate
 * external endpoints. This guard fails the build if a network-egress primitive or
 * the retired Fitbit API host reappears in shipped (non-test) source, keeping the
 * `connect-src 'self'` CSP guarantee enforceable rather than aspirational.
 *
 * Scope: `src/**` and `index.html`, excluding test files and this script.
 * Detected patterns: `fetch(`, `XMLHttpRequest`, `sendBeacon`, `new WebSocket`,
 * `new EventSource`, `api.fitbit.com`, and any non-self `connect-src` host.
 *
 * Exit 0 = clean; exit 1 = a forbidden pattern was found (prints offending lines).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

const SCAN_ROOTS = ['src', 'index.html'];
const SCAN_EXTS = new Set(['.js', '.jsx', '.ts', '.tsx', '.html', '.mjs']);

/** A file is excluded if it is a test, a story, or this guard itself. */
function isExcluded(rel) {
  return (
    /\.test\.[jt]sx?$/.test(rel) ||
    /\.stories\.[jt]sx?$/.test(rel) ||
    rel.endsWith('scripts/check-no-egress.mjs') ||
    rel.includes('__mocks__')
  );
}

const FORBIDDEN = [
  { re: /\bfetch\s*\(/, label: 'fetch(' },
  { re: /\bXMLHttpRequest\b/, label: 'XMLHttpRequest' },
  { re: /\bsendBeacon\s*\(/, label: 'sendBeacon(' },
  { re: /\bnew\s+WebSocket\b/, label: 'new WebSocket' },
  { re: /\bnew\s+EventSource\b/, label: 'new EventSource' },
  { re: /\bimportScripts\s*\(/, label: 'importScripts(' },
  { re: /api\.fitbit\.com/, label: 'api.fitbit.com (retired Fitbit API)' },
  // Any connect-src directive that lists a host other than 'self'.
  {
    re: /connect-src\s+(?:'self'\s+)?(?:https?:\/\/|\*|[a-z0-9.-]+\.[a-z])/i,
    label: 'connect-src with a non-self host',
  },
];

/** Recursively collect scannable files under a root. */
function collect(absRoot) {
  const out = [];
  const st = statSync(absRoot);
  if (st.isFile()) {
    out.push(absRoot);
    return out;
  }
  for (const entry of readdirSync(absRoot)) {
    const abs = path.join(absRoot, entry);
    const s = statSync(abs);
    if (s.isDirectory()) {
      if (entry === 'node_modules' || entry === '.git') continue;
      out.push(...collect(abs));
    } else if (SCAN_EXTS.has(path.extname(entry))) {
      out.push(abs);
    }
  }
  return out;
}

const violations = [];
for (const root of SCAN_ROOTS) {
  const abs = path.join(projectRoot, root);
  let files;
  try {
    files = collect(abs);
  } catch {
    continue; // root may not exist
  }
  for (const file of files) {
    const rel = path.relative(projectRoot, file).split(path.sep).join('/');
    if (isExcluded(rel)) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const { re, label } of FORBIDDEN) {
        if (re.test(line)) {
          violations.push({ rel, lineNo: i + 1, label, text: line.trim() });
        }
      }
    });
  }
}

if (violations.length > 0) {
  console.error(
    '✗ no-egress guard FAILED: forbidden network/egress pattern(s) found.\n' +
      '  OSCAR is local-first (ADR-0005 §5). Remove the egress, or if a genuine\n' +
      '  exception is required, update the CSP and this guard deliberately.\n',
  );
  for (const v of violations) {
    console.error(`  ${v.rel}:${v.lineNo}  [${v.label}]  ${v.text}`);
  }
  process.exit(1);
}

console.log(
  `✓ no-egress guard passed (connect-src 'self'; no fetch/XHR/WebSocket/Fitbit API in shipped source).`,
);
