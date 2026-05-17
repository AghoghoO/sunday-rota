/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Role = 'Team Lead' | 'Team Member' | 'Shadower';

export interface Person {
  id: string;
  name: string;
  displayName?: string;
  role: Role;
  isExcluded: boolean;
  totalAssignments: number;
}

export interface DayAvailability {
  date: string;
  availablePeople: string[]; // List of person names
}

export interface Assignment {
  personName: string;
  displayName?: string;
  role: Role;
}

export interface RotaDay {
  date: string;
  assignments: Assignment[];
  hasLeadWarning: boolean;
}

export interface Rota {
  id: string;
  timestamp: number;
  monthLabel: string;
  days: RotaDay[];
}
