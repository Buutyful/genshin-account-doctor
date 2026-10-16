import type { Locator } from '@playwright/test';

export async function openPlanningSettings(builder: Locator) {
  const settings = builder.locator('.builder-settings');
  if (!await settings.evaluate(el => (el as HTMLDetailsElement).open)) await settings.locator(':scope > summary').click();
  const preferences = builder.locator('.builder-preferences');
  if (!await preferences.evaluate(el => (el as HTMLDetailsElement).open)) await preferences.locator(':scope > summary').click();
}
