const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
content = content.replace(/emerald-500/g, '[#af43db]');
content = content.replace(/emerald-600/g, '[#8c36af]');
content = content.replace(/emerald-400/g, '[#c46df0]');
fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Replaced all.');
