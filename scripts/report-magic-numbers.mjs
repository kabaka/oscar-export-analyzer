#!/usr/bin/env node
/* eslint-env node */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const execFileAsync = promisify(execFile);
const projectRoot = process.cwd();
const eslintRuleConfig =
  "no-magic-numbers: ['error', {ignoreArrayIndexes:true, ignoreDefaultValues:true, ignore:[-1,0,1], enforceConst:true}]";
const eslintArgs = [
  '--format',
  'json',
  '--rule',
  eslintRuleConfig,
  'src',
  'analysis.js',
];

const eslintExecutable = path.resolve(
  projectRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'eslint.cmd' : 'eslint',
);

async function run() {
  let stdout = '';
  try {
    const result = await execFileAsync(eslintExecutable, eslintArgs, {
      cwd: projectRoot,
      env: { ...process.env, FORCE_COLOR: '0' },
      maxBuffer: 1024 * 1024 * 10,
    });
    stdout = result.stdout;
  } catch (error) {
    if (error.stdout) {
      stdout = error.stdout;
    } else {
      throw error;
    }
  }

  const lintResults = JSON.parse(stdout);
  const summary = buildSummary(lintResults);
  const reportsDir = path.join(projectRoot, 'reports');
  await mkdir(reportsDir, { recursive: true });
  const outputPath = path.join(reportsDir, 'magic-numbers.json');
  await writeFile(outputPath, JSON.stringify(summary, null, 2) + '\n', 'utf8');
  process.stdout.write(
    `Magic number summary written to ${path.relative(projectRoot, outputPath)}\n`,
  );
}

function buildSummary(results) {
  let totalViolations = 0;

  const fileSummaries = results
    .map(({ filePath, messages }) => ({
      filePath,
      messages: messages.filter(
        (message) => message.ruleId === 'no-magic-numbers',
      ),
    }))
    .filter(({ messages }) => messages.length > 0)
    .map(({ filePath, messages }) => {
      const literalCounts = new Map();
      for (const message of messages) {
        totalViolations += 1;
        const literal = extractLiteral(message.message);
        literalCounts.set(literal, (literalCounts.get(literal) ?? 0) + 1);
      }

      const categories = Array.from(literalCounts.entries())
        .map(([literal, count]) => ({ literal, count }))
        .sort(
          (a, b) => b.count - a.count || a.literal.localeCompare(b.literal),
        );

      return {
        filePath: path.relative(projectRoot, filePath),
        total: messages.length,
        categories,
      };
    });

  fileSummaries.sort((a, b) => {
    if (b.total !== a.total) {
      return b.total - a.total;
    }
    return a.filePath.localeCompare(b.filePath);
  });

  return {
    generatedAt: new Date().toISOString(),
    rule: eslintRuleConfig,
    totals: {
      files: fileSummaries.length,
      violations: totalViolations,
    },
    files: fileSummaries,
  };
}

function extractLiteral(message) {
  const match = /No magic number: (.*)\./.exec(message ?? '');
  if (match) {
    return match[1];
  }
  return message ?? 'unknown';
}

run().catch((error) => {
  const message = error && error.stack ? `${error.stack}\n` : `${error}\n`;
  process.stderr.write(message);
  process.exitCode = 1;
});
