const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

const loadStateCode = `
  // Load app state
  useEffect(() => {
    const savedState = localStorage.getItem(APP_STATE_KEY);
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        if (parsed.people) setPeople(parsed.people);
        if (parsed.availability) setAvailability(parsed.availability);
        if (parsed.currentRota) setCurrentRota(parsed.currentRota);
        if (parsed.currentRotaId) setCurrentRotaId(parsed.currentRotaId);
        if (parsed.monthLabel) setMonthLabel(parsed.monthLabel);
        if (parsed.activeTab) setActiveTab(parsed.activeTab);
      } catch (e) {
        console.error('Failed to parse app state', e);
      }
    }
  }, []);

  // Save state manually
  const saveState = () => {
    localStorage.setItem(APP_STATE_KEY, JSON.stringify({
      people,
      availability,
      currentRota,
      currentRotaId,
      monthLabel,
      activeTab
    }));
    // Also show confetti to confirm save
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.8 }
    });
  };

  // Auto-save on specific changes
  useEffect(() => {
    localStorage.setItem(APP_STATE_KEY, JSON.stringify({
      people,
      availability,
      currentRota,
      currentRotaId,
      monthLabel,
      activeTab
    }));
  }, [people, availability, currentRota, currentRotaId, monthLabel, activeTab]);
`;

content = content.replace(
  /\/\/ Load history from localStorage/,
  loadStateCode + '\n  // Load history from localStorage'
);

// Add the Save button to the Header
const saveBtnRegex = /<Badge variant="outline" className="text-\[10px\] border-\[#27272a\] text-\[#a1a1aa\] px-2 py-0">v1\.2\.4<\/Badge>/;
const saveBtnReplacement = `<Button onClick={saveState} size="sm" variant="outline" className="bg-[#1a1a1a] border-[#27272a] text-white hover:bg-[#27272a] h-7 text-xs px-3 rounded-md">
                <Save className="w-3.5 h-3.5 mr-1.5" />
                Save Sync
              </Button>
              <Badge variant="outline" className="text-[10px] border-[#27272a] text-[#a1a1aa] px-2 py-0">v1.2.4</Badge>`;
content = content.replace(saveBtnRegex, saveBtnReplacement);

// Add Save icon import
const importRegex = /X\n} from 'lucide-react';/;
const importReplacement = `X,\n  Save\n} from 'lucide-react';`;
content = content.replace(importRegex, importReplacement);

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Done');
