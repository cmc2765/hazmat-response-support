import { test, expect } from "@playwright/test";

test("home page loads and shows M0 status", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Chemicals" })).toBeVisible();
  await expect(page.getByText("M0 · Skeleton")).toBeVisible();
});

test("primary nav links are present", async ({ page }) => {
  await page.goto("/");
  const labels = ["Chemicals", "NIOSH", "Threat Zone", "Plume", "Facilities", "Sensors", "Incidents", "Settings"];
  for (const label of labels) {
    await expect(page.getByRole("link", { name: label }).first()).toBeVisible();
  }
});

test("plume page renders the run model button", async ({ page }) => {
  await page.goto("/plume");
  await expect(page.getByRole("button", { name: "Run model" })).toBeVisible();
});
