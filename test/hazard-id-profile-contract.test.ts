import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { parse } from "acorn";
import { describe, expect, it } from "vitest";
import app from "../server/src/app.js";
import { searchStarterHazards } from "../src/lib/hazard-id/hazardSearch.js";
import { starterHazardProfile } from "../src/lib/hazard-id/hazardProfileAdapter.js";

const script = readFileSync(new URL("../server/public/script.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../server/public/hazard-profile-page.css", import.meta.url), "utf8");
const program = parse(script, { ecmaVersion: "latest" });

function declaration(name: string) {
  const node = program.body.find((item) => item.type === "FunctionDeclaration" && item.id?.name === name);
  if (!node) throw new Error(`Missing ${name}`);
  return script.slice(node.start, node.end);
}

function normalizerRuntime() {
  return [
    "profileObject", "profileArray", "profileFacts", "uniqueProfileFacts", "profileFactsForGroups",
    "physicsProfileFacts", "normalizeChemicalProfileForUi", "normalizeHazardProfileForUi", "normalizeProfileForUi",
  ].map(declaration).join("\n");
}

class FakeNode {
  children: FakeNode[] = [];
  dataset: Record<string, string> = {};
  className = "";
  textContent = "";
  attributes: Record<string, string> = {};

  append(...children: FakeNode[]) { this.children.push(...children.filter(Boolean)); }
  replaceChildren(...children: FakeNode[]) { this.children = []; this.append(...children); }
  setAttribute(name: string, value: string) { this.attributes[name] = value; }
  addEventListener() {}
  querySelectorAll() { return []; }
}

describe("Hazard ID profile contract and routing", () => {
  it.each([
    ["CHEMICAL", "sulfur dioxide", "102"], ["CHEMICAL", "chlorine", "22"], ["CHEMICAL", "ammonia", "10"],
    ["CBRNE_CWA", "Sarin", "sarin-gb"], ["CBRNE_CWA", "VX", "vx"], ["CBRNE_CWA", "Sulfur Mustard", "sulfur-mustard-hd"],
    ["CBRNE_CWA", "Anthrax", "anthrax"], ["CBRNE_CWA", "Ricin", "ricin"],
    ["RADIOLOGICAL", "Cs-137", "cesium-137"], ["RADIOLOGICAL", "Co-60", "cobalt-60"],
    ["RADIOLOGICAL", "RDD", "radiological-dispersal-device"], ["RADIOLOGICAL", "IND", "improvised-nuclear-device"],
  ])("returns a profile route for the %s smoke record %s", async (lane, query, expectedId) => {
    const searchUrl = lane === "CHEMICAL"
      ? `/api/chemicals/search?q=${encodeURIComponent(query)}`
      : `/api/hazards/search?lane=${lane}&q=${encodeURIComponent(query)}`;
    const search = await app.request(searchUrl);
    expect(search.status).toBe(200);
    const payload = await search.json();
    const result = lane === "CHEMICAL" ? payload.chemicals[0] : payload.results[0];
    expect(lane === "CHEMICAL" ? String(result.ChemicalID) : result.id).toBe(expectedId);

    const profileUrl = lane === "CHEMICAL"
      ? `/api/chemicals/${expectedId}/profile`
      : `/api/hazards/${lane}/${expectedId}/profile`;
    const profile = await app.request(profileUrl);
    expect(profile.status).toBe(200);
    const profilePayload = await profile.json();
    expect(lane === "CHEMICAL" ? profilePayload.header.name : profilePayload.id).toBe(
      lane === "CHEMICAL" ? result.ChemicalName : expectedId,
    );
  });

  it("normalizes ordinary chemical fields to safe section shapes", () => {
    const context = runInNewContext(`${normalizerRuntime()}; normalizeProfileForUi({
      id: 102,
      header: { name: 'Sulfur dioxide', cas: '7446-09-5', un: '1079', ergGuide: '125', idlh: '100 ppm', sources: ['NIOSH'] },
      reactivity: { incompatibilities: 'chlorine', decompositionProducts: null },
      fire: { extinguishingMedia: 'water fog' },
      decon: { sourceBasis: 'ERG 2024' },
      medical: null,
    })`, {});

    expect(context).toMatchObject({
      kind: "chemical",
      header: { name: "Sulfur dioxide", cas: "7446-09-5", un: "1079", ergGuide: "125", sources: ["NIOSH"] },
      reactivity: { incompatibilities: ["chlorine"], decompositionProducts: [] },
      fire: { extinguishingMedia: ["water fog"] },
      decon: { sourceBasis: ["ERG 2024"] },
      medical: {},
    });
  });

  it("consolidates Hydrazine physical properties into the two-card Properties layout", async () => {
    const response = await app.request("/api/chemicals/54/profile");
    expect(response.status).toBe(200);
    const profile = await response.json();
    expect(profile.header.name).toBe("Hydrazine");
    expect(profile.properties).toMatchObject({
      flashPoint: "38 (closed cup)",
      ignitionTemperature: expect.stringContaining("23"),
      lelUel: "2.9 % / 100 %",
      odorThreshold: expect.stringContaining("3.5"),
      ionizationPotential: "8.93",
      heatOfVaporization: "299",
    });
    const properties = script.slice(script.indexOf("{ key: 'properties'"), script.indexOf("{ key: 'exposures'"));
    expect(properties).toContain("createProfileSection('Chemical Properties'");
    for (const label of [
      "Flash point", "Ignition / autoignition temperature", "LEL / UEL", "Odor threshold",
      "Ionization potential", "Heat of vaporization",
    ]) expect(properties).toContain(`label: '${label}'`);
    expect(properties).toContain("createProfileSection('Reactivity'");
    expect(properties).not.toContain("createProfileSection('Flammability & Energy'");
    expect(properties).not.toContain("createProfileSection('Synonyms & Notes'");
    expect(styles).toContain("data-active-tab=\"properties\"] {");
    expect(styles).toContain("grid-template-columns: repeat(2, minmax(0, 1fr)) !important;");
    expect(styles).toContain("data-section=\"reactivity\"] {");
  });

  it.each([[54, "Hydrazine"], [102, "Sulfur dioxide"], [22, "Chlorine"]])(
    "keeps the %s profile header data available for polished identifier cards",
    async (id, name) => {
      const response = await app.request(`/api/chemicals/${id}/profile`);
      expect(response.status).toBe(200);
      const profile = await response.json();
      expect(profile.header.name).toBe(name);
      expect(profile.header).toEqual(expect.objectContaining({ un: expect.anything(), ergGuide: expect.anything() }));
      expect(styles).toContain(".chemical-nfpa-placard {");
      expect(styles).toContain("border: 0 !important;");
      expect(styles).toContain("background: transparent !important;");
      expect(styles).toContain("data-field=\"un-na\"] .chemical-profile-meta-title");
      expect(styles).toContain("data-field=\"erg-guide\"] .chemical-profile-meta-title");
      expect(styles).toContain("data-field=\"hazard-class\"] .chemical-profile-meta-title");
    },
  );

  it("keeps Overview operational and moves detailed monitoring into PPE & Monitoring", () => {
    const overview = script.slice(script.indexOf("{ key: 'overview'"), script.indexOf("{ key: 'properties'"));
    const monitoring = script.slice(script.indexOf("function createDetailedMonitoringSections"), script.indexOf("function createErgGreenTable"));
    expect(overview).toContain("createChemicalProfileColumn('summary'");
    expect(overview).toContain("createChemicalProfileColumn('operations'");
    expect(overview).toContain("createProfileSection('Chemical Summary'");
    expect(overview).toContain("createProfileSection('AEGL Values'");
    expect(overview).toContain("createProfileSection('Frontline Considerations'");
    expect(overview).not.toContain("createProfileSection('EMS Considerations'");
    expect(script).toContain("createProfileSection('Entry Cautions'");
    expect(overview).not.toContain("createProfileSection('Monitoring / Detection'");
    expect(overview).not.toContain("createProfileSection('Decon Considerations'");
    for (const title of [
      "Monitoring Methods", "Detection / Identification", "Instrument Limitations / Interferences", "Field Monitoring / Readings",
    ]) expect(monitoring).toContain(`createProfileSection('${title}'`);
    expect(styles).toContain("chemical-profile-overview-column");
    expect(styles).toContain("grid-template-columns: repeat(2, minmax(0, 1fr)) !important;");
  });

  it("builds frontline evidence without copying EMS treatment guidance", () => {
    const source = ["profileObject", "profileArray", "chemicalFrontlineValues", "chemicalEntryCautionValues", "chemicalFrontlineRows"]
      .map(declaration).join("\n");
    const meaningful = (value: unknown): boolean => Array.isArray(value)
      ? value.some((item) => meaningful(item))
      : value !== null && value !== undefined && String(value).trim() !== "" && !/^No Current Data Exists$/i.test(String(value));
    const context = {
      hasMeaningfulChemicalProfileData: meaningful,
      normalizeDataSourceOutput: (value: unknown) => Array.isArray(value) ? value.join(" · ") : String(value ?? ""),
    } as Record<string, unknown>;
    const profile = {
      header: { name: "Sulfur dioxide", cas: "7446-09-5" },
      properties: { formula: "SO2", physicalState: "Gas", appearance: "Colorless", odor: "Irritating" },
      ppeRecommendation: {
        displayLabel: "Vapor Protective Level A w/ SCBA",
        respiratoryProtection: "Positive-pressure SCBA required.",
        scbaRequired: true,
        decisionReasons: ["Explicit protection-level guidance: Level A for unknown release"],
        verificationRequirements: ["Air monitoring", "Oxygen concentration"],
      },
      ppeRespiratory: {},
      isolationErg: {
        initialIsolationDistance: "100 m",
        protectiveActionDistance: ["Small spill: 0.1 km"],
      },
      fire: {
        flammability: "Flammable liquid",
        firefightingPrecautions: ["Use positive-pressure SCBA."],
      },
      detectors: {
        items: ["Sulfur Dioxide SO2 tube"],
        limitations: ["Cross-sensitive; confirm with an independent method."],
      },
      response: { healthHazards: ["Vapors are extremely irritating and corrosive."] },
      medical: { emsConsiderations: ["Provide oxygen and monitor ABCs."] },
    };
    const rows = runInNewContext(`${source}; chemicalFrontlineRows(${JSON.stringify(profile)})`, context);
    const labels = (rows as Array<{ label: string }>).map((row) => row.label);
    expect(labels).toContain("PPE / respiratory protection");
    expect(labels).toContain("SCBA requirement");
    expect(labels).toContain("Isolation / protective action");
    expect(labels).toContain("Fire considerations");
    expect(labels).toContain("Identity / verification");
    expect(labels).not.toContain("Monitoring / detection");
    expect(labels).not.toContain("Direct identification methods");
    expect(labels).not.toContain("Instrument limitations / interferences");
    expect(labels).not.toContain("EMS considerations");
    expect(JSON.stringify(rows)).not.toMatch(/Provide oxygen|monitor ABCs/i);
  });

  it("returns no frontline card rows when the chemical has no operational evidence", () => {
    const source = ["profileObject", "profileArray", "chemicalFrontlineValues", "chemicalEntryCautionValues", "chemicalFrontlineRows"]
      .map(declaration).join("\n");
    const meaningful = (value: unknown): boolean => Array.isArray(value)
      ? value.some((item) => meaningful(item))
      : value !== null && value !== undefined && String(value).trim() !== "" && !/^No Current Data Exists$/i.test(String(value));
    const context = {
      hasMeaningfulChemicalProfileData: meaningful,
      normalizeDataSourceOutput: (value: unknown) => Array.isArray(value) ? value.join(" · ") : String(value ?? ""),
    } as Record<string, unknown>;
    expect(runInNewContext(`${source}; chemicalFrontlineRows({})`, context)).toEqual([]);
  });

  it.each([[102, "Sulfur dioxide"], [22, "Chlorine"], [10, "Ammonia (anhydrous)"]]) ("keeps EMS content out of frontline rows for %s", async (id, name) => {
      const response = await app.request(`/api/chemicals/${id}/profile`);
      expect(response.status).toBe(200);
      const profile = await response.json();
      expect(profile.header.name).toBe(name);
      const source = ["profileObject", "profileArray", "chemicalFrontlineValues", "chemicalEntryCautionValues", "chemicalFrontlineRows"]
        .map(declaration).join("\n");
      const meaningful = (value: unknown): boolean => Array.isArray(value)
        ? value.some((item) => meaningful(item))
        : value !== null && value !== undefined && String(value).trim() !== "" && !/^No Current Data Exists$/i.test(String(value));
      const context = {
        hasMeaningfulChemicalProfileData: meaningful,
        normalizeDataSourceOutput: (value: unknown) => Array.isArray(value) ? value.join(" · ") : String(value ?? ""),
      } as Record<string, unknown>;
      const rows = runInNewContext(`${source}; chemicalFrontlineRows(${JSON.stringify(profile)})`, context);
      expect(rows.length).toBeGreaterThan(0);
      expect(JSON.stringify(rows)).not.toMatch(/ems|patient|treatment|first aid|ABCs/i);
      expect(profile.medical?.emsConsiderations?.length).toBeGreaterThan(0);
    });

  it("normalizes CWA, biological, radiological, and scenario profiles into the same fact contract", () => {
    const cases = [
      ["CBRNE_CWA", "sarin-gb"], ["CBRNE_CWA", "vx"], ["CBRNE_CWA", "sulfur-mustard-hd"],
      ["CBRNE_CWA", "anthrax"], ["CBRNE_CWA", "ricin"], ["RADIOLOGICAL", "cesium-137"],
      ["RADIOLOGICAL", "cobalt-60"], ["RADIOLOGICAL", "radiological-dispersal-device"],
      ["RADIOLOGICAL", "improvised-nuclear-device"],
    ] as const;
    const profiles = cases.map(([lane, id]) => starterHazardProfile(lane, id));
    const context = runInNewContext(`${normalizerRuntime()}; ${JSON.stringify(profiles)}.map(normalizeProfileForUi)`, {});

    expect(context).toHaveLength(cases.length);
    for (const profile of context) {
      expect(profile).toMatchObject({ kind: "hazard", id: expect.any(String), displayName: expect.any(String) });
      for (const field of [
        "overviewFacts", "hazardFacts", "detectionFacts", "samplingFacts", "analysisFacts", "ppeFacts",
        "deconFacts", "medicalFacts", "protectiveActionFacts", "technicalOperationsFacts", "sourceFacts",
      ]) expect(Array.isArray(profile[field])).toBe(true);
    }
    expect(context.find((profile: { id: string }) => profile.id === "cesium-137").physicsFacts.length).toBeGreaterThan(0);
  });

  it("renders null optional hazard domains as a compact no-data card", () => {
    const content = new FakeNode();
    const document = {
      getElementById: () => content,
      createElement: () => new FakeNode(),
      createDocumentFragment: () => new FakeNode(),
      createTextNode: (text: string) => Object.assign(new FakeNode(), { textContent: text }),
    };
    const source = ["profileObject", "profileArray", "profileFacts", "hazardProfileDisplayValue", "renderStarterHazardTab"]
      .map(declaration).join("\n");
    const context = { document, noCurrentDataText: "No Current Data Exists" };
    runInNewContext(`${source}; renderStarterHazardTab({ deconFacts: [null, { value: null }] }, ['deconFacts'])`, context);
    expect(content.children).toHaveLength(1);
    expect(content.children[0].children[0].dataset.state).toBe("empty");
  });

  it("keeps representative searches in their intended lanes and leaves the ordinary chlorine identity canonical", () => {
    expect(searchStarterHazards("CBRNE_CWA", "Sarin")[0]?.id).toBe("sarin-gb");
    expect(searchStarterHazards("CBRNE_CWA", "VX")[0]?.id).toBe("vx");
    expect(searchStarterHazards("CBRNE_CWA", "Sulfur Mustard")[0]?.id).toBe("sulfur-mustard-hd");
    expect(searchStarterHazards("CBRNE_CWA", "Anthrax")[0]?.id).toBe("anthrax");
    expect(searchStarterHazards("CBRNE_CWA", "Ricin")[0]?.id).toBe("ricin");
    expect(searchStarterHazards("RADIOLOGICAL", "Cs-137")[0]?.id).toBe("cesium-137");
    expect(searchStarterHazards("RADIOLOGICAL", "Co-60")[0]?.id).toBe("cobalt-60");
    expect(searchStarterHazards("RADIOLOGICAL", "RDD")[0]?.id).toBe("radiological-dispersal-device");
    expect(searchStarterHazards("RADIOLOGICAL", "IND")[0]?.id).toBe("improvised-nuclear-device");
    expect(styles).toContain("overflow: visible !important;");
    expect(styles).toContain("height: auto !important;");
  });
});
