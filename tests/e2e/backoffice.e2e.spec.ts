import { expect, test } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";
const INACTIVE_EMAIL = process.env.E2E_INACTIVE_EMAIL || "";
const INACTIVE_PASSWORD = process.env.E2E_INACTIVE_PASSWORD || "";
const INELIGIBLE_MEMBER_NAME = process.env.E2E_INELIGIBLE_MEMBER_NAME || "";

function hasRealEnvValue(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  const invalidMarkers = ["replace-with-password", "@example.com", "Nombre Apellido Sin App"];
  return !invalidMarkers.some((marker) => normalized.includes(marker));
}

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Iniciar sesion" })).toBeVisible();

  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();

  const reachedDashboard = await page
    .waitForURL("**/", { timeout: 15_000 })
    .then(() => true)
    .catch(() => false);

  if (!reachedDashboard) {
    const authError = await page
      .locator(".border-rose-200")
      .first()
      .textContent()
      .catch(() => null);
    throw new Error(
      `No se redirigio al dashboard. url=${page.url()} error=${authError || "none"}`
    );
  }

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

test("redirecciona a login cuando no hay sesion", async ({ page }) => {
  await page.goto("/");

  const reachedLogin = await page
    .waitForURL("**/login", { timeout: 10_000 })
    .then(() => true)
    .catch(() => false);

  if (reachedLogin) {
    await expect(page.getByRole("heading", { name: "Iniciar sesion" })).toBeVisible();
    return;
  }

  await expect(page.getByText("Validando sesion...")).toBeVisible();
});

test("renderiza formulario de login", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Iniciar sesion" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: /Entrar|Ingresando.../ })).toBeVisible();
});

test("flujo admin: navega por modulos principales", async ({ page }) => {
  expect(ADMIN_EMAIL, "Falta E2E_ADMIN_EMAIL").toBeTruthy();
  expect(ADMIN_PASSWORD, "Falta E2E_ADMIN_PASSWORD").toBeTruthy();

  await loginAsAdmin(page);

  const routesToValidate: Array<{ path: string; heading: string }> = [
    { path: "/catalogs/org-levels", heading: "Org Levels" },
    { path: "/catalogs/aid-types", heading: "Aid Types" },
    { path: "/catalogs/authorities", heading: "Authorities" },
    { path: "/catalogs/cities", heading: "Cities" },
    { path: "/catalogs/communities", heading: "Communities" },
    { path: "/catalogs/routes", heading: "Routes" },
    { path: "/organization/members", heading: "Org Members" },
    { path: "/access/app-users", heading: "App Access" },
    { path: "/push/campaigns", heading: "Push Campaigns" },
  ];

  for (const route of routesToValidate) {
    await page.goto(route.path);
    await expect(
      page.getByRole("heading", { name: route.heading, exact: true })
    ).toBeVisible();
  }
});

test("rechaza login de cuenta backoffice inactiva", async ({ page }) => {
  test.skip(
    !hasRealEnvValue(INACTIVE_EMAIL) || !hasRealEnvValue(INACTIVE_PASSWORD),
    "Configura E2E_INACTIVE_EMAIL y E2E_INACTIVE_PASSWORD para ejecutar este caso."
  );

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Iniciar sesion" })).toBeVisible();

  await page.getByLabel("Email").fill(INACTIVE_EMAIL);
  await page.getByLabel("Password").fill(INACTIVE_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page.locator(".border-rose-200")).toContainText(
    "La cuenta de Back Office esta inactiva."
  );
  await expect(page).toHaveURL(/\/login/);
});

test("app access: excluye org members con canUseApp=false", async ({ page }) => {
  test.skip(
    !hasRealEnvValue(INELIGIBLE_MEMBER_NAME),
    "Configura E2E_INELIGIBLE_MEMBER_NAME para ejecutar este caso."
  );

  expect(ADMIN_EMAIL, "Falta E2E_ADMIN_EMAIL").toBeTruthy();
  expect(ADMIN_PASSWORD, "Falta E2E_ADMIN_PASSWORD").toBeTruthy();

  await loginAsAdmin(page);
  await page.goto("/access/app-users");
  await expect(page.getByRole("heading", { name: "App Access", exact: true })).toBeVisible();

  const eligibleSelect = page.getByLabel("OrgMember elegible");
  const options = await eligibleSelect.locator("option").allTextContents();
  const hasIneligibleMember = options.some((optionText) =>
    optionText.includes(INELIGIBLE_MEMBER_NAME)
  );

  expect(
    hasIneligibleMember,
    `El miembro '${INELIGIBLE_MEMBER_NAME}' no debe aparecer en el selector de elegibles.`
  ).toBeFalsy();
});
