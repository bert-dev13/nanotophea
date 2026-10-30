const fs = require('fs');
const lines = fs.readFileSync('c:/projects/nanotophea/lib/docking/profiles.ts', 'utf8').split(/\r?\n/);
console.log('--- lines 1-60 ---');
console.log(lines.slice(0, 60).join('\n'));
console.log('--- lines 90-135 ---');
console.log(lines.slice(90, 135).join('\n'));
