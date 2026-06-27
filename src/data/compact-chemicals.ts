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
];