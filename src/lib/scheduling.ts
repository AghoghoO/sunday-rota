/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Role, Person, DayAvailability, RotaDay, Assignment, Rota } from './types';

const TRIO_NAMES = ["David", "Pedro", "PDЯ", "Peter"];

export function generateRota(
  people: Person[],
  availability: DayAvailability[]
): RotaDay[] {
  const activePeople = people.filter(p => !p.isExcluded);
  const assignmentsByPerson: Record<string, number> = {};
  activePeople.forEach(p => {
    assignmentsByPerson[p.name] = 0;
  });

  const rota: RotaDay[] = availability.map(day => ({
    date: day.date,
    assignments: [],
    hasLeadWarning: false,
  }));

  // Helper to check trio conflict
  const checkTrioConflict = (existingAssignments: Assignment[], newPersonName: string) => {
    const names = [...existingAssignments.map(a => a.personName), newPersonName];
    const presentTrioCount = names.filter(name => 
      TRIO_NAMES.some(trio => name.toLowerCase().includes(trio.toLowerCase()))
    ).length;
    
    // The specific trio David, Pedro/PDЯ, and Peter cannot all be together.
    // However, PDЯ and Pedro might be different people? User says "David, PDЯ (or Pedro), and Peter".
    // I'll assume if any 3 distinct names from this list are present, it's a conflict.
    // Actually, "Pedro" and "PDЯ" are likely the same person. Let's group them.
    const uniqueTrioCategories = new Set<string>();
    names.forEach(name => {
      const n = name.toLowerCase();
      if (n.includes("david")) uniqueTrioCategories.add("david");
      if (n.includes("pedro") || n.includes("pdя")) uniqueTrioCategories.add("pedro");
      if (n.includes("peter")) uniqueTrioCategories.add("peter");
    });
    
    return uniqueTrioCategories.size >= 3;
  };

  // 1. Assign Shadowers first (Rule C - any week they are available)
  rota.forEach(day => {
    const availNames = availability.find(a => a.date === day.date)?.availablePeople || [];
    const availableShadowers = activePeople.filter(p => p.role === 'Shadower' && availNames.includes(p.name));
    availableShadowers.forEach(s => {
      day.assignments.push({ personName: s.name, displayName: s.displayName, role: 'Shadower' });
      assignmentsByPerson[s.name]++;
    });
  });

  // 2. Rule E & Fair Participation: Prioritize people with limited availability
  // First, identify people who have only 1 or 2 slots.
  const peopleScarcity = activePeople.map(p => ({
    name: p.name,
    slots: availability.filter(a => a.availablePeople.includes(p.name)).length,
    role: p.role
  })).sort((a,b) => a.slots - b.slots);

  // Function to try assign a person to a day
  const tryAssign = (person: Person, dayIndex: number): boolean => {
    const day = rota[dayIndex];
    const avail = availability[dayIndex];
    
    if (!avail.availablePeople.includes(person.name)) return false;
    if (day.assignments.some(a => a.personName === person.name)) return false;

    if (person.role === 'Team Lead') {
      // Check if we already have a lead? We can have multiple leads, but Rule A says "at least 1".
      // Let's limit to 1 lead per day for fairness unless we have extra leads.
      const existingLeads = day.assignments.filter(a => a.role === 'Team Lead').length;
      if (existingLeads >= 1) return false; 
    } else if (person.role === 'Team Member') {
      const existingMembers = day.assignments.filter(a => a.role === 'Team Member').length;
      if (existingMembers >= 2) return false;
      if (checkTrioConflict(day.assignments, person.name)) return false;
    }

    day.assignments.push({ personName: person.name, displayName: person.displayName, role: person.role });
    assignmentsByPerson[person.name]++;
    return true;
  };

  // Pass 1: Ensure everyone with limited availability gets at least one slot
  peopleScarcity.filter(ps => ps.role !== 'Shadower').forEach(ps => {
    if (assignmentsByPerson[ps.name] > 0) return;
    const person = activePeople.find(p => p.name === ps.name)!;
    
    // Find all available days for this person
    const possibleDays = availability
      .map((a, i) => ({ a, i }))
      .filter(x => x.a.availablePeople.includes(ps.name))
      // Sort days by "need" (e.g. days with no leads first if this is a lead)
      .sort((a, b) => {
        const dayA = rota[a.i];
        const dayB = rota[b.i];
        if (person.role === 'Team Lead') {
           const hasLeadA = dayA.assignments.some(as => as.role === 'Team Lead');
           const hasLeadB = dayB.assignments.some(as => as.role === 'Team Lead');
           if (!hasLeadA && hasLeadB) return -1;
           if (hasLeadA && !hasLeadB) return 1;
        }
        return dayA.assignments.length - dayB.assignments.length;
      });

    for (const d of possibleDays) {
      if (tryAssign(person, d.i)) break;
    }
  });

  // Pass 2: Fill Rule A (At least 1 Team Lead per day)
  rota.forEach((day, i) => {
    const hasLead = day.assignments.some(a => a.role === 'Team Lead');
    if (!hasLead) {
      const availableLeads = activePeople
        .filter(p => p.role === 'Team Lead' && availability[i].availablePeople.includes(p.name))
        .sort((a, b) => assignmentsByPerson[a.name] - assignmentsByPerson[b.name]);
      
      for (const lead of availableLeads) {
        if (tryAssign(lead, i)) break;
      }
    }
  });

  // Pass 3: Fill Rule B (Target up to 2 Team Members per week if possible, but keep it fair)
  rota.forEach((day, i) => {
    const currentMembers = day.assignments.filter(a => a.role === 'Team Member').length;
    if (currentMembers < 2) {
      const availableMembers = activePeople
        .filter(p => p.role === 'Team Member' && availability[i].availablePeople.includes(p.name))
        .sort((a, b) => assignmentsByPerson[a.name] - assignmentsByPerson[b.name]);
      
      for (const member of availableMembers) {
        if (day.assignments.filter(a => a.role === 'Team Member').length >= 2) break;
        tryAssign(member, i);
      }
    }
  });

  // Final check for Rule A and set warnings
  rota.forEach((day, i) => {
    const hasLead = day.assignments.some(a => a.role === 'Team Lead');
    if (!hasLead) {
      day.hasLeadWarning = true;
    }
  });

  return rota;
}
