import { readFileSync } from "node:fs";

import {
  type PlumeValidationCase,
  validatePlumeCases,
} from "../../src/lib/model/validation.js";

const fixtureUrl = new URL(
  "../../test/model-validation/plume-validation-cases.example.json",
  import.meta.url,
);
const cases = JSON.parse(
  readFileSync(fixtureUrl, "utf8"),
) as PlumeValidationCase[];
const report = validatePlumeCases(cases);

console.log(JSON.stringify(report.summary, null, 2));

if (
  process.argv.includes("--require-validated") &&
  report.summary.validationStatus !== "validated"
) {
  process.exitCode = 1;
}
