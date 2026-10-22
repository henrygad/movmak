import { expect, test } from "@playwright/test";

test("an unauthenticated browser cannot open the host workspace", async ({ page }) => {
  await page.goto("http://localhost:3000/app/host");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("an invalid invitation does not show the visitor form", async ({ page }) => {
  await page.goto("http://localhost:3000/visit/register?token=invalid");
  await expect(page.getByRole("heading", { name: "Invitation unavailable" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Register and get QR" })).toHaveCount(0);
});

test("the public signup route is organization registration", async ({ page }) => {
  await page.goto("http://localhost:3000/signup");

  await expect(page.getByRole("heading", { name: "Create an organization account" })).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
});

test("admin signup is available without an invitation", async ({ page }) => {
  await page.goto("http://localhost:3000/signup/admin");

  await expect(page.getByRole("heading", { name: "Create an organization account" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
});

test("host and reception signup require their administrator invitation", async ({ page }) => {
  await page.goto("http://localhost:3000/signup/host");
  await expect(page.getByRole("heading", { name: "Join as a resident or host" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account" })).toHaveCount(0);

  await page.goto("http://localhost:3000/signup/reception");
  await expect(page.getByRole("heading", { name: "Join the reception team" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account" })).toHaveCount(0);
});

test("role-specific invitation URLs open the matching signup form", async ({ page }) => {
  const token = "A".repeat(43);

  await page.goto(`http://localhost:3000/signup/host?token=${token}`);
  await expect(page.getByRole("heading", { name: "Join as a resident or host" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();

  await page.goto(`http://localhost:3000/signup/reception?token=${token}`);
  await expect(page.getByRole("heading", { name: "Join the reception team" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
});

test("one login page serves every account type", async ({ page }) => {
  await page.goto("http://localhost:3000/login");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
});
