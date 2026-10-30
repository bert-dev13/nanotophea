const fs = require('fs');
const lines = fs.readFileSync('c:/projects/nanotophea/lib/domain/models.ts', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes('dockingProfileVersion'));
console.log(lines.slice(idx - 2, idx + 6).join('\n'));
