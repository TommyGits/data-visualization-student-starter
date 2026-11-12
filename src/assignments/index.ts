import type { ComponentType } from "react";
import { ResponsivePseudoScatterPlot } from "./week-01/ResponsivePseudoScatterPlot";
import { SteamSum } from "./week-02/SteamSum";
import { SteamScatterPlot } from "./week-03/SteamScatterPlot";
import { UpdateSteamScatterPlot } from "./week-04/UpdateSteamScatterPlot";
import { interact } from "./week-05/interact";
import { Project1 } from "./week-06/project1";
import BinaryBlackHoles from "./week-07/BinaryBlackHoles";
import { StockExplorer } from "./week-08/StockExplorer";
import { InteractiveStockExplorer } from "./week-10/InteractiveStockExplorer";
import { UpdatedVisual } from "./week-11/UpdatedVisual";
import { OlistPayments } from "./week-12/OlistPayments";

export interface Assignment {
  id: string;
  name: string;
  component: ComponentType;
}

export const assignments: Assignment[] = [
  {
    id: "1",
    name: "Week 1",
    component: ResponsivePseudoScatterPlot,
  },
  {
    id: "2",
    name: "Week 2",
    component: SteamSum,
  },
  {
    id: "3",
    name: "Week 3",
    component: SteamScatterPlot,
  },
  {
    id: "4",
    name: "Week 4",
    component: UpdateSteamScatterPlot,
  },
  {
    id: "5",
    name: "Week 5",
    component: interact,
  },
  {
    id: "6",
    name: "Week 6",
    component: Project1,
  },
  {
    id: "7",
    name: "Week 7",
    component: BinaryBlackHoles,
  },
  {
    id: "8",
    name: "Week 8",
    component: StockExplorer,
  },
  {
    id: "10",
    name: "Week 10",
    component: InteractiveStockExplorer,
  },
  {
    id: "11",
    name: "Week 11",
    component: UpdatedVisual,
  },
  {
    id: "12",
    name: "Week 12",
    component: OlistPayments,
  },
];

export const assignmentsMap = new Map(
  assignments.map((assignment) => [assignment.id, assignment]),
);

export const defaultAssignment = "11";
