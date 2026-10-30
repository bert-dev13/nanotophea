const fs = require('fs');
const lines = fs.readFileSync('c:/projects/nanotophea/lib/docking/profiles.ts', 'utf8').split(/\r?\n/);
console.log('--- lines 370-445 ---');
console.log(lines.slice(370, 445).join('\n'));
