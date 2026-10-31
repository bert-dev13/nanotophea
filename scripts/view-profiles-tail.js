const fs = require('fs');
const path = require('path');
const lines = fs.readFileSync(path.resolve(__dirname, '../lib/docking/profiles.ts'), 'utf8').split(/\r?\n/);
console.log(lines.slice(-35).join('\n'));
