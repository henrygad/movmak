import { loadEnvConfig } from "@next/env";
import { expect, test } from "@playwright/test";

loadEnvConfig(process.cwd());

const email = process.env.MOVMAK_E2E_EMAIL;
const password = process.env.MOVMAK_E2E_PASSWORD;

test.skip(!email || !password, "Existing dedicated account credentials are required.");

test("existing organization admin can reach access management without creating records", async ({ page }) => {
  await page.goto("http://localhost:3000/login");
  await page.getByLabel("Email address").fill(email ?? "");
  await page.getByLabel("Password").fill(password ?? "");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/app$/, { timeout: 20_000 });
  await expect(page.getByText("active admin membership")).toBeVisible();

  await page.goto("http://localhost:3000/app/admin/invitations");
  await expect(page.getByRole("heading", { name: "Members and join links" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pending members" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Members and join links" })).toBeVisible();

  await page.goto("http://localhost:3000/onboarding");
  await expect(page).toHaveURL(/\/app$/, { timeout: 20_000 });
});
