// Demo Tier II facility data — illustrative only.
// Real Tier II data is pulled from EPA + state portals + erplan.net in M4.
// Each facility carries a handful of chemicals from the master list at
// plausible (synthetic) inventory levels.

import type { Facility } from "@/lib/schema";

export const FACILITIES: Facility[] = [
  {
    id: "demo-water-treatment-plant",
    name: "Regional Water Treatment Plant",
    address: "1200 Reservoir Rd, Austin, TX 78701",
    lat: 30.270,
    lng: -97.745,
    dunn: "DEMO-0001",
    ehsFlag: true,
    chemicals: [
      { chemicalId: "chlorine", maxDailyAmount: { value: 18000, unit: "lb" }, container: "1-ton cylinder", conditions: "Ambient", lastReportedYear: 2024 },
      { chemicalId: "ammonia", maxDailyAmount: { value: 8000, unit: "lb" }, container: "150-lb cylinder", conditions: "Ambient", lastReportedYear: 2024 },
    ],
    source: "demo",
    lastUpdated: "2025-01-01",
  },
  {
    id: "demo-refinery",
    name: "Riverside Refinery (illustrative)",
    address: "5500 Petrochem Way, Houston, TX 77002",
    lat: 29.760,
    lng: -95.370,
    dunn: "DEMO-0002",
    ehsFlag: true,
    chemicals: [
      { chemicalId: "ammonia", maxDailyAmount: { value: 250000, unit: "lb" }, container: "Storage tank", conditions: "Pressurized", lastReportedYear: 2024 },
      { chemicalId: "hydrogen-sulfide", maxDailyAmount: { value: 5000, unit: "lb" }, container: "Pipeline", conditions: "Process", lastReportedYear: 2024 },
      { chemicalId: "benzene", maxDailyAmount: { value: 500000, unit: "lb" }, container: "Storage tank", conditions: "Ambient", lastReportedYear: 2024 },
      { chemicalId: "sulfur-dioxide", maxDailyAmount: { value: 30000, unit: "lb" }, container: "Storage tank", conditions: "Pressurized", lastReportedYear: 2024 },
    ],
    source: "demo",
    lastUpdated: "2025-01-01",
  },
  {
    id: "demo-pharma",
    name: "BioPharma Plant (illustrative)",
    address: "900 Innovation Pkwy, College Station, TX 77840",
    lat: 30.628,
    lng: -96.334,
    dunn: "DEMO-0003",
    ehsFlag: true,
    chemicals: [
      { chemicalId: "acrylonitrile", maxDailyAmount: { value: 50000, unit: "lb" }, container: "Tank truck", conditions: "Ambient", lastReportedYear: 2024 },
      { chemicalId: "methyl-isocyanate", maxDailyAmount: { value: 200, unit: "lb" }, container: "Process vessel", conditions: "Process", lastReportedYear: 2024 },
      { chemicalId: "hydrogen-cyanide", maxDailyAmount: { value: 500, unit: "lb" }, container: "Cylinders", conditions: "Ambient", lastReportedYear: 2024 },
    ],
    source: "demo",
    lastUpdated: "2025-01-01",
  },
  {
    id: "demo-cold-storage",
    name: "Port of Houston Cold Storage",
    address: "111 East Loop, Houston, TX 77029",
    lat: 29.760,
    lng: -95.273,
    dunn: "DEMO-0004",
    ehsFlag: false,
    chemicals: [
      { chemicalId: "ammonia", maxDailyAmount: { value: 35000, unit: "lb" }, container: "Refrigeration loop", conditions: "−28 °C", lastReportedYear: 2024 },
    ],
    source: "demo",
    lastUpdated: "2025-01-01",
  },
  {
    id: "demo-warehouse",
    name: "Regional Distribution Warehouse",
    address: "4400 Logistics Dr, Dallas, TX 75207",
    lat: 32.787,
    lng: -96.821,
    dunn: "DEMO-0005",
    ehsFlag: false,
    chemicals: [
      { chemicalId: "acrylic-acid", maxDailyAmount: { value: 5000, unit: "lb" }, container: "Drums", conditions: "Ambient", lastReportedYear: 2024 },
      { chemicalId: "phenol", maxDailyAmount: { value: 2000, unit: "lb" }, container: "Drums (molten)", conditions: "Heated", lastReportedYear: 2024 },
    ],
    source: "demo",
    lastUpdated: "2025-01-01",
  },
  {
    id: "demo-fertilizer",
    name: "Farmers Co-op Fertilizer",
    address: "200 County Rd 25, Lubbock, TX 79404",
    lat: 33.578,
    lng: -101.855,
    dunn: "DEMO-0006",
    ehsFlag: true,
    chemicals: [
      { chemicalId: "ammonia", maxDailyAmount: { value: 60000, unit: "lb" }, container: "Storage tank", conditions: "Pressurized", lastReportedYear: 2024 },
      { chemicalId: "nitric-acid", maxDailyAmount: { value: 25000, unit: "lb" }, container: "Tank", conditions: "Ambient", lastReportedYear: 2024 },
    ],
    source: "demo",
    lastUpdated: "2025-01-01",
  },
];

export function lookupFacility(id: string): Facility | undefined {
  return FACILITIES.find((f) => f.id === id);
}
