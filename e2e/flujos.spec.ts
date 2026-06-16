import { test, expect } from "@playwright/test"

test.describe("Smoke tests — critical flows", () => {
  test("1. /hoy loads and shows fixture list or empty state", async ({ page }) => {
    await page.goto("/hoy")
    await expect(page).toHaveTitle(/Mundial|Hoy|M_M/i)
    // Either shows fixtures or an empty state message — both are valid
    const body = await page.textContent("body")
    expect(body).toBeTruthy()
    // Page should not show a Next.js error boundary
    expect(body).not.toContain("Application error")
    expect(body).not.toContain("Unhandled Runtime Error")
  })

  test("2. /historial loads and shows bet table or empty state", async ({ page }) => {
    await page.goto("/historial")
    const body = await page.textContent("body")
    expect(body).toBeTruthy()
    expect(body).not.toContain("Application error")
    // Should have the mode filter buttons (Real / Paper)
    const realBtn = page.getByText("real", { exact: false })
    await expect(realBtn.first()).toBeVisible()
  })

  test("3. /calibracion loads and shows metrics grid", async ({ page }) => {
    await page.goto("/calibracion")
    const body = await page.textContent("body")
    expect(body).toBeTruthy()
    expect(body).not.toContain("Application error")
    // Should show "Calibración" heading or similar
    expect(body?.toLowerCase()).toContain("calibr")
  })

  test("4. /partido/[id] 404s gracefully for non-existent fixture", async ({ page }) => {
    const response = await page.goto("/partido/999999")
    // Should either redirect or show a not-found page (not a 500)
    expect(response?.status()).not.toBe(500)
    const body = await page.textContent("body")
    expect(body).not.toContain("Application error")
  })

  test("/config carga y muestra el interruptor de modo papel", async ({ page }) => {
    const res = await page.goto("/config")
    expect(res?.status()).toBeLessThan(500)
    await expect(page.getByText(/modo papel/i)).toBeVisible()
  })
})
