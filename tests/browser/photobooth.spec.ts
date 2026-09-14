import { expect, test } from "@playwright/test";

const image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=";

test("real API accepts loopback origin and rejects malformed JSON bodies", async ({ request }) => {
  const response = await request.post("/api/photobooth", {
    headers: { Origin: "http://127.0.0.1:3000", "Content-Type": "application/json" },
    data: "null",
  });
  expect(response.status()).toBe(400);
  expect((await response.json()).error.message).toBe("Request body must be a JSON object");
});

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  for (const variant of ["sunburst", "flare"]) {
    test(`${viewport.width}px: ${variant} survives upload, navigation, and generation`, async ({ page }) => {
      await page.setViewportSize(viewport);
      let submittedModel = "";
      await page.route("**/api/photobooth", async (route) => {
        const payload = route.request().postDataJSON();
        submittedModel = payload.model;
        const body = payload.styleIds.map((styleId: string) => `event: style-final\ndata: ${JSON.stringify({ styleId, imageDataUrl: `data:image/png;base64,${image}` })}\n\n`).join("") + 'event: session-complete\ndata: {}\n\n';
        await route.fulfill({ status: 200, contentType: "text/event-stream", body });
      });
      await page.goto("/");
      const selector = page.locator("select:visible");
      await expect(selector).toHaveValue("gpt-image-2.5-sunburst");
      await selector.selectOption(`gpt-image-2.5-${variant}`);
      await page.locator('input[type="file"]').setInputFiles({ name: "portrait.png", mimeType: "image/png", buffer: Buffer.from(image, "base64") });
      const generate = page.getByRole("button", { name: "Generate Styles", exact: true });
      await expect(generate).toBeEnabled();
      await generate.scrollIntoViewIfNeeded();
      await expect(generate).toBeInViewport();
      await expect(page.locator("body")).toHaveJSProperty("scrollWidth", viewport.width);
      await page.screenshot({ path: `/tmp/photobooth-${viewport.width}-${variant}.png`, fullPage: true });
      await generate.click();
      await expect(page).toHaveURL(/\/results$/);
      await expect(page.getByRole("button", { name: "Download", exact: true })).toHaveCount(2);
      expect(submittedModel).toBe(`gpt-image-2.5-${variant}`);
      await expect(page.getByText(`GPT Image 2.5 · ${variant === "sunburst" ? "Sunburst" : "Flare"}`, { exact: true })).toBeVisible();
    });
  }
}

test("failed generation clears pending cards", async ({ page }) => {
  await page.route("**/api/photobooth", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "Service unavailable" } }) }));
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({ name: "portrait.png", mimeType: "image/png", buffer: Buffer.from(image, "base64") });
  await page.getByRole("button", { name: "Generate Styles", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Service unavailable");
  await expect(page.locator("article").getByText("Service unavailable", { exact: true })).toHaveCount(2);
});

for (const failure of ["network", "truncated", "late-error"]) {
  const interruptedAfterFirstImage = failure !== "network";
  test(`recover from ${failure} without re-uploading or repeating completed styles`, async ({ page }) => {
    const requests: Array<{ model: string; styleIds: string[]; imageDataUrl: string }> = [];
    await page.route('**/api/photobooth', async (route) => {
      const payload = route.request().postDataJSON();
      requests.push(payload);
      if (requests.length === 1) {
        if (!interruptedAfterFirstImage) return route.abort('failed');
        const lateError = failure === 'late-error' ? `event: style-error\ndata: ${JSON.stringify({ styleId: 'knitted', message: 'Late network error' })}\n\n` : '';
        return route.fulfill({ status: 200, contentType: 'text/event-stream', body: `event: style-final\ndata: ${JSON.stringify({ styleId: 'knitted', imageDataUrl: `data:image/png;base64,${image}` })}\n\n${lateError}` });
      }
      const body = payload.styleIds.map((styleId: string) => `event: style-final\ndata: ${JSON.stringify({ styleId, imageDataUrl: `data:image/png;base64,${image}` })}\n\n`).join('') + 'event: session-complete\ndata: {}\n\n';
      return route.fulfill({ status: 200, contentType: 'text/event-stream', body });
    });
    await page.goto('/');
    await page.locator('select:visible').selectOption('gpt-image-2.5-flare');
    await page.locator('input[type="file"]').setInputFiles({ name: 'portrait.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') });
    await page.getByRole('button', { name: 'Generate Styles', exact: true }).click();
    const retry = page.getByRole('button', { name: 'Retry failed styles', exact: true });
    await expect(retry).toBeVisible();
    if (!interruptedAfterFirstImage) await expect(page.getByRole('main').getByRole('alert')).toContainText('Connection lost');
    await expect(page.getByRole('button', { name: 'Download', exact: true })).toHaveCount(interruptedAfterFirstImage ? 1 : 0);
    expect(requests).toHaveLength(1);
    await retry.click();
    await expect(page.getByRole('button', { name: 'Download', exact: true })).toHaveCount(2);
    expect(requests).toHaveLength(2);
    expect(requests[1].model).toBe('gpt-image-2.5-flare');
    expect(requests[1].imageDataUrl).toBe(requests[0].imageDataUrl);
    expect(requests[1].styleIds).toEqual(interruptedAfterFirstImage ? ['digital-art'] : ['knitted', 'digital-art']);
    await expect(retry).toHaveCount(0);
  });
}
