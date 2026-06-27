import { Routes, Route, NavLink, Navigate, useParams } from "react-router-dom";
import { HomePage } from "@/features/home";
import { ChemicalsPage } from "@/features/chemicals";
import { ChemicalDetailPage } from "@/features/chemicals/Detail";
import { NioshPage } from "@/features/niosh";
import { NPGDetailPage } from "@/features/niosh/Detail";
import { PlumePage } from "@/features/plume";
import { FacilitiesPage } from "@/features/facilities";
import { FacilityDetailPage } from "@/features/facilities/Detail";
import { IncidentsPage } from "@/features/incidents";
import { SensorsPage } from "@/features/sensors";
import { SettingsPage } from "@/app/SettingsPage";
import { PLUME_DISCLAIMER } from "@/lib/model";

const navItems = [
  { to: "/home", label: "Home" },
  { to: "/search", label: "Search" },
  { to: "/plume", label: "Plume" },
  { to: "/facilities", label: "Facilities" },
  { to: "/sensors", label: "Sensors" },
  { to: "/incidents", label: "Incidents" },
  { to: "/settings", label: "Settings" },
];

export function App({ dataVersion, dataSource }: { dataVersion?: string; dataSource?: "bundled" | "synced" | "cached" }) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" alt="" className="h-8 w-8" />
            <span className="text-lg font-bold tracking-tight">Hazmat Response</span>
          </div>
          {dataVersion && (
            <span className="badge" title="Bundled data version">
              {dataSource === "synced" ? "synced " : dataSource === "bundled" ? "bundled " : ""}
              {dataVersion}
            </span>
          )}
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2" aria-label="Primary">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `tap-target whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition ${
                  isActive ? "bg-amber-500 text-slate-950" : "text-slate-300 hover:bg-slate-800"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-4">
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/search" element={<ChemicalsPage />} />
          <Route path="/chemicals" element={<Navigate to="/search" replace />} />
          <Route path="/chemical/:id" element={<ChemicalDetailWrapper />} />
          <Route path="/niosh" element={<NioshPage />} />
          <Route path="/npg/:id" element={<NPGDetailWrapper />} />
          <Route path="/plume" element={<PlumePage />} />
          <Route path="/facilities" element={<FacilitiesPage />} />
          <Route path="/facility/:id" element={<FacilityDetailWrapper />} />
          <Route path="/incidents" element={<IncidentsPage />} />
          <Route path="/sensors" element={<SensorsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </main>

      <footer className="border-t border-slate-800 px-4 py-3 text-center text-xs text-slate-500">
        {PLUME_DISCLAIMER}
      </footer>
    </div>
  );
}

function ChemicalDetailWrapper() {
  const { id } = useParams();
  if (!id) return <Navigate to="/search" replace />;
  return <ChemicalDetailPage id={id} />;
}

function NPGDetailWrapper() {
  const { id } = useParams();
  if (!id) return <Navigate to="/niosh" replace />;
  return <NPGDetailPage id={id} />;
}

function FacilityDetailWrapper() {
  const { id } = useParams();
  if (!id) return <Navigate to="/facilities" replace />;
  return <FacilityDetailPage id={id} />;
}
