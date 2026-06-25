import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { ChemicalsPage } from "@/features/chemicals";
import { NioshPage } from "@/features/niosh";
import { ThreatZonePage } from "@/features/threat-zone";
import { PlumePage } from "@/features/plume";
import { FacilitiesPage } from "@/features/facilities";
import { IncidentsPage } from "@/features/incidents";
import { SensorsPage } from "@/features/sensors";
import { SettingsPage } from "@/app/SettingsPage";

const navItems = [
  { to: "/chemicals", label: "Chemicals" },
  { to: "/niosh", label: "NIOSH" },
  { to: "/threat-zone", label: "Threat Zone" },
  { to: "/plume", label: "Plume" },
  { to: "/facilities", label: "Facilities" },
  { to: "/sensors", label: "Sensors" },
  { to: "/incidents", label: "Incidents" },
  { to: "/settings", label: "Settings" },
];

export function App() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" alt="" className="h-8 w-8" />
            <span className="text-lg font-bold tracking-tight">Hazmat Response</span>
          </div>
          <span className="badge">M0 · Skeleton</span>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-2" aria-label="Primary">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `tap-target whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-amber-500 text-slate-950"
                    : "text-slate-300 hover:bg-slate-800"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-4">
        <Routes>
          <Route path="/" element={<Navigate to="/chemicals" replace />} />
          <Route path="/chemicals" element={<ChemicalsPage />} />
          <Route path="/niosh" element={<NioshPage />} />
          <Route path="/threat-zone" element={<ThreatZonePage />} />
          <Route path="/plume" element={<PlumePage />} />
          <Route path="/facilities" element={<FacilitiesPage />} />
          <Route path="/sensors" element={<SensorsPage />} />
          <Route path="/incidents" element={<IncidentsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/chemicals" replace />} />
        </Routes>
      </main>

      <footer className="border-t border-slate-800 px-4 py-3 text-center text-xs text-slate-500">
        Modeling estimates. Confirm with ALOHA for legal/operational decisions.
      </footer>
    </div>
  );
}
