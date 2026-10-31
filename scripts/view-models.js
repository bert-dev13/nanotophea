const fs = require('fs');
const path = require('path');
const txt = fs.readFileSync(path.resolve(__dirname, '../lib/domain/models.ts'), 'utf8');
const lines = txt.split('\n');
const start = lines.findIndex(l => l.includes('export interface DockingResultPoint'));
console.log(lines.slice(start, start + 30).join('\n'));
