'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, '.ai', 'inbox', 'knw_20260829_ab01a1b2-shared-knowledge-rollout.md');
const jsonPath = path.join(root, 'ai-knowledge', 'phase3.json');
const htmlPath = path.join(root, 'ai-knowledge', 'index.html');

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function frontmatterField(source, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`^\\s*${escaped}:\\s*(.+?)\\s*$`, 'm'));
  if (!match) throw new Error(`Missing ${key} in ${path.relative(root, sourcePath)}`);
  return match[1].replace(/^['"]|['"]$/g, '');
}

const source = readText(sourcePath);
const mirror = JSON.parse(readText(jsonPath));
const html = readText(htmlPath);

const expected = {
  knowledge_id: frontmatterField(source, 'knowledge_id'),
  title: frontmatterField(source, 'title'),
  status: frontmatterField(source, 'status'),
  actor_id: frontmatterField(source, 'actor_id')
};

const actual = {
  knowledge_id: mirror.knowledge_id,
  title: mirror.title,
  status: mirror.status,
  actor_id: mirror.provenance?.actor_id
};

for (const [key, value] of Object.entries(expected)) {
  if (actual[key] !== value) {
    throw new Error(`ai-knowledge mirror mismatch for ${key}: expected ${value}, got ${actual[key]}`);
  }
  if (!html.includes(value)) {
    throw new Error(`ai-knowledge/index.html does not expose ${key}: ${value}`);
  }
}

if (mirror.canonical_source !== path.relative(root, sourcePath).replace(/\\/g, '/')) {
  throw new Error('phase3.json canonical_source does not point to the source knowledge file');
}

console.log('PASS: AI knowledge compatibility mirror matches canonical .ai source');
