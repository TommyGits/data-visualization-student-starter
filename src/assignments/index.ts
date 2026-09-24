import type { ComponentType } from 'react';
import { ResponsivePseudoScatterPlot } from './week-01/ResponsivePseudoScatterPlot';
import { SteamSum } from './week-02/SteamSum';
import { SteamScatterPlot } from './week-03/SteamScatterPlot';
import { UpdateSteamScatterPlot } from './week-04/UpdateSteamScatterPlot';
import { interact } from './week-05/interact';

export interface Assignment {
  id: string;
  name: string;
  component: ComponentType;
}

export const assignments: Assignment[] = [
  {
    id: '1',
    name: 'Week 1',
    component: ResponsivePseudoScatterPlot,
  },
  {
    id: '2',
    name: 'Week 2',
    component: SteamSum,
  },
  {
    id: '3',
    name: 'Week 3',
    component: SteamScatterPlot,
  },
  {
    id: '4',
    name: 'Week 4',
    component: UpdateSteamScatterPlot,
  },
  {
    id: '5',
    name: 'Week 5',
    component: interact,
  },
];

export const assignmentsMap = new Map(
  assignments.map((ex) => [ex.id, ex])
);

export const defaultAssignment = '1';