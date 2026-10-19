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
