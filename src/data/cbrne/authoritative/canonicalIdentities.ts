import type {
  BiologicalIdentity,
  CanonicalCbrneIdentity,
  ChemicalCwaIdentity,
  RadNuclearScenarioIdentity,
} from "../../../lib/cbrne/authoritativeSourceTypes.js";
import { CBRNE_MASTER_RECORDS } from "../cbrne-master-records.js";
import { RADIONUCLIDE_PHYSICS_RECORDS } from "./radionuclidePhysics.js";

type ChemicalIdentityFields = Omit<ChemicalCwaIdentity, "namespace" | "canonicalCbrneId" | "name" | "aliases">;

const CHEMICAL_IDENTITIES: Readonly<Record<string, ChemicalIdentityFields>> = Object.freeze({
  "sarin-gb": { cas: ["107-44-8"], agentCodes: ["GB"], opcwClassification: "CWC Schedule 1", epaQrgArtifactId: "nrt-qrg-chemical-sarin-gb", ershArtifactId: "niosh-ersh-sarin" },
  vx: { cas: ["50782-69-9"], agentCodes: ["VX"], opcwClassification: "CWC Schedule 1", epaQrgArtifactId: "nrt-qrg-chemical-vx", ershArtifactId: "niosh-ersh-vx" },
  "tabun-ga": { cas: ["77-81-6"], agentCodes: ["GA"], opcwClassification: "CWC Schedule 1", epaQrgArtifactId: "nrt-qrg-chemical-tabun-ga", ershArtifactId: null },
  "soman-gd": { cas: ["96-64-0"], agentCodes: ["GD"], opcwClassification: "CWC Schedule 1", epaQrgArtifactId: "nrt-qrg-chemical-soman-gd", ershArtifactId: "niosh-ersh-soman" },
  "cyclosarin-gf": { cas: ["329-99-7"], agentCodes: ["GF"], opcwClassification: "CWC Schedule 1", epaQrgArtifactId: "nrt-qrg-chemical-cyclosarin-gf", ershArtifactId: null },
  "fourth-generation-agents": { cas: [], agentCodes: [], opcwClassification: "Agent family; individual identities require structure-specific CWC review", epaQrgArtifactId: null, ershArtifactId: null },
  "sulfur-mustard-hd": { cas: ["505-60-2"], agentCodes: ["HD"], opcwClassification: "CWC Schedule 1", epaQrgArtifactId: "nrt-qrg-chemical-sulfur-mustard-hd", ershArtifactId: "niosh-ersh-sulfur-mustard" },
  "lewisite-l": { cas: ["541-25-3"], agentCodes: ["L"], opcwClassification: "CWC Schedule 1", epaQrgArtifactId: "nrt-qrg-chemical-lewisite-l", ershArtifactId: null },
  "mustard-lewisite-hl": { cas: [], agentCodes: ["HL"], opcwClassification: "Mixture identity; components are CWC Schedule 1 chemicals", epaQrgArtifactId: "nrt-qrg-chemical-mustard-lewisite-hl", ershArtifactId: null },
  "nitrogen-mustard-hn1": { cas: ["538-07-8"], agentCodes: ["HN-1"], opcwClassification: "CWC Schedule 1", epaQrgArtifactId: null, ershArtifactId: null },
  "nitrogen-mustard-hn2": { cas: ["51-75-2"], agentCodes: ["HN-2"], opcwClassification: "CWC Schedule 1", epaQrgArtifactId: null, ershArtifactId: null },
  "nitrogen-mustard-hn3": { cas: ["555-77-1"], agentCodes: ["HN-3"], opcwClassification: "CWC Schedule 1", epaQrgArtifactId: null, ershArtifactId: null },
  "phosgene-oxime-cx": { cas: ["1794-86-1"], agentCodes: ["CX"], opcwClassification: null, epaQrgArtifactId: null, ershArtifactId: null },
  "hydrogen-cyanide-ac": { cas: ["74-90-8"], agentCodes: ["AC"], opcwClassification: "CWC Schedule 3", epaQrgArtifactId: "nrt-qrg-chemical-hydrogen-cyanide", ershArtifactId: null },
  "cyanogen-chloride-ck": { cas: ["506-77-4"], agentCodes: ["CK"], opcwClassification: "CWC Schedule 3", epaQrgArtifactId: null, ershArtifactId: null },
  "arsine-sa": { cas: ["7784-42-1"], agentCodes: ["SA"], opcwClassification: null, epaQrgArtifactId: "nrt-qrg-chemical-arsine", ershArtifactId: null },
  "phosgene-cg": { cas: ["75-44-5"], agentCodes: ["CG"], opcwClassification: "CWC Schedule 3", epaQrgArtifactId: "nrt-qrg-chemical-phosgene", ershArtifactId: "niosh-ersh-phosgene" },
  "chlorine-cl": { cas: ["7782-50-5"], agentCodes: ["CL"], opcwClassification: null, epaQrgArtifactId: "nrt-qrg-chemical-chlorine", ershArtifactId: null },
  "chloropicrin-ps": { cas: ["76-06-2"], agentCodes: ["PS"], opcwClassification: "CWC Schedule 3", epaQrgArtifactId: null, ershArtifactId: null },
});

type BiologicalIdentityFields = Omit<BiologicalIdentity, "namespace" | "canonicalBiologicalId" | "commonName" | "aliases"> & {
  namespace: BiologicalIdentity["namespace"];
};

const BIOLOGICAL_IDENTITIES: Readonly<Record<string, BiologicalIdentityFields>> = Object.freeze({
  anthrax: { namespace: "BIOLOGICAL", scientificName: "Bacillus anthracis", classification: "bacterium", taxonomy: "Bacillus anthracis", epaQrgArtifactId: "nrt-qrg-biological-anthrax" },
  plague: { namespace: "BIOLOGICAL", scientificName: "Yersinia pestis", classification: "bacterium", taxonomy: "Yersinia pestis", epaQrgArtifactId: "nrt-qrg-biological-plague" },
  tularemia: { namespace: "BIOLOGICAL", scientificName: "Francisella tularensis", classification: "bacterium", taxonomy: "Francisella tularensis", epaQrgArtifactId: "nrt-qrg-biological-tularemia" },
  smallpox: { namespace: "BIOLOGICAL", scientificName: "Variola virus", classification: "virus", taxonomy: "Orthopoxvirus variola", epaQrgArtifactId: "nrt-qrg-biological-smallpox-mpox" },
  "viral-hemorrhagic-fever": { namespace: "BIOLOGICAL", scientificName: null, classification: "viral syndrome family", taxonomy: null, epaQrgArtifactId: "nrt-qrg-biological-hemorrhagic-fever-viruses" },
  ricin: { namespace: "BIOLOGICAL_TOXIN", scientificName: null, classification: "plant toxin", taxonomy: "Ricinus communis toxin", epaQrgArtifactId: "nrt-qrg-biological-ricin-abrin" },
  abrin: { namespace: "BIOLOGICAL_TOXIN", scientificName: null, classification: "plant toxin", taxonomy: "Abrus precatorius toxin", epaQrgArtifactId: "nrt-qrg-biological-ricin-abrin" },
  "botulinum-toxin": { namespace: "BIOLOGICAL_TOXIN", scientificName: null, classification: "bacterial toxin", taxonomy: "Clostridium botulinum neurotoxin", epaQrgArtifactId: "nrt-qrg-biological-botulinum-toxin" },
  brucellosis: { namespace: "BIOLOGICAL", scientificName: "Brucella species", classification: "bacterium", taxonomy: "Brucella spp.", epaQrgArtifactId: "nrt-qrg-biological-brucellosis" },
  "q-fever": { namespace: "BIOLOGICAL", scientificName: "Coxiella burnetii", classification: "bacterium", taxonomy: "Coxiella burnetii", epaQrgArtifactId: "nrt-qrg-biological-q-fever" },
});

const SCENARIO_IDENTITIES: Readonly<Record<string, Omit<RadNuclearScenarioIdentity, "namespace" | "name">>> = Object.freeze({
  "type-a-package": { canonicalScenarioId: "scenario:transport-package:type-a", scenarioType: "TRANSPORT_PACKAGE" },
  "type-b-package": { canonicalScenarioId: "scenario:transport-package:type-b", scenarioType: "TRANSPORT_PACKAGE" },
  "radiological-dispersal-device": { canonicalScenarioId: "scenario:rdd", scenarioType: "RDD" },
  "improvised-nuclear-device": { canonicalScenarioId: "scenario:ind", scenarioType: "IND" },
});

export const CBRNE_CANONICAL_IDENTITIES: readonly CanonicalCbrneIdentity[] = Object.freeze(CBRNE_MASTER_RECORDS.map((record) => {
  const chemical = CHEMICAL_IDENTITIES[record.id];
  if (chemical) return {
    namespace: "CWA_CHEMICAL" as const,
    canonicalCbrneId: record.id,
    name: record.displayName,
    aliases: [...new Set([...record.commonNames, ...record.aliases])],
    ...chemical,
  };
  const biological = BIOLOGICAL_IDENTITIES[record.id];
  if (biological) return {
    ...biological,
    canonicalBiologicalId: `bio:${record.id}`,
    commonName: record.displayName,
    aliases: [...new Set([...record.commonNames, ...record.aliases])],
  };
  const physics = RADIONUCLIDE_PHYSICS_RECORDS.find((candidate) => candidate.canonicalRecordId === record.id);
  if (physics) return {
    namespace: "RADIONUCLIDE" as const,
    canonicalNuclideId: physics.canonicalNuclideId,
    element: physics.element,
    elementSymbol: physics.elementSymbol,
    atomicNumber: physics.atomicNumber,
    massNumber: physics.massNumber,
    metastableState: physics.metastableState,
    nndcName: physics.nndcName,
  };
  const scenario = SCENARIO_IDENTITIES[record.id];
  if (scenario) return { namespace: "RAD_NUCLEAR_SCENARIO" as const, name: record.displayName, ...scenario };
  throw new Error(`No typed canonical identity for ${record.id}`);
}));

export function findCanonicalCbrneIdentity(recordId: string) {
  return CBRNE_CANONICAL_IDENTITIES.find((identity) => (
    identity.namespace === "CWA_CHEMICAL" ? identity.canonicalCbrneId
      : identity.namespace === "RADIONUCLIDE" ? RADIONUCLIDE_PHYSICS_RECORDS.find((record) => record.canonicalNuclideId === identity.canonicalNuclideId)?.canonicalRecordId
        : identity.namespace === "RAD_NUCLEAR_SCENARIO" ? Object.entries(SCENARIO_IDENTITIES).find(([, value]) => value.canonicalScenarioId === identity.canonicalScenarioId)?.[0]
          : identity.canonicalBiologicalId.replace(/^bio:/, "")
  ) === recordId) ?? null;
}
