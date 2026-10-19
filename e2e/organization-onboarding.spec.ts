import { expect, test } from "@playwright/test";

const email = process.env.MOVMAK_E2E_EMAIL;
const password = process.env.MOVMAK_E2E_PASSWORD;
const duplicateEmail = process.env.MOVMAK_E2E_DUPLICATE_EMAIL;
const duplicatePassword = process.env.MOVMAK_E2E_DUPLICATE_PASSWORD;

test.skip(!email || !password, "Dedicated E2E credentials are required.");

test("organization owner signup reaches the confirmation checkpoint", async ({ page }) => {
  await page.goto("http://localhost:3000/signup");
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();

  await page.getByLabel("Full name").fill("A");
  await page.getByLabel("Email address").fill(email ?? "");
  await page.getByLabel("Password").fill(password ?? "");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByLabel("Full name")).toHaveJSProperty("validity.valid", false);
  await expect(page).toHaveURL("http://localhost:3000/signup");

  await page.getByLabel("Full name").fill("Movmak Test Owner");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Check your email to confirm your account",
    { timeout: 30_000 },
  );
});

test("second owner signup reaches the confirmation checkpoint", async ({ page }) => {
  test.skip(!duplicateEmail || !duplicatePassword, "Second E2E credentials are required.");
  await page.goto("http://localhost:3000/signup");
  await page.getByLabel("Full name").fill("Movmak Duplicate Test Owner");
  await page.getByLabel("Email address").fill(duplicateEmail ?? "");
  await page.getByLabel("Password").fill(duplicatePassword ?? "");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Check your email to confirm your account",
    { timeout: 30_000 },
  );
});

test("confirmed owner creates an organization and keeps admin access", async ({ page }) => {
  const uniqueSuffix = Date.now().toString(36);
  const organizationName = `Movmak Browser Test ${uniqueSuffix}`;
  const organizationSlug = `movmak-browser-test-${uniqueSuffix}`;

  await page.goto("http://localhost:3000/login");
  await page.getByLabel("Email address").fill(email ?? "");
  await page.getByLabel("Password").fill(password ?? "");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/onboarding$/, { timeout: 15_000 });

  await page.getByLabel("Organization name").fill("A");
  await page.getByLabel("Organization URL name").fill("Invalid Slug");
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page.getByLabel("Organization name")).toHaveJSProperty("validity.valid", false);
  await expect(page.getByLabel("Organization URL name")).toHaveJSProperty("validity.valid", false);
  await expect(page).toHaveURL(/\/onboarding$/);

  await page.getByLabel("Organization name").fill(organizationName);
  await page.getByLabel("Organization URL name").fill(organizationSlug);
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: organizationName })).toBeVisible();
  await expect(page.getByText("active admin membership")).toBeVisible();

  await page.getByRole("link", { name: "Continue to your workspace" }).click();
  await expect(page).toHaveURL(/\/app\/admin$/, { timeout: 15_000 });
  await expect(page.getByText("Administrator overview")).toBeVisible();
  await expect(page.getByText(organizationName, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });
  await page.getByLabel("Email address").fill(email ?? "");
  await page.getByLabel("Password").fill(password ?? "");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: organizationName })).toBeVisible();
  await expect(page.getByText("active admin membership")).toBeVisible();
});

test("duplicate organization slug is rejected without granting membership", async ({ page }) => {
  test.skip(!duplicateEmail || !duplicatePassword, "Second E2E credentials are required.");

  await page.goto("http://localhost:3000/login");
  await page.getByLabel("Email address").fill(email ?? "");
  await page.getByLabel("Password").fill(password ?? "");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 });
  const heading = await page.getByRole("heading", { level: 1 }).textContent();
  const suffix = heading?.match(/^Movmak Browser Test (.+)$/)?.[1];
  expect(suffix).toBeTruthy();
  const existingSlug = `movmak-browser-test-${suffix}`;
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });

  await page.getByLabel("Email address").fill(duplicateEmail ?? "");
  await page.getByLabel("Password").fill(duplicatePassword ?? "");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/onboarding$/, { timeout: 15_000 });
  await page.getByLabel("Organization name").fill("Duplicate Slug Rejection Test");
  await page.getByLabel("Organization URL name").fill(existingSlug);
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(
    page.getByText("That organization URL name is already in use.", { exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/onboarding$/);

  await page.reload();
  await expect(page).toHaveURL(/\/onboarding$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Create your organization" })).toBeVisible();
});
