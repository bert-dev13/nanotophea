const fs = require('fs');
const txt = fs.readFileSync('c:/projects/nanotophea/lib/domain/models.ts', 'utf8');
const lines = txt.split('\n');
const start = lines.findIndex(l => l.includes('export const DockingRunSchema'));
console.log(lines.slice(start, start + 45).join('\n'));
