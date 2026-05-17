const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
const replacement = `<div className="space-y-2">
                                  <Label>Display Name (Optional)</Label>
                                  <Input 
                                    value={newPersonDisplayName} 
                                    onChange={e => setNewPersonDisplayName(e.target.value)} 
                                    className="bg-[#0a0a0a] border-[#27272a] text-white"
                                    placeholder="Enter display name"
                                  />
                                </div>`;

let linesToReplaceRegex = /<div className="space-y-2">\s*<Label>Available Dates<\/Label>[\s\S]*?<\/ScrollArea>\s*<\/div>/;

if (linesToReplaceRegex.test(content)) {
  content = content.replace(linesToReplaceRegex, replacement);
  fs.writeFileSync('src/App.tsx', content, 'utf8');
  console.log('Replaced');
} else {
  console.log('Not found');
}
