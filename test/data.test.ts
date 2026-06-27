import { describe, expect, it } from "vitest";
import { Chemical, NPGRecord, Facility } from "@/lib/schema";
import { ALL_CHEMICALS } from "@/data/all-chemicals";
import { NPG } from "@/data/npg";
import { FACILITIES } from "@/data/facilities";
import { THRESHOLDS, getThresholds } from "@/data/thresholds";
import { lookupErg } from "@/data/erg";

describe("bundled data", () => {
  it("chemicals validate against Zod", () => {
    for (const c of ALL_CHEMICALS) {
      expect(() => Chemical.parse(c)).not.toThrow();
    }
  });

  it("NPG records validate against Zod", () => {
    for (const n of NPG) {
      expect(() => NPGRecord.parse(n)).not.toThrow();
    }
  });

  it("facilities validate against Zod", () => {
    for (const f of FACILITIES) {
      expect(() => Facility.parse(f)).not.toThrow();
    }
  });

  it("every chemical referenced by a facility has a master entry", () => {
    const ids = new Set(ALL_CHEMICALS.map((c) => c.id));
    for (const f of FACILITIES) {
      for (const c of f.chemicals) {
        expect(ids.has(c.chemicalId), `facility ${f.id} references unknown ${c.chemicalId}`).toBe(true);
      }
    }
  });

  it("every NPG record has a matching chemical entry", () => {
    const ids = new Set(ALL_CHEMICALS.map((c) => c.id));
    for (const n of NPG) {
      expect(ids.has(n.id), `npg ${n.id} missing chemical entry`).toBe(true);
    }
  });

  it("every threshold set has a matching chemical entry", () => {
    const ids = new Set(ALL_CHEMICALS.map((c) => c.id));
    for (const t of THRESHOLDS) {
      expect(ids.has(t.chemicalId), `thresholds ${t.chemicalId} missing chemical`).toBe(true);
    }
  });
});

describe("ERG lookup", () => {
  it("finds UN 1017 (chlorine)", () => {
    const e = lookupErg("1017");
    expect(e?.name).toContain("Chlorine");
    expect(e?.largeInitialDayFt).toBeGreaterThan(1000);
  });

  it("flags water-reactives", () => {
    const e = lookupErg("1428");
    expect(e?.isWaterReactive).toBe(true);
  });
});

describe("thresholds", () => {
  it("AEGL-3 > AEGL-2 > AEGL-1 for ammonia", () => {
    const t = getThresholds("ammonia");
    expect(t).toBeDefined();
    expect(t!.aegl!["3"]).toBeGreaterThan(t!.aegl!["2"]);
    expect(t!.aegl!["2"]).toBeGreaterThan(t!.aegl!["1"]);
  });
});
