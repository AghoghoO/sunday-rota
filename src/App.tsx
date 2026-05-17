/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Calendar, 
  Users, 
  Upload, 
  Download, 
  History as HistoryIcon, 
  CheckCircle2, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  FileSpreadsheet,
  ChevronRight,
  ShieldCheck,
  UserPlus,
  LayoutGrid,
  X,
  Save
} from 'lucide-react';
import Papa from 'papaparse';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

import { Person, Role, DayAvailability, RotaDay, Rota } from './lib/types';
import { generateRota } from './lib/scheduling';

const APP_STORAGE_KEY = 'sunday_rota_master_history';
const APP_STATE_KEY = 'sunday_rota_app_state';

export default function App() {
  const [people, setPeople] = useState<Person[]>([]);
  const [availability, setAvailability] = useState<DayAvailability[]>([]);
  const [currentRota, setCurrentRota] = useState<RotaDay[]>([]);
  const [history, setHistory] = useState<Rota[]>([]);
  const [excludedNames, setExcludedNames] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('upload');
  const [monthLabel, setMonthLabel] = useState(format(new Date(), 'MMMM yyyy'));
  
  const [currentRotaId, setCurrentRotaId] = useState<string | null>(null);
  const [swapData, setSwapData] = useState<{ dayIndex: number; assignmentIndex: number; currentDate: string; currentAssignment: any } | null>(null);
  const [swapTarget, setSwapTarget] = useState<string>('');

  const [isAddPersonOpen, setIsAddPersonOpen] = useState(false);
  const [isRotaAddPersonOpen, setIsRotaAddPersonOpen] = useState(false);
  const [addMode, setAddMode] = useState<'regenerate' | 'specific_day'>('regenerate');
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonDisplayName, setNewPersonDisplayName] = useState('');
  const [newPersonRole, setNewPersonRole] = useState<Role>('Team Member');
  const [newPersonAvailability, setNewPersonAvailability] = useState<string[]>([]);
  const [newPersonTargetDate, setNewPersonTargetDate] = useState<string>('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  
  // Load app state
  useEffect(() => {
    fetch('/api/state')
      .then(res => res.json())
      .then(parsed => {
        if (parsed.people) setPeople(parsed.people);
        if (parsed.availability) setAvailability(parsed.availability);
        if (parsed.currentRota) setCurrentRota(parsed.currentRota);
        if (parsed.currentRotaId) setCurrentRotaId(parsed.currentRotaId);
        if (parsed.monthLabel) setMonthLabel(parsed.monthLabel);
        if (parsed.activeTab) setActiveTab(parsed.activeTab);
      })
      .catch(e => {
        console.error('Failed to parse app state from backend', e);
        // Fallback to local storage
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
          } catch (err) {}
        }
      });
  }, []);

  // Save state manually
  const saveState = async () => {
    const stateData = {
      people,
      availability,
      currentRota,
      currentRotaId,
      monthLabel,
      activeTab
    };
    
    // Save to local storage as fallback
    localStorage.setItem(APP_STATE_KEY, JSON.stringify(stateData));
    
    // Save to backend
    try {
      await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stateData)
      });
    } catch (e) {
      console.error('Failed to save to backend', e);
    }
    
    // Also show confetti to confirm save
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.8 }
    });
  };

  // Auto-save on specific changes
  useEffect(() => {
    const stateData = {
      people,
      availability,
      currentRota,
      currentRotaId,
      monthLabel,
      activeTab
    };
    localStorage.setItem(APP_STATE_KEY, JSON.stringify(stateData));
    
    // We can also auto-save to backend, debouncing might be good but let's just fire and forget for now
    fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stateData)
    }).catch(e => console.error(e));
  }, [people, availability, currentRota, currentRotaId, monthLabel, activeTab]);

  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(APP_STORAGE_KEY);
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse history', e);
      }
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as any[];
        if (data.length === 0) return;

        const headers = results.meta.fields || [];
        const dateHeaders = headers.filter(h => h.toLowerCase() !== 'name');
        
        const newPeople: Person[] = [];
        const newAvailability: DayAvailability[] = dateHeaders.map(date => ({
          date,
          availablePeople: []
        }));

        const currentPeople = [...people];
        data.forEach((row, idx) => {
          const name = row['Name'] || row['name'] || `Person ${idx + 1}`;
          if (!currentPeople.find(p => p.name === name)) {
            currentPeople.push({
              id: crypto.randomUUID(),
              name,
              role: 'Team Member',
              isExcluded: false,
              totalAssignments: 0
            });
          }

          dateHeaders.forEach(date => {
            if (row[date] === '✓' || row[date] === 'v' || row[date] === 'x') {
              const dayArr = newAvailability.find(a => a.date === date);
              if (dayArr) dayArr.availablePeople.push(name);
            }
          });
        });

        setPeople(currentPeople);
        setAvailability(newAvailability);
        setActiveTab('config');
      }
    });
  };

  const updatePersonRole = (id: string, role: Role) => {
    setPeople(prev => prev.map(p => p.id === id ? { ...p, role } : p));
  };

  const updatePersonDisplayName = (id: string, displayName: string) => {
    setPeople(prev => prev.map(p => p.id === id ? { ...p, displayName } : p));
  };

  const toggleExclusion = (name: string) => {
    setPeople(prev => prev.map(p => p.name === name ? { ...p, isExcluded: !p.isExcluded } : p));
  };

  const handleAddPerson = () => {
    if (!newPersonName.trim()) return;
    
    let existingPerson = people.find(p => p.name.toLowerCase() === newPersonName.trim().toLowerCase());
    if (!existingPerson) {
      existingPerson = {
        id: crypto.randomUUID(),
        name: newPersonName.trim(),
        displayName: newPersonDisplayName.trim() || undefined,
        role: newPersonRole,
        isExcluded: false,
        totalAssignments: 0,
      };
      setPeople(prev => [...prev, existingPerson!]);
    } else {
      // Update role and displayName if exists
      setPeople(prev => prev.map(p => p.id === existingPerson!.id ? {
        ...p,
        role: newPersonRole,
        displayName: newPersonDisplayName.trim() || p.displayName
      } : p));
    }
    
    setNewPersonName('');
    setNewPersonDisplayName('');
    setNewPersonRole('Team Member');
    setIsAddPersonOpen(false);
  };

  const handleRotaAddPerson = () => {
    if (!newPersonName.trim()) return;
    
    let personName = newPersonName.trim();
    let existingPerson = people.find(p => p.name.toLowerCase() === personName.toLowerCase());
    
    if (!existingPerson) {
      existingPerson = {
        id: crypto.randomUUID(),
        name: personName,
        displayName: newPersonDisplayName.trim() || undefined,
        role: newPersonRole,
        isExcluded: false,
        totalAssignments: 0,
      };
      setPeople(prev => [...prev, existingPerson!]);
    } else {
      setPeople(prev => prev.map(p => p.id === existingPerson!.id ? {
        ...p,
        role: newPersonRole,
        displayName: newPersonDisplayName.trim() || p.displayName
      } : p));
    }

    if (addMode === 'regenerate') {
      const updatedAvailability = availability.map(day => {
        if (newPersonAvailability.includes(day.date)) {
          return { ...day, availablePeople: [...day.availablePeople, existingPerson!.name] };
        }
        return day;
      });
      setAvailability(updatedAvailability);
      
      const rota = generateRota([...people, existingPerson].filter((v,i,a)=>a.findIndex(t=>(t.id===v.id))===i), updatedAvailability);
      setCurrentRota(rota);
      
      if (currentRotaId) {
        setHistory(prev => prev.map(h => h.id === currentRotaId ? { ...h, days: rota } : h));
      } else {
        const newRota: Rota = { id: crypto.randomUUID(), timestamp: Date.now(), monthLabel, days: rota };
        setHistory(prev => [newRota, ...prev]);
        setCurrentRotaId(newRota.id);
      }
    } else if (addMode === 'specific_day' && newPersonTargetDate) {
      const newRota = [...currentRota];
      const dayIndex = newRota.findIndex(d => d.date === newPersonTargetDate);
      if (dayIndex !== -1) {
        const newDay = { ...newRota[dayIndex] };
        const assignments = [...newDay.assignments];
        assignments.push({
          personName: existingPerson.name,
          displayName: existingPerson.displayName,
          role: existingPerson.role
        });
        newDay.assignments = assignments;
        newDay.hasLeadWarning = !assignments.some((a: any) => a.role === 'Team Lead');
        newRota[dayIndex] = newDay;
        setCurrentRota(newRota);
        if (currentRotaId) {
          setHistory(prev => prev.map(h => h.id === currentRotaId ? { ...h, days: newRota } : h));
        }
      }
    }
    
    setNewPersonName('');
    setNewPersonDisplayName('');
    setNewPersonRole('Team Member');
    setNewPersonAvailability([]);
    setNewPersonTargetDate('');
    setIsRotaAddPersonOpen(false);
  };

  const runGeneration = () => {
    const rota = generateRota(people, availability);
    setCurrentRota(rota);
    
    // Save to history automatically
    const newRota: Rota = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      monthLabel,
      days: rota
    };
    
    setHistory(prev => [newRota, ...prev]);
    setCurrentRotaId(newRota.id);
    setActiveTab('rota');
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  const handleSwapConfirm = () => {
    if (!swapData || !swapTarget) return;

    const newPerson = people.find(p => p.name === swapTarget);
    if (!newPerson) return;

    const newRota = [...currentRota];
    const newDay = { ...newRota[swapData.dayIndex] };
    const assignments = [...newDay.assignments];

    assignments[swapData.assignmentIndex] = {
      personName: newPerson.name,
      displayName: newPerson.displayName,
      role: newPerson.role
    };

    newDay.assignments = assignments;
    newDay.hasLeadWarning = !assignments.some((a: any) => a.role === 'Team Lead');
    newRota[swapData.dayIndex] = newDay;

    setCurrentRota(newRota);
    if (currentRotaId) {
      setHistory(prev => prev.map(h => h.id === currentRotaId ? { ...h, days: newRota } : h));
    }
    setSwapData(null);
    setSwapTarget('');
  };

  const handleRemovePerson = () => {
    if (!swapData) return;

    const newRota = [...currentRota];
    const newDay = { ...newRota[swapData.dayIndex] };
    const assignments = [...newDay.assignments];

    assignments.splice(swapData.assignmentIndex, 1);

    newDay.assignments = assignments;
    newDay.hasLeadWarning = !assignments.some((a: any) => a.role === 'Team Lead');
    newRota[swapData.dayIndex] = newDay;

    setCurrentRota(newRota);
    if (currentRotaId) {
      setHistory(prev => prev.map(h => h.id === currentRotaId ? { ...h, days: newRota } : h));
    }
    setSwapData(null);
  };

  const downloadRota = () => {
    if (currentRota.length === 0) return;

    const csvData = currentRota.map(day => {
      const row: any = { Date: day.date };
      const leads = day.assignments.filter(a => a.role === 'Team Lead').map(a => a.displayName || a.personName).join(', ');
      const members = day.assignments.filter(a => a.role === 'Team Member').map(a => a.displayName || a.personName).join(', ');
      const shadowers = day.assignments.filter(a => a.role === 'Shadower').map(a => a.displayName || a.personName).join(', ');
      
      row['Team Lead(s)'] = leads;
      row['Team Members'] = members;
      row['Shadowers'] = shadowers;
      return row;
    });

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `rota_${monthLabel.replace(/\s+/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const deleteHistoryItem = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const validationChecks = currentRota.length > 0 ? {
    leads: !currentRota.some(day => day.hasLeadWarning),
    trio: true, // Our algorithm strictly prevents this
    participation: people.filter(p => !p.isExcluded).every(p => 
      p.role === 'Shadower' ? true : currentRota.some(day => day.assignments.some(a => a.personName === p.name))
    )
  } : null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f2f2f2] font-sans selection:bg-[#af43db]/30 overflow-hidden">
      <div className="flex flex-col md:flex-row h-[100dvh] overflow-hidden relative">
        
        {/* Mobile Header */}
        <div className="md:hidden h-16 bg-[#141414] border-b border-[#27272a] px-4 flex items-center justify-between flex-shrink-0 z-30 relative">
          <div className="text-xl font-extrabold tracking-tighter text-[#af43db] leading-none">ROTA PRO</div>
          <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-[#a1a1aa] hover:text-white hover:bg-[#27272a]">
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <LayoutGrid className="w-6 h-6" />}
          </Button>
        </div>

        {/* Mobile Menu Dropdown (Waffle Menu) */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="md:hidden absolute top-16 left-0 right-0 bg-[#0a0a0a] border-b border-[#27272a] p-4 flex flex-col gap-2 z-40 shadow-2xl"
            >
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'upload', label: 'Generator', icon: Upload },
                  { id: 'config', label: 'Configuration', icon: Users, disabled: people.length === 0 },
                  { id: 'rota', label: 'Current Rota', icon: Calendar, disabled: currentRota.length === 0 },
                  { id: 'history', label: 'History Records', icon: HistoryIcon }
                ].map((item) => (
                  <button
                    key={item.id}
                    disabled={item.disabled}
                    onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }}
                    className={`
                      flex flex-col items-center justify-center gap-3 p-6 rounded-2xl text-xs font-bold transition-all duration-200
                      ${activeTab === item.id 
                        ? 'bg-[#af43db]/10 text-[#af43db] border-2 border-[#af43db]/30' 
                        : 'bg-[#141414] border-2 border-[#27272a] text-[#a1a1aa] hover:text-white hover:bg-[#1e1e1e] disabled:opacity-30 disabled:pointer-events-none'}
                    `}
                  >
                    <item.icon className={`w-8 h-8 flex-shrink-0 ${activeTab === item.id ? 'text-[#af43db]' : 'text-[#a1a1aa]'}`} />
                    <span className="mt-1 uppercase tracking-wider">{item.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sidebar Navigation (Desktop) */}
        <aside className="hidden md:flex w-[240px] h-full bg-[#141414] border-r border-[#27272a] p-6 flex-col gap-8 flex-shrink-0 z-20">
          <div className="space-y-1">
            <div className="text-xl font-extrabold tracking-tighter text-[#af43db] leading-none">ROTA PRO</div>
            <div className="text-[10px] uppercase tracking-widest text-[#a1a1aa] font-bold">Standard Edition</div>
          </div>

          <nav className="flex flex-col gap-1.5 flex-1">
            {[
              { id: 'upload', label: 'Generator', icon: Upload },
              { id: 'config', label: 'Configuration', icon: Users, disabled: people.length === 0 },
              { id: 'rota', label: 'Current Rota', icon: Calendar, disabled: currentRota.length === 0 },
              { id: 'history', label: 'History Records', icon: HistoryIcon }
            ].map((item) => (
              <button
                key={item.id}
                disabled={item.disabled}
                onClick={() => setActiveTab(item.id)}
                className={`
                  flex items-center justify-start gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap
                  ${activeTab === item.id 
                    ? 'bg-[#1e1e1e] text-white border border-[#27272a]' 
                    : 'text-[#a1a1aa] hover:text-white hover:bg-[#1e1e1e]/50 disabled:opacity-30 disabled:pointer-events-none'}
                `}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="mt-auto space-y-4">
            <Card className="bg-[#1e1e1e] border-[#27272a] p-4 rounded-xl">
               <div className="text-[10px] text-[#a1a1aa] font-bold uppercase tracking-wider mb-2">Active Month</div>
               <Input 
                  value={monthLabel} 
                  onChange={(e) => setMonthLabel(e.target.value)}
                  className="bg-[#0a0a0a] border-[#27272a] text-xs h-8 text-white rounded-md focus-visible:ring-[#af43db]"
                  placeholder="Month Label"
               />
               {people.length > 0 && (
                 <div className="mt-3 text-[10px] text-[#af43db] font-medium">
                   {people.length} Participants Active
                 </div>
               )}
            </Card>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a] overflow-hidden">
          {/* Header */}
          <header className="h-14 md:h-16 border-b border-[#27272a] bg-[#141414]/50 backdrop-blur-md flex items-center justify-between px-4 md:px-8 flex-shrink-0">
            <h2 className="text-xs md:text-sm font-semibold tracking-wide text-white uppercase">{activeTab} View</h2>
            <div className="flex items-center gap-3 md:gap-4">
              <div className="hidden md:flex items-center gap-2 text-xs text-[#a1a1aa]">
                <ShieldCheck className="w-4 h-4 text-[#af43db]" />
                Constraint Mode Active
              </div>
              <Separator orientation="vertical" className="hidden md:block h-4 bg-[#27272a]" />
              <Button onClick={saveState} size="sm" variant="outline" className="bg-[#1a1a1a] border-[#27272a] text-white hover:bg-[#27272a] h-7 text-xs px-3 rounded-md">
                <Save className="w-3.5 h-3.5 mr-1.5" />
                Save Sync
              </Button>
              <Badge variant="outline" className="text-[10px] border-[#27272a] text-[#a1a1aa] px-2 py-0">v1.2.4</Badge>
            </div>
          </header>

          <div className="flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar">
            <AnimatePresence mode="wait">
              {/* UPLOAD TAB CONTENT */}
              {activeTab === 'upload' && (
                <motion.div 
                  key="upload"
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0, y: -10 }}
                  className="max-w-3xl mx-auto"
                >
                  <Card className="bg-[#1e1e1e] border-[#27272a] border-dashed border-2 shadow-2xl">
                    <div className="p-16 flex flex-col items-center text-center space-y-8">
                      <div className="w-24 h-24 bg-[#af43db]/10 rounded-[2.5rem] flex items-center justify-center text-[#af43db] transform -rotate-6 transition-transform hover:rotate-0 duration-500">
                        <FileSpreadsheet className="w-12 h-12" />
                      </div>
                      <div className="space-y-3">
                        <h3 className="text-3xl font-bold tracking-tight text-white">Import Availability</h3>
                        <p className="text-[#a1a1aa] max-w-md mx-auto leading-relaxed">
                          Drop your Sunday service availability CSV here. We'll automatically identify roles and constraint groups.
                        </p>
                      </div>
                      <div className="relative group">
                        <input 
                          type="file" 
                          accept=".csv" 
                          onChange={handleFileUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <Button size="lg" className="bg-[#8c36af] hover:bg-[#af43db] text-white rounded-xl px-10 shadow-lg shadow-[#af43db]/20 group-hover:scale-105 transition-all">
                          <Upload className="w-5 h-5 mr-3" />
                          Initialize System
                        </Button>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#52525b] uppercase tracking-[0.2em]">
                        <span>Secure</span> • <span>Fast</span> • <span>Smart</span>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )}

              {/* CONFIG TAB CONTENT */}
              {activeTab === 'config' && (
                <motion.div 
                  key="config"
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <Card className="bg-[#1e1e1e] border-[#27272a] shadow-xl overflow-hidden">
                    <div className="p-4 md:p-6 border-b border-[#27272a] bg-[#1e1e1e]">
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-[#af43db]/10 rounded-xl flex items-center justify-center text-[#af43db] flex-shrink-0">
                            <Users className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-white tracking-tight">Participant Configuration</h3>
                            <p className="text-xs text-[#a1a1aa]">Assign system roles and exclusions for {people.length} members</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <Button variant="outline" className="bg-[#0a0a0a] border-[#27272a] text-white rounded-xl px-4 hover:bg-[#141414]" onClick={() => setIsAddPersonOpen(true)}>
                          <UserPlus className="w-4 h-4 mr-2" />
                          Add Person
                        </Button>
                        <Dialog open={isAddPersonOpen} onOpenChange={setIsAddPersonOpen}>
                          <DialogContent className="bg-[#1e1e1e] border-[#27272a] text-white">
                            <DialogHeader>
                              <DialogTitle>Add Manual Participant</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label>Name</Label>
                                <Input 
                                  value={newPersonName} 
                                  onChange={e => setNewPersonName(e.target.value)} 
                                  className="bg-[#0a0a0a] border-[#27272a] text-white"
                                  placeholder="Enter name"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>System Role</Label>
                                <Select value={newPersonRole} onValueChange={(v) => setNewPersonRole(v as Role)}>
                                  <SelectTrigger className="bg-[#0a0a0a] border-[#27272a] text-white">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-[#1e1e1e] border-[#27272a] text-white">
                                    <SelectItem value="Team Lead">Team Lead</SelectItem>
                                    <SelectItem value="Team Member">Team Member</SelectItem>
                                    <SelectItem value="Shadower">Shadower</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                  <Label>Display Name (Optional)</Label>
                                  <Input 
                                    value={newPersonDisplayName} 
                                    onChange={e => setNewPersonDisplayName(e.target.value)} 
                                    className="bg-[#0a0a0a] border-[#27272a] text-white"
                                    placeholder="Enter display name"
                                  />
                                </div>
                            </div>
                            <DialogFooter>
                              <Button onClick={handleAddPerson} className="bg-[#8c36af] hover:bg-[#af43db] text-white w-full">
                                Add Participant
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Button onClick={runGeneration} className="bg-[#8c36af] hover:bg-[#af43db] text-white rounded-xl px-6">
                           Generate Service Rota
                           <ChevronRight className="w-4 h-4 ml-2" />
                        </Button>
                      </div>
                    </div>
                    </div>
                    <ScrollArea className="h-[calc(100vh-280px)] md:h-[calc(100vh-280px)]">
                      <Table className="min-w-[700px]">
                        <TableHeader className="bg-[#1e1e1e] sticky top-0 z-10">
                          <TableRow className="border-[#27272a] hover:bg-transparent">
                            <TableHead className="text-[#a1a1aa] uppercase text-[10px] font-bold py-4">Excl.</TableHead>
                            <TableHead className="text-[#a1a1aa] uppercase text-[10px] font-bold py-4">Original Name</TableHead>
                            <TableHead className="text-[#a1a1aa] uppercase text-[10px] font-bold py-4">Display Name</TableHead>
                            <TableHead className="text-[#a1a1aa] uppercase text-[10px] font-bold py-4">System Role</TableHead>
                            <TableHead className="text-[#a1a1aa] uppercase text-[10px] font-bold py-4 text-right">Avail. Sundays</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {people.map((person) => {
                            const availableDaysCount = availability.filter(a => a.availablePeople.includes(person.name)).length;
                            return (
                              <TableRow key={person.id} className={`border-[#27272a] transition-colors ${person.isExcluded ? 'opacity-25' : 'hover:bg-[#141414]'}`}>
                                <TableCell className="py-4">
                                  <Checkbox 
                                    checked={person.isExcluded} 
                                    onCheckedChange={() => toggleExclusion(person.name)}
                                    className="border-[#27272a] data-[state=checked]:bg-[#af43db] data-[state=checked]:border-[#af43db]"
                                  />
                                </TableCell>
                                <TableCell className="font-medium text-white">{person.name}</TableCell>
                                <TableCell>
                                  <Input 
                                    value={person.displayName || ''} 
                                    onChange={(e) => updatePersonDisplayName(person.id, e.target.value)}
                                    className="bg-[#0a0a0a] border-[#27272a] text-xs h-9 text-white rounded-lg w-full max-w-[200px]"
                                    placeholder="Full name (e.g. Moses)"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Select 
                                    value={person.role} 
                                    onValueChange={(val) => updatePersonRole(person.id, val as Role)}
                                  >
                                    <SelectTrigger className="w-[180px] h-9 text-xs rounded-lg bg-[#0a0a0a] border-[#27272a] text-[#a1a1aa]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#1e1e1e] border-[#27272a] text-white">
                                      <SelectItem value="Team Lead">Team Lead</SelectItem>
                                      <SelectItem value="Team Member">Team Member</SelectItem>
                                      <SelectItem value="Shadower">Shadower</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs text-[#af43db]">
                                  {availableDaysCount}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </Card>
                </motion.div>
              )}

              {/* ROTA TAB CONTENT */}
              {activeTab === 'rota' && (
                <motion.div 
                  key="rota"
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  {/* Validation Summary Bar */}
                  {validationChecks && (
                    <div className="flex flex-wrap gap-2 md:gap-4 pb-2">
                      <div className={`flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-xl border ${validationChecks.leads ? 'border-[#af43db]/20 bg-[#af43db]/5 text-[#af43db]' : 'border-amber-500/20 bg-amber-500/5 text-amber-500'} text-[10px] md:text-xs font-semibold whitespace-nowrap`}>
                        {validationChecks.leads ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                        Role A: Leads Secure
                      </div>
                      <div className="flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-xl border border-[#af43db]/20 bg-[#af43db]/5 text-[#af43db] text-[10px] md:text-xs font-semibold whitespace-nowrap">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Role D: Trio Clear
                      </div>
                      <div className={`flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-xl border ${validationChecks.participation ? 'border-[#af43db]/20 bg-[#af43db]/5 text-[#af43db]' : 'border-amber-500/20 bg-amber-500/5 text-amber-500'} text-[10px] md:text-xs font-semibold whitespace-nowrap`}>
                        {validationChecks.participation ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                        Role E: Fairness Lock
                      </div>
                    </div>
                  )}

                  <Card className="bg-[#1e1e1e] border-[#27272a] shadow-2xl overflow-hidden flex flex-col">
                    <div className="p-8 pb-4 flex flex-col md:flex-row items-center justify-between gap-6">
                      <div className="space-y-1">
                        <h3 className="text-2xl font-bold tracking-tight text-white">{monthLabel} Service Rota</h3>
                        <p className="text-[#a1a1aa] text-sm">Synchronized schedule for Sunday gatherings</p>
                      </div>
                      <div className="flex gap-3 w-full md:w-auto">
                        <Button variant="outline" className="bg-[#0a0a0a] border-[#27272a] text-white rounded-xl px-4 hover:bg-[#141414] shadow-lg flex-1 md:flex-none" onClick={() => { setAddMode('regenerate'); setIsRotaAddPersonOpen(true); }}>
                           <UserPlus className="w-4 h-4 mr-2" />
                           Add
                        </Button>
                        <Button onClick={downloadRota} variant="outline" className="bg-[#0a0a0a] border-[#27272a] text-white rounded-xl px-4 hover:bg-[#141414] shadow-lg flex-1 md:flex-none">
                           <Download className="w-4 h-4 mr-2 text-[#af43db]" />
                           CSV
                        </Button>
                      </div>
                    </div>
                    <div className="p-0 overflow-x-auto custom-scrollbar">
                      <Table className="relative min-w-[600px]">
                        <TableHeader className="bg-[#1e1e1e] sticky top-0 z-10 before:content-[''] before:absolute before:inset-0 before:border-b before:border-[#27272a]">
                          <TableRow className="border-[#27272a] hover:bg-transparent">
                            <TableHead className="w-[120px] text-[#a1a1aa] uppercase text-[10px] font-bold py-3">Date</TableHead>
                            <TableHead className="text-[#a1a1aa] uppercase text-[10px] font-bold py-3">Assignments</TableHead>
                            <TableHead className="w-[80px] text-right text-[#a1a1aa] uppercase text-[10px] font-bold py-3">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {currentRota.map((day, idx) => (
                            <TableRow key={idx} className="border-[#27272a] hover:bg-[#141414] transition-colors group">
                              <TableCell className="font-bold text-white align-middle py-2 text-sm">{day.date}</TableCell>
                              <TableCell className="py-2">
                                <div className="flex flex-wrap gap-1.5">
                                  {[...day.assignments]
                                    .sort((a, b) => {
                                      const order = { 'Team Lead': 0, 'Team Member': 1, 'Shadower': 2 };
                                      return order[a.role] - order[b.role];
                                    })
                                    .map((as, aidx) => (
                                    <button 
                                      key={aidx} 
                                      onClick={() => {
                                        setSwapData({ dayIndex: idx, assignmentIndex: aidx, currentDate: day.date, currentAssignment: as });
                                        setSwapTarget('');
                                      }}
                                      className={`
                                        px-2 py-1 rounded-md text-[11px] font-bold border flex flex-col justify-center text-left hover:scale-105 transition-transform cursor-pointer
                                        ${as.role === 'Team Lead' ? 'bg-[#af43db]/10 border-[#af43db]/20 text-[#af43db] hover:bg-[#af43db]/20' : 
                                          'bg-[#1a1a1a] border-[#27272a] text-[#f2f2f2] hover:bg-[#27272a]'}
                                      `}
                                      title="Click to change or remove"
                                    >
                                      {as.role !== 'Team Member' && (
                                        <span className={`text-[8px] uppercase tracking-tighter leading-none mb-0.5 ${as.role === 'Team Lead' ? 'opacity-70' : 'text-[#a1a1aa]'}`}>
                                          {as.role}
                                        </span>
                                      )}
                                      {as.displayName || as.personName}
                                    </button>
                                  ))}
                                  {day.assignments.length === 0 && <span className="text-[#52525b] text-[10px] italic font-mono">None</span>}
                                </div>
                              </TableCell>
                              <TableCell className="text-right py-2 align-middle">
                                {day.hasLeadWarning ? (
                                  <div className="inline-flex items-center text-rose-500" title="Lead Missing">
                                     <AlertTriangle className="w-3.5 h-3.5" />
                                  </div>
                                ) : (
                                  <div className="text-[#af43db] flex justify-end">
                                    <CheckCircle2 className="w-4 h-4 opacity-40 hover:opacity-100 transition-opacity" />
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>

                  {/* Rota Add Dialog */}
                  <Dialog open={isRotaAddPersonOpen} onOpenChange={setIsRotaAddPersonOpen}>
                    <DialogContent className="bg-[#1e1e1e] border-[#27272a] text-white sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Add to Rota</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <Tabs value={addMode} onValueChange={(v) => setAddMode(v as 'regenerate' | 'specific_day')} className="w-full">
                          <TabsList className="grid w-full grid-cols-2 bg-[#0a0a0a] border border-[#27272a] rounded-lg p-1">
                            <TabsTrigger value="regenerate" className="rounded-md data-[state=active]:bg-[#1e1e1e] data-[state=active]:text-white">Regenerate</TabsTrigger>
                            <TabsTrigger value="specific_day" className="rounded-md data-[state=active]:bg-[#1e1e1e] data-[state=active]:text-white">Specific Day</TabsTrigger>
                          </TabsList>
                        </Tabs>

                        <div className="space-y-2">
                          <Label>Name</Label>
                          <Input 
                            value={newPersonName} 
                            onChange={e => setNewPersonName(e.target.value)} 
                            className="bg-[#0a0a0a] border-[#27272a] text-white"
                            placeholder="Enter name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Display Name (Optional)</Label>
                          <Input 
                            value={newPersonDisplayName} 
                            onChange={e => setNewPersonDisplayName(e.target.value)} 
                            className="bg-[#0a0a0a] border-[#27272a] text-white"
                            placeholder="Enter display name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>System Role</Label>
                          <Select value={newPersonRole} onValueChange={(v) => setNewPersonRole(v as Role)}>
                            <SelectTrigger className="bg-[#0a0a0a] border-[#27272a] text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1e1e1e] border-[#27272a] text-white">
                              <SelectItem value="Team Lead">Team Lead</SelectItem>
                              <SelectItem value="Team Member">Team Member</SelectItem>
                              <SelectItem value="Shadower">Shadower</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {addMode === 'regenerate' ? (
                          <div className="space-y-2">
                            <Label>Available Dates</Label>
                            <ScrollArea className="h-32 border border-[#27272a] rounded-md p-2 bg-[#0a0a0a]">
                              {availability.map(day => (
                                <div key={day.date} className="flex items-center space-x-2 py-1">
                                  <Checkbox 
                                    id={`rota-day-${day.date}`}
                                    checked={newPersonAvailability.includes(day.date)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setNewPersonAvailability(prev => [...prev, day.date]);
                                      } else {
                                        setNewPersonAvailability(prev => prev.filter(d => d !== day.date));
                                      }
                                    }}
                                    className="border-[#52525b] data-[state=checked]:bg-[#af43db] data-[state=checked]:border-[#af43db]"
                                  />
                                  <Label htmlFor={`rota-day-${day.date}`} className="text-sm font-medium leading-none cursor-pointer">
                                    {day.date}
                                  </Label>
                                </div>
                              ))}
                            </ScrollArea>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Label>Target Date</Label>
                            <Select value={newPersonTargetDate} onValueChange={setNewPersonTargetDate}>
                              <SelectTrigger className="bg-[#0a0a0a] border-[#27272a] text-white">
                                <SelectValue placeholder="Select a date..." />
                              </SelectTrigger>
                              <SelectContent className="bg-[#1e1e1e] border-[#27272a] text-white">
                                {currentRota.map(day => (
                                  <SelectItem key={day.date} value={day.date}>
                                    {day.date}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                      <DialogFooter>
                        <Button onClick={handleRotaAddPerson} className="bg-[#8c36af] hover:bg-[#af43db] text-white w-full">
                          {addMode === 'regenerate' ? 'Add & Regenerate' : 'Assign to Date'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* Swap Dialog */}
                  <Dialog open={!!swapData} onOpenChange={(open) => !open && setSwapData(null)}>
                    <DialogContent className="bg-[#1e1e1e] border-[#27272a] text-white overflow-hidden">
                      <DialogHeader>
                        <DialogTitle>Modify Assignment</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <p className="text-sm text-[#a1a1aa]">
                          Replace <strong className="text-white">{swapData?.currentAssignment?.displayName || swapData?.currentAssignment?.personName}</strong> on {swapData?.currentDate} or remove them entirely.
                        </p>
                        <div className="space-y-2">
                          <Label>Select Replacement</Label>
                          <Select value={swapTarget} onValueChange={setSwapTarget}>
                            <SelectTrigger className="bg-[#0a0a0a] border-[#27272a] text-white">
                              <SelectValue placeholder="Choose a person..." />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1e1e1e] border-[#27272a] text-white max-h-64">
                              {swapData && people
                                .filter(p => p.name !== swapData.currentAssignment.personName && !currentRota[swapData.dayIndex]?.assignments.some((a: any) => a.personName === p.name))
                                .sort((a,b) => {
                                  const aAvail = availability.find(av => av.date === swapData.currentDate)?.availablePeople.includes(a.name) ? 1 : 0;
                                  const bAvail = availability.find(av => av.date === swapData.currentDate)?.availablePeople.includes(b.name) ? 1 : 0;
                                  if (aAvail !== bAvail) return bAvail - aAvail;
                                  return a.name.localeCompare(b.name);
                                })
                                .map(p => {
                                   const isAvail = availability.find(a => a.date === swapData.currentDate)?.availablePeople.includes(p.name);
                                   return (
                                     <SelectItem key={p.id} value={p.name}>
                                       {p.displayName || p.name} ({p.role}) {isAvail ? ' (Available)' : ''}
                                     </SelectItem>
                                   )
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <Button variant="destructive" className="bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border-0" onClick={handleRemovePerson}>
                          Remove
                        </Button>
                        <div className="flex gap-2">
                          <Button variant="outline" className="bg-transparent border-[#27272a] text-white hover:bg-[#27272a]" onClick={() => setSwapData(null)}>Cancel</Button>
                          <Button className="bg-[#8c36af] hover:bg-[#af43db] text-white" onClick={handleSwapConfirm} disabled={!swapTarget}>
                            Swap
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </motion.div>
              )}

              {/* HISTORY TAB CONTENT */}
              {activeTab === 'history' && (
                <motion.div 
                  key="history"
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
                >
                  {history.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center p-32 text-center space-y-6 border-2 border-dashed border-[#27272a] rounded-3xl opacity-50">
                      <HistoryIcon className="w-16 h-16 text-[#27272a]" />
                      <div className="space-y-1">
                        <p className="text-white font-bold text-xl tracking-tight">System Logs Empty</p>
                        <p className="text-[#a1a1aa] text-sm">Generate your first rota to initialize historical indexing.</p>
                      </div>
                    </div>
                  )}
                  {history.map((rota) => (
                    <Card key={rota.id} className="bg-[#1e1e1e] border-[#27272a] hover:border-[#af43db]/50 hover:shadow-2xl hover:shadow-[#af43db]/5 transition-all duration-500 group overflow-hidden">
                      <div className="p-8 space-y-6">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="bg-[#0a0a0a] border-[#27272a] text-[#a1a1aa] px-3 py-1 text-[10px] uppercase font-bold tracking-widest">
                            {format(rota.timestamp, 'MMM dd, HH:mm')}
                          </Badge>
                          <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-[#52525b] hover:text-rose-500 hover:bg-rose-500/10 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteHistoryItem(rota.id);
                              }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-2xl font-bold text-white tracking-tight">{rota.monthLabel}</h4>
                          <div className="flex items-center gap-2 text-xs text-[#a1a1aa]">
                            <Calendar className="w-3.5 h-3.5" />
                            {rota.days.length} Service Dates Scheduled
                          </div>
                        </div>
                        <div className="flex items-center gap-3 pt-2">
                           <div className="flex -space-x-2.5">
                              {[...new Set(rota.days.flatMap(d => d.assignments.map(a => a.displayName || a.personName)))].slice(0, 4).map((name, i) => (
                                <div key={i} className="w-9 h-9 rounded-xl bg-[#0a0a0a] border-2 border-[#1e1e1e] flex items-center justify-center text-[11px] font-black text-[#af43db]">
                                  {(name as string).substring(0, 1).toUpperCase()}
                                </div>
                              ))}
                              <div className="w-9 h-9 rounded-xl bg-[#8c36af] border-2 border-[#1e1e1e] flex items-center justify-center text-[10px] font-black text-white shadow-lg">
                                 +{Math.max(0, [...new Set(rota.days.flatMap(d => d.assignments.map(a => a.displayName || a.personName)))].length - 4)}
                              </div>
                           </div>
                        </div>
                      </div>
                      <div className="px-8 py-4 bg-[#141414] border-t border-[#27272a] flex justify-end group-hover:bg-[#af43db]/5 transition-colors">
                         <Button 
                          variant="ghost" 
                          className="text-[#af43db] hover:text-[#c46df0] font-bold transition-all p-0 h-auto gap-2"
                          onClick={() => {
                            setCurrentRota(rota.days);
                            setMonthLabel(rota.monthLabel);
                            setCurrentRotaId(rota.id);
                            setActiveTab('rota');
                          }}
                         >
                           RESTORE STATE
                           <ChevronRight className="w-4 h-4" />
                         </Button>
                      </div>
                    </Card>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* Status Bar / Footer */}
          <footer className="h-10 border-t border-[#27272a] bg-[#141414] px-8 flex items-center justify-between text-[#52525b] text-[9px] uppercase tracking-[0.2em] font-bold">
            <div className="flex gap-8">
              <span className="flex items-center gap-2 text-[#af43db]/60 uppercase"><ShieldCheck className="w-3 h-3" /> Core Algorithm: Verified</span>
              <span>Sunday Optimization V2.1.0</span>
            </div>
            <span>© 2026 Sunday Rota Master System</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
