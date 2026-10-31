const fs = require('fs');
const path = require('path');
const lines = fs.readFileSync(path.resolve(__dirname, '../lib/domain/models.ts'), 'utf8').split('\n');
console.log(lines.slice(225, 270).join('\n'));
