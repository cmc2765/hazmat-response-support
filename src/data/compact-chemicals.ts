// Compact chemical definitions — expanded into full Chemical records by the generator.
// Each line is a single chemical with the minimum fields responders need.
// The generator (generate.ts) expands these into full records with proper Zod-compatible shapes.

export interface CompactChemical {
  id: string;
  name: string;
  cas: string;
  un: string;
  hazardClass: string[];
  ergGuide: string;
  placard?: string;
  tih?: boolean;
  synonyms?: string[];
  ppe?: string[];
  reactivity?: string[];
  incompatibilities?: string[];
  firstAid?: string[];
  sdsUrl?: string;
}

// The most common hazmat materials encountered by fire departments.
// Organized by DOT hazard class for responder lookup.
export const COMPACT_CHEMICALS: CompactChemical[] = [
  // ─── Class 2.3 — Toxic gases (TIH) ────────────────────────────────────
  // (already have: ammonia, chlorine, HCl, SO2, HF, NO2, CO, phosgene, HCN, H2S, methyl bromide)

  // ─── Class 3 — Flammable liquids ──────────────────────────────────────
  // (already have: benzene, toluene, formaldehyde, acrolein, acrylonitrile, acetonitrile, CS2, acetone, methanol, ethanol, propylene oxide, epichlorohydrin)

  { id: "gasoline", name: "Gasoline", cas: "8006-61-9", un: "1203", hazardClass: ["3"], ergGuide: "128", placard: "FLAMMABLE LIQUID",
    synonyms: ["Petrol", "Motor spirit"], ppe: ["SCBA", "Flame-resistant clothing; chemical-resistant gloves"],
    reactivity: ["Highly flammable; vapor heavier than air.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "diesel-fuel", name: "Diesel fuel", cas: "68476-34-6", un: "1202", hazardClass: ["3"], ergGuide: "128",
    placard: "FLAMMABLE LIQUID", synonyms: ["Diesel oil", "Gasoil"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Combustible.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "kerosene", name: "Kerosene", cas: "8008-20-6", un: "1223", hazardClass: ["3"], ergGuide: "128",
    placard: "FLAMMABLE LIQUID", synonyms: ["Kerosine", "Paraffin oil"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Combustible.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "jet-fuel", name: "Jet fuel (Jet A/A-1)", cas: "64741-43-1", un: "1863", hazardClass: ["3"], ergGuide: "128",
    placard: "FLAMMABLE LIQUID", synonyms: ["Aviation turbine fuel", "JP-8"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Combustible.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "fuel-oil", name: "Fuel oil No. 2", cas: "68476-30-2", un: "1202", hazardClass: ["3"], ergGuide: "128",
    placard: "FLAMMABLE LIQUID", synonyms: ["Heating oil", "No. 2 oil"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Combustible.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "naphtha", name: "Naphtha (petroleum)", cas: "8030-30-6", un: "1255", hazardClass: ["3"], ergGuide: "128",
    placard: "FLAMMABLE LIQUID", synonyms: ["VM&P naphtha", "Petroleum ether"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Highly flammable.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "hexane", name: "n-Hexane", cas: "110-54-3", un: "1208", hazardClass: ["3"], ergGuide: "129",
    placard: "FLAMMABLE LIQUID", synonyms: ["Hexane", "n-Hexane"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Highly flammable.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "heptane", name: "n-Heptane", cas: "142-82-5", un: "1206", hazardClass: ["3"], ergGuide: "129",
    placard: "FLAMMABLE LIQUID", synonyms: ["Heptane"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Highly flammable.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "pentane", name: "n-Pentane", cas: "109-66-0", un: "1265", hazardClass: ["3"], ergGuide: "129",
    placard: "FLAMMABLE LIQUID", synonyms: ["Pentane"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Extremely flammable.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "octane", name: "n-Octane", cas: "111-65-9", un: "1262", hazardClass: ["3"], ergGuide: "128",
    placard: "FLAMMABLE LIQUID", synonyms: ["Octane"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Flammable.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "xylene", name: "Xylene (mixed isomers)", cas: "1330-20-7", un: "1307", hazardClass: ["3"], ergGuide: "130",
    placard: "FLAMMABLE LIQUID", synonyms: ["Xylol", "Dimethylbenzene"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Flammable.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "ethyl-benzene", name: "Ethylbenzene", cas: "100-41-4", un: "1175", hazardClass: ["3"], ergGuide: "130",
    placard: "FLAMMABLE LIQUID", synonyms: ["Ethylbenzol", "Phenylethane"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Flammable.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "styrene", name: "Styrene, stabilized", cas: "100-42-5", un: "2055", hazardClass: ["3"], ergGuide: "130P",
    placard: "FLAMMABLE LIQUID", synonyms: ["Vinylbenzene", "Phenylethene", "Cinnamene"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Flammable; polymerizes on heat/light.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers", "Heat", "Light"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "cumene", name: "Cumene", cas: "98-82-8", un: "1918", hazardClass: ["3"], ergGuide: "130",
    placard: "FLAMMABLE LIQUID", synonyms: ["Isopropylbenzene", "2-Phenylpropane"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Flammable.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "methyl-ethyl-ketone", name: "Methyl ethyl ketone", cas: "78-93-3", un: "1193", hazardClass: ["3"], ergGuide: "127",
    placard: "FLAMMABLE LIQUID", synonyms: ["MEK", "2-Butanone"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Highly flammable.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "methyl-isobutyl-ketone", name: "Methyl isobutyl ketone", cas: "108-10-1", un: "1245", hazardClass: ["3"], ergGuide: "127",
    placard: "FLAMMABLE LIQUID", synonyms: ["MIBK", "4-Methyl-2-pentanone"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Flammable.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "tetrahydrofuran", name: "Tetrahydrofuran, stabilized", cas: "109-99-9", un: "2056", hazardClass: ["3"], ergGuide: "127P",
    placard: "FLAMMABLE LIQUID", synonyms: ["THF", "1,4-Epoxybutane"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Highly flammable; forms peroxides on air.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers", "Air (peroxide formation)"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "ethyl-acetate", name: "Ethyl acetate", cas: "141-78-6", un: "1173", hazardClass: ["3"], ergGuide: "129",
    placard: "FLAMMABLE LIQUID", synonyms: ["Ethyl ethanoate", "Acetic ester"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Highly flammable.", "Reacts with strong oxidizers, acids, bases."],
    incompatibilities: ["Strong oxidizers", "Strong acids", "Strong bases"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "isopropanol", name: "Isopropanol", cas: "67-63-0", un: "1219", hazardClass: ["3"], ergGuide: "129",
    placard: "FLAMMABLE LIQUID", synonyms: ["Isopropyl alcohol", "2-Propanol", "IPA", "Rubbing alcohol"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Flammable.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "ethylene-glycol", name: "Ethylene glycol", cas: "107-21-1", un: "3082", hazardClass: ["9"], ergGuide: "171",
    synonyms: ["EG", "1,2-Ethanediol", "Monoethylene glycol", "Antifreeze"],
    ppe: ["SCBA (if heated/misting)", "Chemical-resistant gloves"], reactivity: ["Combustible.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water.", "Obtain medical evaluation if ingested."] },

  { id: "propylene-glycol", name: "Propylene glycol", cas: "57-55-6", un: "—", hazardClass: [], ergGuide: "—",
    synonyms: ["PG", "1,2-Propanediol"],
    ppe: ["Standard PPE"], reactivity: ["Low hazard.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Flush skin/eyes with water."] },

  { id: "methanol", name: "Methanol", cas: "67-56-1", un: "1230", hazardClass: ["3", "6.1"], ergGuide: "131",
    placard: "FLAMMABLE LIQUID / TOXIC", synonyms: ["Methyl alcohol", "Wood alcohol"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Highly flammable.", "Toxic by ingestion and skin absorption."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water.", "Obtain immediate medical evaluation."] },

  // ─── Class 4 — Flammable solids, spontaneously combustible, water-reactive ──
  // (already have: sodium, magnesium powder)

  { id: "lithium", name: "Lithium (metal)", cas: "7439-93-2", un: "1415", hazardClass: ["4.3"], ergGuide: "138",
    placard: "DANGEROUS WHEN WET", synonyms: ["Li metal"],
    ppe: ["Level A", "SCBA", "Class D extinguisher ONLY"],
    reactivity: ["Violent reaction with water, releasing H2.", "Burns in air."],
    incompatibilities: ["Water", "Acids", "Halogens"], firstAid: ["Brush dry; do NOT apply water.", "Obtain medical care for burns."] },

  { id: "potassium", name: "Potassium (metal)", cas: "7440-09-7", un: "1420", hazardClass: ["4.3", "4.2"], ergGuide: "138",
    placard: "DANGEROUS WHEN WET / SPONTANEOUSLY COMBUSTIBLE", synonyms: ["K metal"],
    ppe: ["Level A", "SCBA", "Class D extinguisher ONLY"],
    reactivity: ["Violent reaction with water, releasing H2.", "Self-ignites in moist air."],
    incompatibilities: ["Water", "Acids", "Halogens"], firstAid: ["Brush dry; do NOT apply water.", "Obtain medical care for burns."] },

  { id: "calcium-carbide", name: "Calcium carbide", cas: "75-20-7", un: "1402", hazardClass: ["4.3"], ergGuide: "139",
    placard: "DANGEROUS WHEN WET", synonyms: ["CaC2", "Calcium acetylide"],
    ppe: ["SCBA", "Chemical-resistant gloves"],
    reactivity: ["Reacts with water to produce acetylene gas (explosive).", "Reacts with acids."],
    incompatibilities: ["Water", "Acids"], firstAid: ["Move to fresh air.", "Flush skin with water if no residual carbide present."] },

  // ─── Class 5 — Oxidizers ──────────────────────────────────────────────
  { id: "ammonium-nitrate", name: "Ammonium nitrate", cas: "6484-52-2", un: "1942", hazardClass: ["5.1"], ergGuide: "140",
    placard: "OXIDIZER", synonyms: ["AN", "NH4NO3"],
    ppe: ["SCBA if heated or decomposing", "Chemical-resistant gloves"],
    reactivity: ["Strong oxidizer; supports combustion.", "Can detonate under confinement and high heat.", "Reacts with organic materials, fuels, chlorine."],
    incompatibilities: ["Organics", "Fuels", "Chlorine", "Heat", "Confinement"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "hydrogen-peroxide", name: "Hydrogen peroxide (≥30%)", cas: "7722-84-1", un: "2015", hazardClass: ["5.1", "8"], ergGuide: "143",
    placard: "OXIDIZER / CORROSIVE", synonyms: ["H2O2", "Peroxide"],
    ppe: ["SCBA", "Chemical-resistant gloves; face shield"],
    reactivity: ["Strong oxidizer; decomposes explosively on contact with organics and metals.", "Corrosive."],
    incompatibilities: ["Organics", "Metals", "Reducing agents", "Heat"], firstAid: ["Flush skin/eyes with copious water ≥15 min.", "Obtain medical evaluation."] },

  { id: "potassium-permanganate", name: "Potassium permanganate", cas: "7722-64-7", un: "1490", hazardClass: ["5.1"], ergGuide: "140",
    placard: "OXIDIZER", synonyms: ["KMnO4", "Congo red"],
    ppe: ["SCBA", "Chemical-resistant gloves"],
    reactivity: ["Strong oxidizer; reacts violently with organic materials.", "Reacts with acids, peroxides."],
    incompatibilities: ["Organics", "Acids", "Peroxides", "Reducing agents"], firstAid: ["Flush skin/eyes with copious water."] },

  { id: "sodium-chlorate", name: "Sodium chlorate", cas: "7775-09-9", un: "1495", hazardClass: ["5.1"], ergGuide: "140",
    placard: "OXIDIZER", synonyms: ["NaClO3"],
    ppe: ["SCBA", "Chemical-resistant gloves"],
    reactivity: ["Strong oxidizer; supports combustion.", "Can form explosive mixtures with organics."],
    incompatibilities: ["Organics", "Acids", "Metals", "Sulfur"], firstAid: ["Flush skin/eyes with water."] },

  { id: "calcium-hypochlorite", name: "Calcium hypochlorite, dry", cas: "7778-54-3", un: "1748", hazardClass: ["5.1", "8"], ergGuide: "140",
    placard: "OXIDIZER / CORROSIVE", synonyms: ["Bleaching powder", "HTH", "Ca(OCl)2"],
    ppe: ["SCBA", "Chemical-resistant gloves"],
    reactivity: ["Strong oxidizer; can ignite organics on contact.", "Reacts with acids to release chlorine gas.", "Can decompose explosively if contaminated."],
    incompatibilities: ["Organics", "Acids", "Ammonia", "Heat"], firstAid: ["Flush skin/eyes with water.", "Move to fresh air if chlorine released."] },

  // ─── Class 6 — Toxic / infectious ─────────────────────────────────────
  // (already have: HCN, methyl isocyanate, sodium cyanide, aniline, phenol, acrylonitrile)

  { id: "nitrobenzene", name: "Nitrobenzene", cas: "98-95-3", un: "1662", hazardClass: ["6.1"], ergGuide: "152",
    placard: "POISON", synonyms: ["Oil of mirbane", "Nitrobenzol"],
    ppe: ["SCBA", "Chemical-resistant gloves"],
    reactivity: ["Combustible.", "Reacts with strong oxidizers, reducing agents.", "Methemoglobinemia risk."],
    incompatibilities: ["Strong oxidizers", "Reducing agents"], firstAid: ["Move to fresh air.", "Decontaminate skin.", "Obtain medical evaluation."] },

  { id: "hydrazine", name: "Hydrazine, anhydrous", cas: "302-01-2", un: "2029", hazardClass: ["6.1", "3", "8"], ergGuide: "132",
    placard: "POISON / FLAMMABLE / CORROSIVE", synonyms: ["N2H4", "Diamine"],
    ppe: ["Level A", "SCBA", "Chemical-resistant gloves"],
    reactivity: ["Flammable; corrosive.", "Reacts violently with oxidizers, acids."],
    incompatibilities: ["Oxidizers", "Acids", "Halogens"], firstAid: ["Move to fresh air.", "Decontaminate.", "Obtain medical evaluation (suspected carcinogen)."] },

  { id: "methylhydrazine", name: "Methylhydrazine", cas: "60-34-4", un: "1244", hazardClass: ["6.1", "3"], ergGuide: "131",
    placard: "POISON / FLAMMABLE LIQUID", synonyms: ["MMH", "Monomethylhydrazine"],
    ppe: ["Level A", "SCBA"],
    reactivity: ["Highly flammable; toxic.", "Reacts violently with oxidizers."],
    incompatibilities: ["Oxidizers"], firstAid: ["Move to fresh air.", "Decontaminate.", "Obtain medical evaluation."] },

  // ─── Class 8 — Corrosives ─────────────────────────────────────────────
  // (already have: HCl, HF, H2SO4 via SO3, nitric acid, acrylic acid)

  { id: "sulfuric-acid", name: "Sulfuric acid", cas: "7664-93-9", un: "1830", hazardClass: ["8"], ergGuide: "137",
    placard: "CORROSIVE", synonyms: ["H2SO4", "Oil of vitriol", "Battery acid"],
    ppe: ["SCBA if misting", "Acid suit; chemical-resistant gloves; face shield"],
    reactivity: ["Strongly corrosive; dehydrating agent.", "Reacts violently with water (exothermic).", "Reacts with most metals, releasing H2."],
    incompatibilities: ["Water (add acid to water, never reverse)", "Metals", "Bases", "Organics"], firstAid: ["Flush skin/eyes with copious water ≥15 min.", "Remove contaminated clothing.", "Obtain medical evaluation."] },

  { id: "hydrochloric-acid", name: "Hydrochloric acid (solution)", cas: "7647-01-0", un: "1789", hazardClass: ["8"], ergGuide: "157",
    placard: "CORROSIVE", synonyms: ["Muriatic acid", "HCl solution", "Spirits of salt"],
    ppe: ["SCBA if misting", "Acid-resistant gloves; face shield"],
    reactivity: ["Strongly corrosive.", "Reacts with bases, metals (releases H2).", "Fumes in moist air."],
    incompatibilities: ["Bases", "Metals", "Oxidizers"], firstAid: ["Flush skin/eyes with copious water ≥15 min.", "Move to fresh air."] },

  { id: "phosphoric-acid", name: "Phosphoric acid", cas: "7664-38-2", un: "1805", hazardClass: ["8"], ergGuide: "154",
    placard: "CORROSIVE", synonyms: ["H3PO4", "Orthophosphoric acid"],
    ppe: ["Chemical-resistant gloves; face shield"],
    reactivity: ["Corrosive; less aggressive than HCl/H2SO4.", "Reacts with bases."],
    incompatibilities: ["Bases", "Metals"], firstAid: ["Flush skin/eyes with water."] },

  { id: "acetic-acid", name: "Acetic acid, glacial", cas: "64-19-7", un: "2790", hazardClass: ["8", "3"], ergGuide: "153",
    placard: "CORROSIVE / FLAMMABLE", synonyms: ["Ethanoic acid", "Vinegar acid (concentrated)"],
    ppe: ["SCBA", "Chemical-resistant gloves; face shield"],
    reactivity: ["Corrosive; flammable at high concentration.", "Reacts with strong oxidizers, bases."],
    incompatibilities: ["Strong oxidizers", "Bases"], firstAid: ["Flush skin/eyes with copious water."] },

  { id: "sodium-hydroxide", name: "Sodium hydroxide, solid", cas: "1310-73-2", un: "1823", hazardClass: ["8"], ergGuide: "154",
    placard: "CORROSIVE", synonyms: ["NaOH", "Caustic soda", "Lye"],
    ppe: ["SCBA if dusting", "Chemical-resistant gloves; face shield"],
    reactivity: ["Strongly corrosive.", "Dissolves in water (exothermic).", "Reacts with acids, amphoteric metals."],
    incompatibilities: ["Acids", "Metals (Al, Zn)", "Water (exothermic)"], firstAid: ["Brush dry off skin.", "Flush with water ≥15 min.", "Obtain medical evaluation."] },

  { id: "potassium-hydroxide", name: "Potassium hydroxide, solid", cas: "1310-58-3", un: "1813", hazardClass: ["8"], ergGuide: "154",
    placard: "CORROSIVE", synonyms: ["KOH", "Caustic potash"],
    ppe: ["SCBA if dusting", "Chemical-resistant gloves; face shield"],
    reactivity: ["Strongly corrosive.", "Dissolves in water (exothermic).", "Reacts with acids, metals."],
    incompatibilities: ["Acids", "Metals", "Water (exothermic)"], firstAid: ["Brush dry off skin.", "Flush with water ≥15 min."] },

  { id: "ammonium-hydroxide", name: "Ammonium hydroxide (ammonia solution)", cas: "1336-21-6", un: "2672", hazardClass: ["8"], ergGuide: "154",
    placard: "CORROSIVE", synonyms: ["Aqua ammonia", "Ammonia water", "NH4OH"],
    ppe: ["SCBA", "Chemical-resistant gloves"],
    reactivity: ["Corrosive; releases ammonia gas, especially when heated.", "Reacts with acids, halogens."],
    incompatibilities: ["Acids", "Halogens", "Hypochlorite"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water ≥15 min."] },

  // ─── Class 2.1 — Flammable gases ──────────────────────────────────────
  // (already have: CO, ethylene oxide, propylene oxide, vinyl chloride, 1,3-butadiene, LPG, butane, methane)

  { id: "propane", name: "Propane", cas: "74-98-6", un: "1978", hazardClass: ["2.1"], ergGuide: "115",
    placard: "FLAMMABLE GAS", synonyms: ["LPG (component)", "C3H8"],
    ppe: ["SCBA", "Flame-resistant clothing"],
    reactivity: ["Highly flammable gas; heavier than air.", "Forms explosive mixtures with air."],
    incompatibilities: ["Oxidizers"], firstAid: ["Move to fresh air.", "Administer oxygen if breathing difficulty."] },

  { id: "ethylene", name: "Ethylene", cas: "74-85-1", un: "1962", hazardClass: ["2.1"], ergGuide: "115",
    placard: "FLAMMABLE GAS", synonyms: ["Ethene", "C2H4"],
    ppe: ["SCBA", "Flame-resistant clothing"],
    reactivity: ["Highly flammable gas.", "Forms explosive mixtures with air."],
    incompatibilities: ["Oxidizers"], firstAid: ["Move to fresh air.", "Administer oxygen if needed."] },

  { id: "acetylene", name: "Acetylene, dissolved", cas: "74-86-2", un: "1001", hazardClass: ["2.1"], ergGuide: "116P",
    placard: "FLAMMABLE GAS", synonyms: ["Ethyne", "C2H2", "Welding gas"],
    ppe: ["SCBA", "Flame-resistant clothing"],
    reactivity: ["Extremely flammable; wide flammability range.", "Can decompose explosively at high pressure.", "Forms explosive acetylides with copper, silver."],
    incompatibilities: ["Copper", "Silver", "Mercury", "Oxidizers"], firstAid: ["Move to fresh air.", "Administer oxygen if needed."] },

  { id: "hydrogen", name: "Hydrogen, compressed", cas: "1333-74-0", un: "1049", hazardClass: ["2.1"], ergGuide: "115",
    placard: "FLAMMABLE GAS", synonyms: ["H2"],
    ppe: ["SCBA", "Flame-resistant clothing"],
    reactivity: ["Extremely flammable; very wide flammability range.", "Burns with near-invisible flame."],
    incompatibilities: ["Oxidizers", "Halogens"], firstAid: ["Move to fresh air.", "Administer oxygen if needed."] },

  { id: "propylene", name: "Propylene", cas: "115-07-1", un: "1077", hazardClass: ["2.1"], ergGuide: "115",
    placard: "FLAMMABLE GAS", synonyms: ["Propene", "C3H6"],
    ppe: ["SCBA", "Flame-resistant clothing"],
    reactivity: ["Highly flammable gas.", "Forms explosive mixtures with air."],
    incompatibilities: ["Oxidizers"], firstAid: ["Move to fresh air.", "Administer oxygen if needed."] },

  // ─── Class 2.2 — Non-flammable, non-toxic gases ───────────────────────
  { id: "nitrogen", name: "Nitrogen, compressed", cas: "7727-37-9", un: "1066", hazardClass: ["2.2"], ergGuide: "121",
    placard: "NON-FLAMMABLE GAS", synonyms: ["N2", "LIN (liquid)"],
    ppe: ["SCBA if oxygen-deficient atmosphere"],
    reactivity: ["Inert; asphyxiant at high concentrations.", "Cryogenic burns from liquid contact."],
    incompatibilities: [], firstAid: ["Move to fresh air.", "Administer oxygen if breathing difficulty.", "Treat cryogenic burns per medical protocol."] },

  { id: "oxygen", name: "Oxygen, compressed", cas: "7782-44-7", un: "1072", hazardClass: ["2.2", "5.1"], ergGuide: "122",
    placard: "OXIDIZER / NON-FLAMMABLE GAS", synonyms: ["O2", "LOX (liquid)"],
    ppe: ["Flame-resistant clothing (no oil/grease on equipment)"],
    reactivity: ["Strongly supports combustion; increases intensity of any fire.", "Oil/grease + oxygen under pressure = explosion risk."],
    incompatibilities: ["Oil", "Grease", "Combustibles", "Fuels"], firstAid: ["Administer oxygen if hypoxic (ironic but standard)."] },

  { id: "argon", name: "Argon", cas: "7440-37-1", un: "1006", hazardClass: ["2.2"], ergGuide: "121",
    placard: "NON-FLAMMABLE GAS", synonyms: ["Ar"],
    ppe: ["SCBA if oxygen-deficient atmosphere"],
    reactivity: ["Inert asphyxiant."],
    incompatibilities: [], firstAid: ["Move to fresh air.", "Administer oxygen if needed."] },

  { id: "helium", name: "Helium, compressed", cas: "7440-59-7", un: "1046", hazardClass: ["2.2"], ergGuide: "121",
    placard: "NON-FLAMMABLE GAS", synonyms: ["He"],
    ppe: ["SCBA if oxygen-deficient atmosphere"],
    reactivity: ["Inert asphyxiant."],
    incompatibilities: [], firstAid: ["Move to fresh air.", "Administer oxygen if needed."] },

  { id: "carbon-dioxide", name: "Carbon dioxide", cas: "124-38-9", un: "1013", hazardClass: ["2.2"], ergGuide: "120",
    placard: "NON-FLAMMABLE GAS", synonyms: ["CO2", "Dry ice (solid)"],
    ppe: ["SCBA if high concentration"],
    reactivity: ["Inert; asphyxiant at high concentrations.", "Dry ice causes cryogenic burns."],
    incompatibilities: [], firstAid: ["Move to fresh air.", "Administer oxygen if needed."] },

  // ─── Halogenated solvents and specialty ───────────────────────────────
  { id: "methylene-chloride", name: "Methylene chloride", cas: "75-09-2", un: "1593", hazardClass: ["6.1"], ergGuide: "160",
    placard: "POISON", synonyms: ["DCM", "Dichloromethane"],
    ppe: ["SCBA", "Chemical-resistant gloves"],
    reactivity: ["Combustible; metabolized to CO in body.", "Reacts with strong oxidizers, amines, aluminum."],
    incompatibilities: ["Strong oxidizers", "Amines", "Aluminum"], firstAid: ["Move to fresh air.", "Administer 100% O2 (CO antidote).", "Obtain medical evaluation."] },

  { id: "chloroform", name: "Chloroform", cas: "67-66-3", un: "1888", hazardClass: ["6.1"], ergGuide: "160",
    placard: "POISON", synonyms: ["Trichloromethane"],
    ppe: ["SCBA", "Chemical-resistant gloves"],
    reactivity: ["Combustible; suspected carcinogen.", "Reacts with strong bases (forms phosgene), strong oxidizers."],
    incompatibilities: ["Strong bases", "Strong oxidizers"], firstAid: ["Move to fresh air.", "Obtain medical evaluation."] },

  { id: "carbon-tetrachloride", name: "Carbon tetrachloride", cas: "56-23-5", un: "1846", hazardClass: ["6.1"], ergGuide: "160",
    placard: "POISON", synonyms: ["Tetrachloromethane", "CCl4"],
    ppe: ["SCBA", "Chemical-resistant gloves"],
    reactivity: ["Suspected carcinogen; hepatotoxic.", "Reacts with molten sodium, potassium."],
    incompatibilities: ["Sodium", "Potassium", "Strong oxidizers"], firstAid: ["Move to fresh air.", "Obtain medical evaluation."] },

  { id: "perchloroethylene", name: "Tetrachloroethylene (PCE)", cas: "127-18-4", un: "1897", hazardClass: ["6.1"], ergGuide: "160",
    placard: "POISON", synonyms: ["Perchloroethylene", "PERC", "Tetrachloroethene"],
    ppe: ["SCBA", "Chemical-resistant gloves"],
    reactivity: ["Combustible; suspected carcinogen.", "Reacts with strong oxidizers, metals at high temp."],
    incompatibilities: ["Strong oxidizers", "Metals (at high temp)"], firstAid: ["Move to fresh air.", "Obtain medical evaluation."] },

  { id: "trichloroethylene", name: "Trichloroethylene (TCE)", cas: "79-01-6", un: "1710", hazardClass: ["6.1"], ergGuide: "160",
    placard: "POISON", synonyms: ["TCE", "Trichloroethene", "Trike"],
    ppe: ["SCBA", "Chemical-resistant gloves"],
    reactivity: ["Combustible; carcinogen.", "Reacts with strong bases (forms DCAC), strong oxidizers."],
    incompatibilities: ["Strong bases", "Strong oxidizers"], firstAid: ["Move to fresh air.", "Obtain medical evaluation."] },

  // ─── Pesticides / fumigants ───────────────────────────────────────────
  { id: "chloropicrin", name: "Chloropicrin", cas: "76-06-2", un: "1580", hazardClass: ["6.1"], ergGuide: "154",
    placard: "POISON", synonyms: ["PS", "Trichloronitromethane", "Tear gas"],
    ppe: ["Level A", "SCBA", "Chemical-resistant gloves"],
    reactivity: ["Strong lachrymator; toxic.", "Reacts with strong oxidizers, reducing agents."],
    incompatibilities: ["Strong oxidizers", "Reducing agents"], firstAid: ["Move to fresh air.", "Flush eyes/skin.", "Obtain medical evaluation."] },

  // ─── Misc common industrial ────────────────────────────────────────────
  { id: "ethanolamine", name: "Ethanolamine", cas: "141-43-5", un: "2491", hazardClass: ["8"], ergGuide: "153",
    placard: "CORROSIVE", synonyms: ["MEA", "2-Aminoethanol", "Glycinol"],
    ppe: ["SCBA", "Chemical-resistant gloves; face shield"],
    reactivity: ["Corrosive.", "Reacts with acids, strong oxidizers."],
    incompatibilities: ["Acids", "Strong oxidizers"], firstAid: ["Flush skin/eyes with water."] },

  { id: "dichlorosilane", name: "Dichlorosilane", cas: "4109-96-0", un: "2189", hazardClass: ["2.3", "2.1", "8"], ergGuide: "125",
    placard: "POISON GAS / FLAMMABLE / CORROSIVE", synonyms: ["DCS", "Silane dichloride"],
    ppe: ["Level A", "SCBA"],
    reactivity: ["Water-reactive; flammable; toxic.", "Reacts violently with water, releasing HCl and hydrogen."],
    incompatibilities: ["Water", "Oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes if no DCS present.", "Obtain medical evaluation."] },

  { id: "silane", name: "Silane", cas: "7803-62-5", un: "2203", hazardClass: ["2.1"], ergGuide: "116",
    placard: "FLAMMABLE GAS", synonyms: ["Silicon tetrahydride", "SiH4"],
    ppe: ["SCBA", "Flame-resistant clothing"],
    reactivity: ["Pyrophoric; self-ignites in air.", "Reacts with water, halogens."],
    incompatibilities: ["Air", "Oxidizers", "Water"], firstAid: ["Move to fresh air.", "Administer oxygen if needed."] },

  { id: "phosphine", name: "Phosphine", cas: "7803-51-2", un: "2199", hazardClass: ["2.3", "2.1"], ergGuide: "125",
    placard: "POISON GAS / FLAMMABLE", synonyms: ["PH3", "Hydrogen phosphide"],
    ppe: ["Level A", "SCBA"],
    reactivity: ["Toxic; flammable.", "Reacts with oxidizers, halogens."],
    incompatibilities: ["Oxidizers", "Halogens"], firstAid: ["Move to fresh air.", "Administer oxygen.", "Obtain medical evaluation."] },

  { id: "bromine", name: "Bromine", cas: "7726-95-6", un: "1744", hazardClass: ["8", "6.1"], ergGuide: "154",
    placard: "CORROSIVE / POISON", synonyms: ["Br2"],
    ppe: ["Level A", "SCBA", "Chemical-resistant gloves"],
    reactivity: ["Strongly corrosive; toxic.", "Reacts violently with many organics, metals."],
    incompatibilities: ["Organics", "Metals", "Ammonia", "Reducing agents"], firstAid: ["Move to fresh air.", "Flush skin/eyes with copious water."] },

  // ─── More flammable liquids (Class 3) ────────────────────────────────
  { id: "butanol", name: "1-Butanol", cas: "71-36-3", un: "1120", hazardClass: ["3"], ergGuide: "129",
    placard: "FLAMMABLE LIQUID", synonyms: ["n-Butanol", "Butyl alcohol"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Flammable.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "isobutanol", name: "Isobutanol", cas: "78-83-1", un: "1212", hazardClass: ["3"], ergGuide: "129",
    placard: "FLAMMABLE LIQUID", synonyms: ["Isobutyl alcohol", "2-Methyl-1-propanol"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Flammable.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "butanone", name: "2-Butanone (MEK)", cas: "78-93-3", un: "1193", hazardClass: ["3"], ergGuide: "127",
    placard: "FLAMMABLE LIQUID", synonyms: ["MEK", "Methyl ethyl ketone"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Highly flammable.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "butyl-acetate", name: "n-Butyl acetate", cas: "123-86-4", un: "1123", hazardClass: ["3"], ergGuide: "129",
    placard: "FLAMMABLE LIQUID", synonyms: ["Butyl ethanoate"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Flammable.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "ethyl-cellusolve", name: "2-Ethoxyethanol", cas: "110-80-5", un: "1171", hazardClass: ["3"], ergGuide: "129",
    placard: "FLAMMABLE LIQUID", synonyms: ["Ethyl cellosolve", "EGEE"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Flammable.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "diethyl-ether", name: "Diethyl ether", cas: "60-29-7", un: "1155", hazardClass: ["3"], ergGuide: "127",
    placard: "FLAMMABLE LIQUID", synonyms: ["Ether", "Ethoxyethane", "DEE"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Extremely flammable; low flash point.", "Forms peroxides on storage.", "Vapor heavier than air."],
    incompatibilities: ["Strong oxidizers", "Air (peroxide)"], firstAid: ["Move to fresh air.", "Administer oxygen if needed."] },

  { id: "gas-oil", name: "Gas oil", cas: "68476-30-2", un: "1202", hazardClass: ["3"], ergGuide: "128",
    placard: "FLAMMABLE LIQUID", synonyms: ["Cracked gas oil"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Combustible.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "alkylbenzene", name: "Alkylbenzene sulfonic acid", cas: "68584-22-5", un: "2586", hazardClass: ["8"], ergGuide: "153",
    placard: "CORROSIVE", synonyms: ["LABSA", "Linear alkylbenzene sulfonate"],
    ppe: ["SCBA", "Chemical-resistant gloves; face shield"], reactivity: ["Corrosive.", "Reacts with bases, oxidizers."],
    incompatibilities: ["Bases", "Oxidizers"], firstAid: ["Flush skin/eyes with copious water."] },

  { id: "crude-oil", name: "Crude petroleum", cas: "8002-05-9", un: "1267", hazardClass: ["3"], ergGuide: "128",
    placard: "FLAMMABLE LIQUID", synonyms: ["Crude oil", "Rock oil", "Petroleum crude"],
    ppe: ["SCBA", "Flame-resistant clothing; chemical-resistant gloves"], reactivity: ["Highly flammable; variable composition.", "Contains H2S in some grades.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water.", "Monitor for H2S exposure."] },

  { id: "natural-gas-condensate", name: "Natural gas condensate", cas: "64741-47-5", un: "1268", hazardClass: ["3"], ergGuide: "128",
    placard: "FLAMMABLE LIQUID", synonyms: ["Gas condensate", "NGC"],
    ppe: ["SCBA", "Flame-resistant clothing"], reactivity: ["Highly flammable.", "May contain H2S.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Monitor for H2S exposure."] },

  { id: "n-butane-liquid", name: "Butane (liquid)", cas: "106-97-8", un: "1011", hazardClass: ["2.1"], ergGuide: "115",
    placard: "FLAMMABLE GAS", synonyms: ["n-Butane", "C4H10"],
    ppe: ["SCBA", "Flame-resistant clothing"], reactivity: ["Highly flammable gas.", "Heavier than air; pools in low areas."],
    incompatibilities: ["Oxidizers"], firstAid: ["Move to fresh air.", "Administer oxygen if needed."] },

  { id: "isobutane", name: "Isobutane", cas: "75-28-5", un: "1969", hazardClass: ["2.1"], ergGuide: "115",
    placard: "FLAMMABLE GAS", synonyms: ["i-Butane", "2-Methylpropane"],
    ppe: ["SCBA", "Flame-resistant clothing"], reactivity: ["Highly flammable gas."],
    incompatibilities: ["Oxidizers"], firstAid: ["Move to fresh air.", "Administer oxygen if needed."] },

  { id: "isobutylene", name: "Isobutylene", cas: "115-11-7", un: "1055", hazardClass: ["2.1"], ergGuide: "115",
    placard: "FLAMMABLE GAS", synonyms: ["2-Methylpropene", "Isobutene"],
    ppe: ["SCBA", "Flame-resistant clothing"], reactivity: ["Highly flammable gas.", "Can polymerize."],
    incompatibilities: ["Oxidizers"], firstAid: ["Move to fresh air.", "Administer oxygen if needed."] },

  // ─── More acids and bases (Class 8) ──────────────────────────────────
  { id: "hydrobromic-acid", name: "Hydrobromic acid", cas: "10035-10-6", un: "1788", hazardClass: ["8"], ergGuide: "157",
    placard: "CORROSIVE", synonyms: ["HBr solution"],
    ppe: ["SCBA if misting", "Acid-resistant gloves; face shield"], reactivity: ["Strongly corrosive.", "Reacts with bases, metals, oxidizers."],
    incompatibilities: ["Bases", "Metals", "Oxidizers"], firstAid: ["Flush skin/eyes with copious water."] },

  { id: "hydrofluoric-acid", name: "Hydrofluoric acid (solution)", cas: "7664-39-3", un: "1790", hazardClass: ["8", "6.1"], ergGuide: "157",
    placard: "CORROSIVE / POISON", synonyms: ["HF acid"],
    ppe: ["Level A", "SCBA", "Specialty HF-resistant gloves (calcium gluconate on hand)"],
    reactivity: ["Extremely corrosive; penetrates skin deeply.", "Dissolves glass.", "Systemic toxicity via skin absorption."],
    incompatibilities: ["Glass", "Metals", "Bases", "Water (exothermic with anhydrous)"], firstAid: ["Flush skin/eyes with copious water ≥30 min.", "Apply calcium gluconate gel.", "Obtain immediate medical care."] },

  { id: "chromic-acid", name: "Chromic acid", cas: "7738-94-5", un: "1755", hazardClass: ["8", "5.1", "6.1"], ergGuide: "141",
    placard: "CORROSIVE / OXIDIZER / POISON", synonyms: ["Chromic(VI) acid", "H2CrO4"],
    ppe: ["Level A", "SCBA", "Chemical-resistant gloves"],
    reactivity: ["Strongly corrosive; strong oxidizer.", "Reacts with organics (can ignite).", "Carcinogen (Cr(VI))."],
    incompatibilities: ["Organics", "Reducing agents", "Metals"], firstAid: ["Flush skin/eyes with copious water.", "Obtain medical evaluation."] },

  { id: "perchloric-acid", name: "Perchloric acid", cas: "7601-90-3", un: "1873", hazardClass: ["8", "5.1"], ergGuide: "143",
    placard: "CORROSIVE / OXIDIZER", synonyms: ["HClO4"],
    ppe: ["SCBA", "Acid-resistant gloves; face shield"],
    reactivity: ["Extremely powerful oxidizer.", "Can form explosive mixtures with organics.", "Reacts violently with metals, reducing agents."],
    incompatibilities: ["Organics", "Metals", "Reducing agents", "Dehydrating agents"], firstAid: ["Flush skin/eyes with copious water."] },

  { id: "oleum", name: "Oleum (fuming sulfuric acid)", cas: "8014-95-7", un: "1831", hazardClass: ["8", "6.1"], ergGuide: "137",
    placard: "CORROSIVE / POISON", synonyms: ["Fuming sulfuric acid", "H2SO4+SO3"],
    ppe: ["Level A", "SCBA", "Acid suit; face shield"],
    reactivity: ["Extremely corrosive; releases SO3 fumes.", "Reacts violently with water (exothermic).", "Reacts with most metals."],
    incompatibilities: ["Water", "Metals", "Bases", "Organics"], firstAid: ["Flush skin/eyes with copious water ≥15 min.", "Obtain medical evaluation."] },

  { id: "formic-acid", name: "Formic acid", cas: "64-18-6", un: "1779", hazardClass: ["8", "3"], ergGuide: "153",
    placard: "CORROSIVE / FLAMMABLE", synonyms: ["Methanoic acid", "HCOOH"],
    ppe: ["SCBA", "Chemical-resistant gloves; face shield"], reactivity: ["Corrosive; flammable at high conc.", "Reacts with strong oxidizers, bases."],
    incompatibilities: ["Strong oxidizers", "Bases"], firstAid: ["Flush skin/eyes with copious water."] },

  { id: "propionic-acid", name: "Propionic acid", cas: "79-09-4", un: "1848", hazardClass: ["8", "3"], ergGuide: "132",
    placard: "CORROSIVE / FLAMMABLE", synonyms: ["Propanoic acid", "Ethylformic acid"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Corrosive; flammable.", "Reacts with strong oxidizers, bases."],
    incompatibilities: ["Strong oxidizers", "Bases"], firstAid: ["Flush skin/eyes with water."] },

  { id: "oxalic-acid", name: "Oxalic acid", cas: "144-62-7", un: "—", hazardClass: [], ergGuide: "—",
    synonyms: ["Ethanedioic acid"],
    ppe: ["Chemical-resistant gloves"], reactivity: ["Toxic by ingestion.", "Reacts with oxidizers, bases."],
    incompatibilities: ["Strong oxidizers", "Bases"], firstAid: ["Flush skin/eyes with water.", "Obtain medical evaluation if ingested."] },

  { id: "ferric-chloride", name: "Ferric chloride solution", cas: "7705-08-0", un: "2582", hazardClass: ["8"], ergGuide: "154",
    placard: "CORROSIVE", synonyms: ["Iron(III) chloride", "FeCl3"],
    ppe: ["Chemical-resistant gloves; face shield"], reactivity: ["Corrosive.", "Reacts with strong bases, metals."],
    incompatibilities: ["Strong bases", "Metals"], firstAid: ["Flush skin/eyes with water."] },

  { id: "aluminum-chloride", name: "Aluminum chloride, anhydrous", cas: "7446-70-0", un: "1726", hazardClass: ["8"], ergGuide: "157",
    placard: "CORROSIVE", synonyms: ["AlCl3", "Aluminum trichloride"],
    ppe: ["SCBA if dusting", "Chemical-resistant gloves"], reactivity: ["Water-reactive; releases HCl on contact with moisture.", "Corrosive."],
    incompatibilities: ["Water", "Bases", "Metals"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "ferric-sulfate", name: "Ferric sulfate", cas: "10028-22-5", un: "—", hazardClass: ["8"], ergGuide: "154",
    synonyms: ["Iron(III) sulfate"],
    ppe: ["Chemical-resistant gloves"], reactivity: ["Corrosive in solution.", "Reacts with strong bases."],
    incompatibilities: ["Strong bases"], firstAid: ["Flush skin/eyes with water."] },

  // ─── Cryogens and refrigerants ──────────────────────────────────────
  { id: "lng", name: "Liquefied natural gas (LNG)", cas: "8006-14-2", un: "1972", hazardClass: ["2.1"], ergGuide: "115",
    placard: "FLAMMABLE GAS", synonyms: ["LNG", "Methane (refrigerated liquid)"],
    ppe: ["SCBA", "Flame-resistant clothing; cryogenic PPE"],
    reactivity: ["Extremely flammable; boils to methane gas.", "Cryogenic burns.", "Vapor cloud can travel far before igniting."],
    incompatibilities: ["Oxidizers"], firstAid: ["Move to fresh air.", "Treat cryogenic burns.", "Administer oxygen if needed."] },

  { id: "ethylene-oxide-mixture", name: "Ethylene oxide mixture", cas: "75-21-8", un: "1955", hazardClass: ["2.3", "2.1"], ergGuide: "119P",
    placard: "POISON GAS / FLAMMABLE", synonyms: ["EO mixture", "EtO mixture"],
    ppe: ["Level A", "SCBA"], reactivity: ["Flammable; toxic; carcinogen.", "Polymerizes; can decompose explosively."],
    incompatibilities: ["Heat", "Light", "Acids", "Bases"], firstAid: ["Move to fresh air.", "Administer oxygen.", "Obtain medical evaluation."] },

  { id: "ammonia-solution-conc", name: "Ammonia solution (≥35%)", cas: "1336-21-6", un: "2073", hazardClass: ["2.3", "8"], ergGuide: "125",
    placard: "POISON GAS / CORROSIVE", synonyms: ["Concentrated aqua ammonia"],
    ppe: ["Level A", "SCBA", "Chemical-resistant gloves"],
    reactivity: ["Releases large amounts of ammonia gas.", "Corrosive.", "Reacts with acids, halogens."],
    incompatibilities: ["Acids", "Halogens", "Hypochlorite"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water ≥15 min."] },

  // ─── More solvents and intermediates ────────────────────────────────
  { id: "dioxane", name: "1,4-Dioxane", cas: "123-91-1", un: "1165", hazardClass: ["3"], ergGuide: "127",
    placard: "FLAMMABLE LIQUID", synonyms: ["Dioxane", "p-Dioxane", "1,4-Diethylene oxide"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Flammable; forms peroxides on storage.", "Suspected carcinogen.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers", "Air (peroxide)"], firstAid: ["Move to fresh air.", "Obtain medical evaluation."] },

  { id: "cellosolve", name: "2-Methoxyethanol", cas: "109-86-4", un: "1188", hazardClass: ["3"], ergGuide: "129",
    placard: "FLAMMABLE LIQUID", synonyms: ["Methyl cellosolve", "EGME"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Flammable.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "dimethylformamide", name: "N,N-Dimethylformamide", cas: "68-12-2", un: "2265", hazardClass: ["3", "6.1"], ergGuide: "131",
    placard: "FLAMMABLE LIQUID / POISON", synonyms: ["DMF", "DMFA"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Flammable; toxic.", "Reacts with strong oxidizers, bases, halogens."],
    incompatibilities: ["Strong oxidizers", "Bases", "Halogens"], firstAid: ["Move to fresh air.", "Decontaminate.", "Obtain medical evaluation."] },

  { id: "dimethyl-sulfoxide", name: "Dimethyl sulfoxide", cas: "67-68-5", un: "—", hazardClass: [], ergGuide: "—",
    synonyms: ["DMSO"],
    ppe: ["Chemical-resistant gloves"], reactivity: ["Low hazard itself but carries dissolved chemicals through skin.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Flush skin/eyes with water."] },

  { id: "pyridine", name: "Pyridine", cas: "110-86-1", un: "1282", hazardClass: ["3"], ergGuide: "129",
    placard: "FLAMMABLE LIQUID", synonyms: ["Azine"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Flammable.", "Reacts with strong oxidizers, acids."],
    incompatibilities: ["Strong oxidizers", "Acids"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "aniline-oil", name: "Aniline oil (recovered)", cas: "62-53-3", un: "1547", hazardClass: ["6.1"], ergGuide: "153",
    placard: "POISON", synonyms: ["Aniline (technical grade)"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Combustible.", "Methemoglobinemia risk."],
    incompatibilities: ["Strong oxidizers", "Acids"], firstAid: ["Move to fresh air.", "Decontaminate.", "Obtain medical evaluation."] },

  { id: "cresol", name: "Cresol (mixed isomers)", cas: "1319-77-3", un: "2076", hazardClass: ["6.1", "8"], ergGuide: "153",
    placard: "POISON / CORROSIVE", synonyms: ["Cresylic acid", "Methylphenol"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Combustible; corrosive.", "Systemic toxicity via skin."],
    incompatibilities: ["Strong oxidizers", "Bases"], firstAid: ["Flush skin/eyes with copious water.", "Obtain medical evaluation."] },

  { id: "naphthalene", name: "Naphthalene", cas: "91-20-3", un: "1334", hazardClass: ["4.1"], ergGuide: "133",
    placard: "FLAMMABLE SOLID", synonyms: ["Moth balls", "Tar camphor"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Flammable solid; sublimes at room temp.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "nitrotoluene", name: "Nitrotoluene (mixed isomers)", cas: "1321-12-6", un: "1664", hazardClass: ["6.1"], ergGuide: "152",
    placard: "POISON", synonyms: ["MNT", "Nitrotoluenes"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Toxic; combustible.", "Can detonate under strong heating."],
    incompatibilities: ["Strong oxidizers", "Reducing agents", "Heat"], firstAid: ["Move to fresh air.", "Decontaminate.", "Obtain medical evaluation."] },

  { id: "dinitrobenzene", name: "Dinitrobenzene", cas: "25154-54-5", un: "1597", hazardClass: ["6.1"], ergGuide: "152",
    placard: "POISON", synonyms: ["DNB"],
    ppe: ["Level A", "SCBA"], reactivity: ["Toxic; can detonate when heated.", "Reacts with reducing agents."],
    incompatibilities: ["Reducing agents", "Heat"], firstAid: ["Move to fresh air.", "Decontaminate.", "Obtain immediate medical evaluation."] },

  { id: "ammonium-sulfate", name: "Ammonium sulfate", cas: "7783-20-2", un: "—", hazardClass: [], ergGuide: "—",
    synonyms: ["(NH4)2SO4", "Sulfuric acid diammonium salt"],
    ppe: ["Chemical-resistant gloves"], reactivity: ["Low hazard.", "Releases ammonia at high pH."],
    incompatibilities: ["Strong bases", "Hypochlorite"], firstAid: ["Flush skin/eyes with water."] },

  { id: "sodium-hypochlorite", name: "Sodium hypochlorite solution", cas: "7681-52-9", un: "1791", hazardClass: ["8"], ergGuide: "154",
    placard: "CORROSIVE", synonyms: ["Bleach", "NaOCl"],
    ppe: ["SCBA if misting", "Chemical-resistant gloves; face shield"],
    reactivity: ["Oxidizer; corrosive.", "Reacts with ammonia to form chloramine gas.", "Reacts with acids to release chlorine gas."],
    incompatibilities: ["Acids", "Ammonia", "Reducing agents", "Organics"], firstAid: ["Flush skin/eyes with copious water.", "Move to fresh air if chlorine/chloramine released."] },

  { id: "calcium-chloride", name: "Calcium chloride", cas: "10043-52-4", un: "—", hazardClass: [], ergGuide: "—",
    synonyms: ["CaCl2"],
    ppe: ["Chemical-resistant gloves"], reactivity: ["Low hazard; hygroscopic.", "Dissolves exothermically in water."],
    incompatibilities: ["Water (exothermic)"], firstAid: ["Flush skin/eyes with water."] },

  { id: "magnesium-chloride", name: "Magnesium chloride", cas: "7786-30-3", un: "—", hazardClass: [], ergGuide: "—",
    synonyms: ["MgCl2"],
    ppe: ["Chemical-resistant gloves"], reactivity: ["Low hazard; hygroscopic."],
    incompatibilities: [], firstAid: ["Flush skin/eyes with water."] },

  { id: "sodium-carbonate", name: "Sodium carbonate", cas: "497-19-8", un: "—", hazardClass: [], ergGuide: "—",
    synonyms: ["Soda ash", "Washing soda", "Na2CO3"],
    ppe: ["Chemical-resistant gloves"], reactivity: ["Mild alkali.", "Reacts with acids."],
    incompatibilities: ["Acids"], firstAid: ["Flush skin/eyes with water."] },

  { id: "sodium-bicarbonate", name: "Sodium bicarbonate", cas: "144-55-8", un: "—", hazardClass: [], ergGuide: "—",
    synonyms: ["Baking soda", "NaHCO3"],
    ppe: ["Chemical-resistant gloves"], reactivity: ["Very low hazard."],
    incompatibilities: ["Acids"], firstAid: ["Flush skin/eyes with water."] },

  { id: "urea", name: "Urea", cas: "57-13-6", un: "—", hazardClass: [], ergGuide: "—",
    synonyms: ["Carbamide", "H2NCONH2"],
    ppe: ["Chemical-resistant gloves"], reactivity: ["Low hazard.", "Decomposes to ammonia at high temp."],
    incompatibilities: ["Strong oxidizers", "Nitrites"], firstAid: ["Flush skin/eyes with water."] },

  { id: "ethylene-diamine", name: "Ethylenediamine", cas: "107-15-3", un: "1604", hazardClass: ["8", "3"], ergGuide: "132",
    placard: "CORROSIVE / FLAMMABLE", synonyms: ["EDA", "1,2-Diaminoethane"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Corrosive; flammable.", "Strong sensitizer.", "Reacts with acids, oxidizers."],
    incompatibilities: ["Acids", "Oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "diethylenetriamine", name: "Diethylenetriamine", cas: "111-40-0", un: "2079", hazardClass: ["8"], ergGuide: "153",
    placard: "CORROSIVE", synonyms: ["DETA"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Corrosive; sensitizer.", "Reacts with acids, oxidizers."],
    incompatibilities: ["Acids", "Oxidizers"], firstAid: ["Flush skin/eyes with water."] },

  { id: "triethylamine", name: "Triethylamine", cas: "121-44-8", un: "1296", hazardClass: ["3", "8"], ergGuide: "132",
    placard: "FLAMMABLE LIQUID / CORROSIVE", synonyms: ["TEA", "Et3N"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Flammable; corrosive.", "Strong fishy odor."],
    incompatibilities: ["Strong oxidizers", "Acids"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "morpholine", name: "Morpholine", cas: "110-91-8", un: "2054", hazardClass: ["3", "8"], ergGuide: "132",
    placard: "FLAMMABLE LIQUID / CORROSIVE", synonyms: ["Tetrahydro-1,4-oxazine"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Flammable; corrosive.", "Reacts with acids, oxidizers."],
    incompatibilities: ["Acids", "Oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "diethanolamine", name: "Diethanolamine", cas: "111-42-2", un: "—", hazardClass: ["8"], ergGuide: "153",
    synonyms: ["DEA"],
    ppe: ["Chemical-resistant gloves; face shield"], reactivity: ["Corrosive; sensitiser.", "Reacts with acids, oxidizers."],
    incompatibilities: ["Acids", "Oxidizers"], firstAid: ["Flush skin/eyes with water."] },

  { id: "triethanolamine", name: "Triethanolamine", cas: "102-71-6", un: "—", hazardClass: [], ergGuide: "—",
    synonyms: ["TEA", "TELA"],
    ppe: ["Chemical-resistant gloves"], reactivity: ["Low hazard.", "Reacts with strong oxidizers, acids."],
    incompatibilities: ["Strong oxidizers", "Acids"], firstAid: ["Flush skin/eyes with water."] },

  { id: "styrene-monomer", name: "Styrene monomer, stabilized", cas: "100-42-5", un: "2055", hazardClass: ["3"], ergGuide: "130P",
    placard: "FLAMMABLE LIQUID", synonyms: ["Vinylbenzene"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Flammable; polymerizes.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers", "Heat", "Light"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "acetic-anhydride", name: "Acetic anhydride", cas: "108-24-7", un: "1715", hazardClass: ["8", "3"], ergGuide: "137",
    placard: "CORROSIVE / FLAMMABLE", synonyms: ["Ethanoic anhydride", "Ac2O"],
    ppe: ["SCBA", "Chemical-resistant gloves; face shield"], reactivity: ["Corrosive; flammable.", "Reacts violently with water, alcohols, strong oxidizers."],
    incompatibilities: ["Water", "Alcohols", "Strong oxidizers", "Bases"], firstAid: ["Flush skin/eyes with copious water."] },

  { id: "propionaldehyde", name: "Propionaldehyde", cas: "123-38-6", un: "1275", hazardClass: ["3"], ergGuide: "129",
    placard: "FLAMMABLE LIQUID", synonyms: ["Propanal", "Propyl aldehyde"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Highly flammable.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "butyraldehyde", name: "n-Butyraldehyde", cas: "123-72-8", un: "1129", hazardClass: ["3"], ergGuide: "129",
    placard: "FLAMMABLE LIQUID", synonyms: ["Butanal", "Butyric aldehyde"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Highly flammable.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "methyl-tert-butyl-ether", name: "Methyl tert-butyl ether", cas: "1634-04-4", un: "2398", hazardClass: ["3"], ergGuide: "127",
    placard: "FLAMMABLE LIQUID", synonyms: ["MTBE"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Highly flammable.", "Can form peroxides."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "dimethyl-ether", name: "Dimethyl ether", cas: "115-10-6", un: "1033", hazardClass: ["2.1"], ergGuide: "115",
    placard: "FLAMMABLE GAS", synonyms: ["DME", "Methyl ether"],
    ppe: ["SCBA", "Flame-resistant clothing"], reactivity: ["Highly flammable gas."],
    incompatibilities: ["Oxidizers"], firstAid: ["Move to fresh air.", "Administer oxygen if needed."] },

  { id: "cyclohexane", name: "Cyclohexane", cas: "110-82-7", un: "1145", hazardClass: ["3"], ergGuide: "128",
    placard: "FLAMMABLE LIQUID", synonyms: ["Hexamethylene", "Cyclohexylene"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Highly flammable.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "cyclohexanone", name: "Cyclohexanone", cas: "108-94-1", un: "1915", hazardClass: ["3"], ergGuide: "127",
    placard: "FLAMMABLE LIQUID", synonyms: ["Pimelic ketone", "Ketohexamethylene"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Flammable.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "cyclohexanol", name: "Cyclohexanol", cas: "108-93-0", un: "—", hazardClass: ["9"], ergGuide: "—",
    synonyms: ["Hexahydrophenol"],
    ppe: ["Chemical-resistant gloves"], reactivity: ["Combustible.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Flush skin/eyes with water."] },

  { id: "cresylic-acid", name: "Cresylic acid (cresols)", cas: "1319-77-3", un: "2076", hazardClass: ["6.1", "8"], ergGuide: "153",
    placard: "POISON / CORROSIVE", synonyms: ["Cresol mixture", "Tricresol"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Combustible; corrosive.", "Systemic toxicity."],
    incompatibilities: ["Strong oxidizers", "Bases"], firstAid: ["Flush skin/eyes with copious water.", "Obtain medical evaluation."] },

  { id: "ammonium-phosphate", name: "Ammonium phosphate, dibasic", cas: "7783-28-0", un: "—", hazardClass: [], ergGuide: "—",
    synonyms: ["DAP"],
    ppe: ["Chemical-resistant gloves"], reactivity: ["Low hazard.", "Releases ammonia at high pH."],
    incompatibilities: ["Strong bases"], firstAid: ["Flush skin/eyes with water."] },

  { id: "potassium-hydroxide-solution", name: "Potassium hydroxide solution", cas: "1310-58-3", un: "1814", hazardClass: ["8"], ergGuide: "154",
    placard: "CORROSIVE", synonyms: ["KOH solution", "Caustic potash solution"],
    ppe: ["SCBA if misting", "Chemical-resistant gloves; face shield"],
    reactivity: ["Strongly corrosive.", "Reacts with acids, amphoteric metals."],
    incompatibilities: ["Acids", "Metals", "Water (exothermic)"], firstAid: ["Flush with copious water ≥15 min."] },

  { id: "sodium-hydroxide-solution", name: "Sodium hydroxide solution", cas: "1310-73-2", un: "1824", hazardClass: ["8"], ergGuide: "154",
    placard: "CORROSIVE", synonyms: ["NaOH solution", "Caustic soda solution", "Lye solution"],
    ppe: ["SCBA if misting", "Chemical-resistant gloves; face shield"],
    reactivity: ["Strongly corrosive.", "Reacts with acids, metals (releases H2)."],
    incompatibilities: ["Acids", "Metals"], firstAid: ["Flush with copious water ≥15 min."] },

  { id: "sulfuric-acid-solution", name: "Sulfuric acid (solution, <51%)", cas: "7664-93-9", un: "2796", hazardClass: ["8"], ergGuide: "153",
    placard: "CORROSIVE", synonyms: ["Battery acid", "Dilute H2SO4"],
    ppe: ["SCBA if misting", "Acid-resistant gloves; face shield"],
    reactivity: ["Corrosive.", "Reacts with bases, metals.", "Dilution is exothermic."],
    incompatibilities: ["Bases", "Metals", "Water (always add acid to water)"], firstAid: ["Flush skin/eyes with copious water."] },

  { id: "hydrogen-chloride-solution", name: "Hydrochloric acid (solution, >25%)", cas: "7647-01-0", un: "1789", hazardClass: ["8"], ergGuide: "157",
    placard: "CORROSIVE", synonyms: ["Muriatic acid"],
    ppe: ["SCBA if misting", "Acid-resistant gloves; face shield"],
    reactivity: ["Corrosive; fumes in moist air.", "Reacts with bases, metals."],
    incompatibilities: ["Bases", "Metals", "Oxidizers"], firstAid: ["Flush skin/eyes with copious water.", "Move to fresh air."] },

  { id: "nitric-acid-red-fuming", name: "Nitric acid, red fuming", cas: "7697-37-2", un: "2032", hazardClass: ["8", "5.1", "6.1"], ergGuide: "157",
    placard: "CORROSIVE / OXIDIZER / POISON", synonyms: ["RFNA", "White fuming nitric acid (WFNA)"],
    ppe: ["Level A", "SCBA", "Acid suit"],
    reactivity: ["Extremely corrosive; strong oxidizer.", "Releases NO2 fumes.", "Can ignite organics on contact."],
    incompatibilities: ["Organics", "Metals", "Bases", "Reducing agents"], firstAid: ["Flush skin/eyes with copious water.", "Move to fresh air.", "Obtain medical evaluation."] },

  { id: "adiponitrile", name: "Adiponitrile", cas: "111-69-3", un: "2205", hazardClass: ["6.1"], ergGuide: "153",
    placard: "POISON", synonyms: ["ADN", "1,4-Dicyanobutane", "Hexanedinitrile"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Toxic; combustible.", "Reacts with strong oxidizers, strong acids."],
    incompatibilities: ["Strong oxidizers", "Strong acids"], firstAid: ["Move to fresh air.", "Decontaminate.", "Obtain medical evaluation (cyanide metabolite)."] },

  { id: "acetonitrile-hplc", name: "Acetonitrile (HPLC grade)", cas: "75-05-8", un: "1648", hazardClass: ["3"], ergGuide: "127",
    placard: "FLAMMABLE LIQUID", synonyms: ["MeCN (HPLC)", "Methyl cyanide (HPLC)"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Highly flammable.", "Reacts with strong acids, bases, oxidizers."],
    incompatibilities: ["Strong acids", "Strong bases", "Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "sodium-chloride", name: "Sodium chloride", cas: "7647-14-7", un: "—", hazardClass: [], ergGuide: "—",
    synonyms: ["NaCl", "Salt", "Brine salt"],
    ppe: ["Standard PPE"], reactivity: ["Very low hazard.", "Reacts with strong acids at high temp."],
    incompatibilities: ["Strong acids (at high temp)"], firstAid: ["Flush skin/eyes with water."] },

  { id: "hydrogen-bromide", name: "Hydrogen bromide, anhydrous", cas: "10035-10-6", un: "1040", hazardClass: ["2.3", "8"], ergGuide: "125",
    placard: "POISON GAS / CORROSIVE", synonyms: ["Anhydrous HBr"],
    ppe: ["Level A", "SCBA", "Chemical-resistant gloves"],
    reactivity: ["Toxic; corrosive.", "Reacts with water to form hydrobromic acid.", "Reacts with bases, metals."],
    incompatibilities: ["Water", "Bases", "Metals", "Oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "cyanogen", name: "Cyanogen", cas: "460-19-5", un: "1026", hazardClass: ["2.3", "2.1"], ergGuide: "119",
    placard: "POISON GAS / FLAMMABLE GAS", synonyms: ["Oxalic acid dinitrile", "(CN)2"],
    ppe: ["Level A", "SCBA"], reactivity: ["Toxic; flammable.", "Burns to produce CO and N2."],
    incompatibilities: ["Oxidizers", "Halogens"], firstAid: ["Move to fresh air.", "Administer 100% O2.", "Cyanide protocol."] },

  { id: "cyanogen-chloride", name: "Cyanogen chloride", cas: "506-77-4", un: "1589", hazardClass: ["2.3", "8"], ergGuide: "125",
    placard: "POISON GAS / CORROSIVE", synonyms: ["CK", "Chlorine cyanide"],
    ppe: ["Level A", "SCBA"], reactivity: ["Toxic; military chemical agent (CK).", "Reacts with water, bases."],
    incompatibilities: ["Water", "Bases", "Oxidizers"], firstAid: ["Move to fresh air.", "Administer 100% O2.", "Cyanide protocol."] },

  { id: "arsine", name: "Arsine", cas: "7784-42-1", un: "2188", hazardClass: ["2.3", "2.2"], ergGuide: "119",
    placard: "POISON GAS", synonyms: ["Arseniuretted hydrogen", "AsH3"],
    ppe: ["Level A", "SCBA"], reactivity: ["Highly toxic; hemolytic agent.", "Flammable at high concentrations."],
    incompatibilities: ["Oxidizers", "Halogens"], firstAid: ["Move to fresh air.", "Administer 100% O2.", "Obtain immediate medical evaluation."] },

  { id: "germane", name: "Germane", cas: "7782-65-2", un: "2192", hazardClass: ["2.3", "2.1"], ergGuide: "119",
    placard: "POISON GAS / FLAMMABLE", synonyms: ["Germanium tetrahydride", "GeH4"],
    ppe: ["Level A", "SCBA"], reactivity: ["Toxic; flammable."],
    incompatibilities: ["Oxidizers"], firstAid: ["Move to fresh air.", "Administer oxygen."] },

  { id: "diborane", name: "Diborane", cas: "19287-45-7", un: "1911", hazardClass: ["2.3", "2.1"], ergGuide: "119",
    placard: "POISON GAS / FLAMMABLE", synonyms: ["B2H6", "Boroethane"],
    ppe: ["Level A", "SCBA"], reactivity: ["Toxic; pyrophoric in some conditions.", "Reacts with water, halogens."],
    incompatibilities: ["Oxidizers", "Water", "Halogens"], firstAid: ["Move to fresh air.", "Administer oxygen."] },

  { id: "nitric-oxide", name: "Nitric oxide", cas: "10102-43-9", un: "1660", hazardClass: ["2.3", "5.1"], ergGuide: "124",
    placard: "POISON GAS / OXIDIZER", synonyms: ["NO", "Nitrogen monoxide"],
    ppe: ["Level A", "SCBA"], reactivity: ["Toxic; oxidizer.", "Converts to NO2 in air."],
    incompatibilities: ["Oxidizable materials", "Combustibles"], firstAid: ["Move to fresh air.", "Administer oxygen."] },

  { id: "sulfuryl-chloride", name: "Sulfuryl chloride", cas: "7791-25-5", un: "1834", hazardClass: ["8"], ergGuide: "137",
    placard: "CORROSIVE", synonyms: ["SO2Cl2"],
    ppe: ["SCBA", "Chemical-resistant gloves; face shield"], reactivity: ["Corrosive; water-reactive.", "Reacts with water to form HCl + H2SO4."],
    incompatibilities: ["Water", "Bases", "Metals"], firstAid: ["Flush skin/eyes with copious water.", "Move to fresh air."] },

  { id: "thionyl-chloride", name: "Thionyl chloride", cas: "7719-09-7", un: "1836", hazardClass: ["8"], ergGuide: "137",
    placard: "CORROSIVE", synonyms: ["SOCl2", "Sulfurous oxychloride"],
    ppe: ["SCBA", "Chemical-resistant gloves; face shield"], reactivity: ["Corrosive; water-reactive.", "Reacts violently with water to form HCl + SO2."],
    incompatibilities: ["Water", "Bases", "Metals"], firstAid: ["Flush skin/eyes with copious water.", "Move to fresh air."] },

  { id: "phosphorus-trichloride", name: "Phosphorus trichloride", cas: "7719-12-2", un: "1809", hazardClass: ["8", "6.1"], ergGuide: "137",
    placard: "CORROSIVE / POISON", synonyms: ["PCl3", "Phosphorous chloride"],
    ppe: ["SCBA", "Chemical-resistant gloves; face shield"], reactivity: ["Corrosive; water-reactive.", "Reacts violently with water to form HCl + H3PO3."],
    incompatibilities: ["Water", "Bases", "Metals", "Oxidizers"], firstAid: ["Flush skin/eyes with copious water.", "Move to fresh air."] },

  { id: "phosphorus-oxychloride", name: "Phosphorus oxychloride", cas: "10025-87-3", un: "1810", hazardClass: ["8", "6.1"], ergGuide: "137",
    placard: "CORROSIVE / POISON", synonyms: ["POCl3", "Phosphoryl chloride"],
    ppe: ["SCBA", "Chemical-resistant gloves; face shield"], reactivity: ["Corrosive; water-reactive.", "Reacts with water to form HCl + H3PO4."],
    incompatibilities: ["Water", "Bases", "Metals"], firstAid: ["Flush skin/eyes with copious water.", "Move to fresh air."] },

  { id: "boron-trifluoride", name: "Boron trifluoride", cas: "7637-07-2", un: "1008", hazardClass: ["2.3", "8"], ergGuide: "125",
    placard: "POISON GAS / CORROSIVE", synonyms: ["BF3"],
    ppe: ["Level A", "SCBA"], reactivity: ["Toxic; corrosive.", "Reacts with water to form HF + boric acid."],
    incompatibilities: ["Water", "Bases", "Metals"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "chlorine-trifluoride", name: "Chlorine trifluoride", cas: "7790-91-2", un: "1749", hazardClass: ["2.3", "5.1", "8"], ergGuide: "124",
    placard: "POISON GAS / OXIDIZER / CORROSIVE", synonyms: ["ClF3", "CTF"],
    ppe: ["Level A", "SCBA (specialty suit — ClF3 ignites most materials including glass)"],
    reactivity: ["Extremely powerful oxidizer; ignites glass, sand, asbestos, concrete on contact.", "Reacts violently with water."],
    incompatibilities: ["ALL materials", "Water", "Organics", "Metals"], firstAid: ["Move to fresh air.", "Flush skin/eyes with copious water.", "Obtain immediate medical care."] },

  { id: "fluorine", name: "Fluorine, compressed", cas: "7782-41-4", un: "1045", hazardClass: ["2.3", "5.1", "8"], ergGuide: "124",
    placard: "POISON GAS / OXIDIZER / CORROSIVE", synonyms: ["F2"],
    ppe: ["Level A (specialty suit)", "SCBA"],
    reactivity: ["Most powerful elemental oxidizer; ignites almost everything.", "Reacts violently with water to form HF + O2."],
    incompatibilities: ["ALL materials", "Water", "Organics", "Metals"], firstAid: ["Move to fresh air.", "Administer oxygen.", "Flush skin/eyes with water (HF burns likely)."] },

  { id: "white-phosphorus", name: "White phosphorus", cas: "7723-14-0", un: "1381", hazardClass: ["4.2", "6.1"], ergGuide: "136",
    placard: "SPONTANEOUSLY COMBUSTIBLE / POISON", synonyms: ["WP", "Yellow phosphorus", "P4"],
    ppe: ["Level A", "SCBA", "Chemical-resistant gloves"],
    reactivity: ["Pyrophoric; ignites spontaneously in air.", "Toxic.", "Burns producing P2O5 (corrosive)."],
    incompatibilities: ["Air", "Oxidizers", "Water (may react if heated)"], firstAid: ["Submerge burns in water.", "Do not allow WP to dry.", "Obtain immediate medical care."] },

  { id: "red-phosphorus", name: "Red phosphorus", cas: "7723-14-0", un: "1338", hazardClass: ["4.1"], ergGuide: "133",
    placard: "FLAMMABLE SOLID", synonyms: ["RP"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Flammable solid; less reactive than white P.", "Ignites on strong heating."],
    incompatibilities: ["Strong oxidizers", "Heat"], firstAid: ["Flush skin/eyes with water."] },

  { id: "sulfur", name: "Sulfur", cas: "7704-34-9", un: "1350", hazardClass: ["4.1"], ergGuide: "133",
    placard: "FLAMMABLE SOLID", synonyms: ["Brimstone", "Sulphur"],
    ppe: ["SCBA if dusting/burning", "Chemical-resistant gloves"], reactivity: ["Flammable solid; burns to SO2.", "Dust can form explosive mixtures with air."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air (SO2 from burning).", "Flush skin/eyes with water."] },

  { id: "zinc-powder", name: "Zinc powder", cas: "7440-66-6", un: "1436", hazardClass: ["4.3", "4.2"], ergGuide: "138",
    placard: "DANGEROUS WHEN WET / SPONTANEOUSLY COMBUSTIBLE", synonyms: ["Zn powder"],
    ppe: ["SCBA", "Chemical-resistant gloves; Class D extinguisher"],
    reactivity: ["Reacts with water/acids to release H2.", "Dust can form explosive mixtures."],
    incompatibilities: ["Water", "Acids", "Oxidizers"], firstAid: ["Move to fresh air.", "Flush skin with water if no Zn dust."] },

  { id: "aluminum-powder", name: "Aluminum powder", cas: "7429-90-5", un: "1396", hazardClass: ["4.3", "4.2"], ergGuide: "138",
    placard: "DANGEROUS WHEN WET / SPONTANEOUSLY COMBUSTIBLE", synonyms: ["Al powder", "Flake aluminum"],
    ppe: ["SCBA", "Chemical-resistant gloves; Class D extinguisher"],
    reactivity: ["Dust can form explosive mixtures with air.", "Reacts with water, acids, bases to release H2."],
    incompatibilities: ["Water", "Acids", "Bases", "Oxidizers"], firstAid: ["Move to fresh air.", "Flush skin."] },

  // ─── Additional common industrial/exposure chemicals ─────────────────
  { id: "isopropyl-acetate", name: "Isopropyl acetate", cas: "108-21-4", un: "1220", hazardClass: ["3"], ergGuide: "129",
    placard: "FLAMMABLE LIQUID", synonyms: ["IPAc"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Flammable.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "sec-butanol", name: "2-Butanol", cas: "78-92-2", un: "1120", hazardClass: ["3"], ergGuide: "129",
    placard: "FLAMMABLE LIQUID", synonyms: ["sec-Butyl alcohol", "2-Butanol"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Flammable.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "tert-butanol", name: "tert-Butanol", cas: "75-65-0", un: "1120", hazardClass: ["3"], ergGuide: "129",
    placard: "FLAMMABLE LIQUID", synonyms: ["t-Butyl alcohol", "2-Methyl-2-propanol"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Flammable solid at low temp.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "diacetone-alcohol", name: "Diacetone alcohol", cas: "123-42-2", un: "1148", hazardClass: ["3"], ergGuide: "129",
    placard: "FLAMMABLE LIQUID", synonyms: ["DAA", "4-Hydroxy-4-methyl-2-pentanone"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Combustible.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "isophorone", name: "Isophorone", cas: "78-59-1", un: "2293", hazardClass: ["3"], ergGuide: "128",
    placard: "FLAMMABLE LIQUID", synonyms: ["3,5,5-Trimethyl-2-cyclohexenone"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Combustible.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "furfural", name: "Furfural", cas: "98-01-1", un: "1199", hazardClass: ["6.1", "3"], ergGuide: "131",
    placard: "POISON / FLAMMABLE LIQUID", synonyms: ["2-Furancarboxaldehyde", "Furaldehyde"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Flammable; toxic.", "Reacts with strong oxidizers, acids."],
    incompatibilities: ["Strong oxidizers", "Acids"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "furfuryl-alcohol", name: "Furfuryl alcohol", cas: "98-00-0", un: "2891", hazardClass: ["6.1", "3"], ergGuide: "131",
    placard: "POISON / FLAMMABLE LIQUID", synonyms: ["2-Furanmethanol"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Flammable; toxic.", "Reacts with strong acids (can polymerize violently)."],
    incompatibilities: ["Strong acids", "Oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "phenol-crystals", name: "Phenol (crystals)", cas: "108-95-2", un: "1671", hazardClass: ["6.1"], ergGuide: "153",
    placard: "POISON", synonyms: ["Carbolic acid (solid)"],
    ppe: ["SCBA", "Chemical-resistant gloves"],
    reactivity: ["Combustible; corrosive.", "Systemic toxicity via skin."],
    incompatibilities: ["Strong oxidizers", "Bases"], firstAid: ["Flush skin/eyes with water.", "PEG wipe if available.", "Obtain medical evaluation."] },

  { id: "p-cresol", name: "p-Cresol", cas: "106-44-5", un: "2076", hazardClass: ["6.1", "8"], ergGuide: "153",
    placard: "POISON / CORROSIVE", synonyms: ["4-Methylphenol", "p-Methylphenol"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Combustible; corrosive.", "Systemic toxicity."],
    incompatibilities: ["Strong oxidizers", "Bases"], firstAid: ["Flush skin/eyes with copious water."] },

  { id: "xylenol", name: "Xylenol (mixed isomers)", cas: "1300-71-6", un: "2261", hazardClass: ["6.1", "8"], ergGuide: "153",
    placard: "POISON / CORROSIVE", synonyms: ["Dimethylphenol"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Combustible; corrosive.", "Systemic toxicity."],
    incompatibilities: ["Strong oxidizers", "Bases"], firstAid: ["Flush skin/eyes with copious water."] },

  { id: "resorcinol", name: "Resorcinol", cas: "108-46-3", un: "2876", hazardClass: ["6.1"], ergGuide: "153",
    placard: "POISON", synonyms: ["1,3-Benzenediol", "m-Dihydroxybenzene"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Combustible.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Flush skin/eyes with water."] },

  { id: "hydroquinone", name: "Hydroquinone", cas: "123-31-9", un: "2662", hazardClass: ["6.1"], ergGuide: "153",
    placard: "POISON", synonyms: ["1,4-Benzenediol", "Quinol"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Combustible.", "Reacts with strong oxidizers."],
    incompatibilities: ["Strong oxidizers"], firstAid: ["Flush skin/eyes with water."] },

  { id: "mercury", name: "Mercury (metal)", cas: "7439-97-6", un: "2809", hazardClass: ["9"], ergGuide: "172",
    placard: "MISCELLANEOUS", synonyms: ["Quicksilver", "Hg", "Liquid silver"],
    ppe: ["SCBA if vapor present", "Chemical-resistant gloves"],
    reactivity: ["Vapor is toxic; accumulates in nervous system.", "Reacts with ammonia, acetylene, aluminum."],
    incompatibilities: ["Ammonia", "Acetylene", "Aluminum", "Oxidizers"], firstAid: ["Move to fresh air.", "Decontaminate skin.", "Obtain medical evaluation."] },

  { id: "mercuric-chloride", name: "Mercuric chloride", cas: "7487-94-7", un: "1624", hazardClass: ["6.1"], ergGuide: "151",
    placard: "POISON", synonyms: ["Mercury(II) chloride", "Corrosive sublimate"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Highly toxic; cumulative poison."],
    incompatibilities: ["Strong oxidizers", "Reducing agents"], firstAid: ["Move to fresh air.", "Decontaminate.", "Obtain immediate medical evaluation."] },

  { id: "lead-acetate", name: "Lead acetate", cas: "301-04-2", un: "1616", hazardClass: ["6.1"], ergGuide: "151",
    placard: "POISON", synonyms: ["Lead(II) acetate", "Sugar of lead"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Toxic; cumulative poison."],
    incompatibilities: ["Strong oxidizers", "Acids", "Bases"], firstAid: ["Move to fresh air.", "Decontaminate.", "Obtain medical evaluation."] },

  { id: "sodium-nitrite", name: "Sodium nitrite", cas: "7632-00-0", un: "1500", hazardClass: ["5.1", "6.1"], ergGuide: "141",
    placard: "OXIDIZER / POISON", synonyms: ["NaNO2"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Oxidizer; toxic.", "Reacts with reducing agents, acids (releases NOx)."],
    incompatibilities: ["Reducing agents", "Acids", "Ammonium salts"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "sodium-nitrate", name: "Sodium nitrate", cas: "7631-99-4", un: "1498", hazardClass: ["5.1"], ergGuide: "140",
    placard: "OXIDIZER", synonyms: ["NaNO3", "Chile saltpeter"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Oxidizer.", "Reacts with combustibles, reducing agents."],
    incompatibilities: ["Combustibles", "Reducing agents", "Acids"], firstAid: ["Flush skin/eyes with water."] },

  { id: "potassium-nitrate", name: "Potassium nitrate", cas: "7757-79-1", un: "1486", hazardClass: ["5.1"], ergGuide: "140",
    placard: "OXIDIZER", synonyms: ["KNO3", "Saltpeter", "Niter"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Oxidizer.", "Reacts with combustibles, reducing agents."],
    incompatibilities: ["Combustibles", "Reducing agents"], firstAid: ["Flush skin/eyes with water."] },

  { id: "ammonium-perchlorate", name: "Ammonium perchlorate", cas: "7790-98-9", un: "1442", hazardClass: ["5.1", "1.1D"], ergGuide: "143",
    placard: "OXIDIZER / EXPLOSIVE 1.1D", synonyms: ["AP", "NH4ClO4"],
    ppe: ["Level A", "SCBA", "Blast PPE if bulk quantity"],
    reactivity: ["Strong oxidizer; can detonate under confinement and heat.", "Reacts violently with organics, metals."],
    incompatibilities: ["Organics", "Metals", "Heat", "Confinement"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "dimethylamine", name: "Dimethylamine, anhydrous", cas: "124-40-3", un: "1032", hazardClass: ["2.1", "8"], ergGuide: "118",
    placard: "FLAMMABLE GAS / CORROSIVE", synonyms: ["DMA"],
    ppe: ["SCBA", "Flame-resistant clothing; chemical-resistant gloves"],
    reactivity: ["Flammable; corrosive.", "Reacts with acids, oxidizers, mercury."],
    incompatibilities: ["Acids", "Oxidizers", "Mercury"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "trimethylamine", name: "Trimethylamine, anhydrous", cas: "75-50-3", un: "1083", hazardClass: ["2.1", "8"], ergGuide: "118",
    placard: "FLAMMABLE GAS / CORROSIVE", synonyms: ["TMA", "NMe3"],
    ppe: ["SCBA", "Flame-resistant clothing"],
    reactivity: ["Flammable; corrosive; strong fishy odor.", "Reacts with acids, oxidizers."],
    incompatibilities: ["Acids", "Oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "ethylamine", name: "Ethylamine", cas: "75-04-7", un: "1036", hazardClass: ["2.1", "8"], ergGuide: "118",
    placard: "FLAMMABLE GAS / CORROSIVE", synonyms: ["EA", "Aminoethane"],
    ppe: ["SCBA", "Flame-resistant clothing"],
    reactivity: ["Flammable; corrosive.", "Reacts with acids, oxidizers."],
    incompatibilities: ["Acids", "Oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "diethylamine", name: "Diethylamine", cas: "109-89-7", un: "1154", hazardClass: ["3", "8"], ergGuide: "132",
    placard: "FLAMMABLE LIQUID / CORROSIVE", synonyms: ["DEA", "N-Ethylethanamine"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Flammable; corrosive.", "Reacts with acids, oxidizers."],
    incompatibilities: ["Acids", "Oxidizers"], firstAid: ["Move to fresh air.", "Flush skin/eyes with water."] },

  { id: "monoethanolamine", name: "Monoethanolamine (recovered)", cas: "141-43-5", un: "2491", hazardClass: ["8"], ergGuide: "153",
    placard: "CORROSIVE", synonyms: ["MEA", "2-Aminoethanol"],
    ppe: ["SCBA", "Chemical-resistant gloves; face shield"], reactivity: ["Corrosive.", "Reacts with acids, oxidizers."],
    incompatibilities: ["Acids", "Oxidizers"], firstAid: ["Flush skin/eyes with water."] },

  { id: "toulenediisocyanate", name: "Toluene diisocyanate", cas: "26471-62-5", un: "2078", hazardClass: ["6.1"], ergGuide: "156",
    placard: "POISON", synonyms: ["TDI", "2,4-/2,6-TDI mixture"],
    ppe: ["Level A", "SCBA"], reactivity: ["Toxic; strong respiratory sensitizer.", "Reacts with water, alcohols, amines (releases CO2)."],
    incompatibilities: ["Water", "Alcohols", "Amines", "Bases"], firstAid: ["Move to fresh air.", "Administer oxygen.", "Obtain medical evaluation."] },

  { id: "methylene-diphenyl-diisocyanate", name: "Methylene diphenyl diisocyanate", cas: "101-68-8", un: "—", hazardClass: [], ergGuide: "—",
    synonyms: ["MDI", "Diphenylmethane-4,4'-diisocyanate"],
    ppe: ["SCBA", "Chemical-resistant gloves"], reactivity: ["Respiratory sensitizer.", "Reacts with water, alcohols."],
    incompatibilities: ["Water", "Alcohols", "Amines"], firstAid: ["Move to fresh air.", "Obtain medical evaluation."] },
];