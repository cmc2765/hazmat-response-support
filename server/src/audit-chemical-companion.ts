import Database from 'better-sqlite3';
import { getCompanionDbPath, rebuildCompanionSearchIndex } from './chemical-companion.js';

const path = getCompanionDbPath();
const db = new Database(path, { readonly: true });
try {
  console.info('[chemical-companion:audit] identification schema');
  for (const table of ['chemicals', 'chemicalsynonyms', 'emergency_response_unna_numbers', 'emergency_response_proper_shipping_names', 'emergency_response_guides', 'emergency_response_guidebooks']) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    console.info(`  ${table}: ${columns.map((column) => column.name).join(', ')}`);
  }
  console.info('[chemical-companion:audit] direct source values and relationships');
  console.table(db.prepare(`SELECT p.id AS shipping_name_id, p.proper_shipping_name, p.unna,
    u.id AS unna_source_id, u.guide_text_number, u.guide_book_id, p.guide_id
    FROM emergency_response_proper_shipping_names p
    JOIN emergency_response_unna_numbers u ON u.unna=p.unna AND u.guide_book_id=3
    WHERE p.country='USA' AND (p.unna=2312 OR lower(p.proper_shipping_name) IN ('phenol, molten', 'phenol'))`).all());
  console.table(db.prepare(`SELECT ChemicalID, ChemicalName, CasNumber, UnnaNumber, ErgNumber, ChemicalClass
    FROM chemicals WHERE UnnaNumber='2312' OR lower(ChemicalName) IN ('phenol, molten','phenol')
      OR replace(CasNumber, ' ', '')='108-95-2'`).all());
  console.table(db.prepare(`SELECT ChemicalSynonymID, ChemicalID, ChemicalSynonym
    FROM chemicalsynonyms WHERE lower(ChemicalSynonym) IN ('phenol, molten','phenol')`).all());
  console.info('[chemical-companion:audit] validated index totals', rebuildCompanionSearchIndex());
} finally { db.close(); }
