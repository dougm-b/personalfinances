#!/usr/bin/env node
// Monta src/shell.html + fragmentos src/** num único index.html.
// Corre depois de editar qualquer coisa em src/: `node build.js`
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');

const TARGETS = [
  { shell: 'shell.html', out: 'index.html' },
];

const INCLUDE_RE = /<!--INCLUDE:([^\s]+?)-->/g;

function resolveIncludes(text, seen) {
  return text.replace(INCLUDE_RE, (match, relPath) => {
    const filePath = path.join(SRC, relPath);
    if (!fs.existsSync(filePath)) {
      throw new Error(`build.js: ficheiro incluído não encontrado: src/${relPath} (referenciado como ${match})`);
    }
    if (seen.has(filePath)) {
      throw new Error(`build.js: include circular detetado em src/${relPath}`);
    }
    const content = fs.readFileSync(filePath, 'utf8').replace(/\n$/, '');
    return resolveIncludes(content, new Set(seen).add(filePath));
  });
}

TARGETS.forEach(({ shell, out }) => {
  const shellText = fs.readFileSync(path.join(SRC, shell), 'utf8');
  const html = resolveIncludes(shellText, new Set([path.join(SRC, shell)]));
  fs.writeFileSync(path.join(ROOT, out), html, 'utf8');
  console.log(`Built ${out} (${html.length} bytes) from src/${shell}`);
});
