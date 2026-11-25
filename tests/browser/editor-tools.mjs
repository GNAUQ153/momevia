// Secondary Editor controls live in a native disclosure in both workspace modes.
// Exercise its visible summary instead of bypassing browser actionability.
async function useEditorTools(page, interact) {
  const tools = page.locator('.editor-more-tools');
  if (!await tools.evaluate(element => element.open)) await tools.locator(':scope > summary').click();
  await interact(tools);
  if (!await page.locator('dialog[open]').count() && await tools.count() && await tools.evaluate(element => element.open)) {
    await tools.locator(':scope > summary').click();
  }
}

export async function selectEditorLocale(page, locale) {
  await useEditorTools(page, async tools => {
    await tools.locator('[data-locale-select]').selectOption(locale);
    await page.waitForFunction(expected => globalThis.document.documentElement.lang === expected, locale);
  });
}

export async function clickEditorTool(page, action) {
  await useEditorTools(page, tools => tools.locator(`[data-editor-action="${action}"]`).click());
}
