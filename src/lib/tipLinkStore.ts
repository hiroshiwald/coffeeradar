/**
 * Tip link persistence.
 *
 * Server-only: reads and writes the `site_settings` rows that gate the tip
 * link, and falls back to the env default when no row exists. Delegates to
 * Turso or to the in-process value based on hasTurso(), the same split
 * siteAuthStore.ts and sourceStore.ts use.
 */

import { TipLinkSettings } from "./tipLink";
import { dbGetSettings, dbSetSetting, ensureDbInit, hasTurso } from "./db";

const ENABLED_KEY = "tip_link_enabled";
const URL_KEY = "tip_link_url";

/**
 * Defaults for a site that has never used the admin card.
 *
 * `enabled` starts on so an existing NEXT_PUBLIC_TIP_URL deployment keeps its
 * footer line. The literal `process.env.NEXT_PUBLIC_TIP_URL` stays in the
 * source because Next.js replaces that exact text for NEXT_PUBLIC_* vars.
 */
function envDefaults(): TipLinkSettings {
  return { enabled: true, url: process.env.NEXT_PUBLIC_TIP_URL ?? "" };
}

/**
 * In-process fallback for runs without Turso, private to this module and reset
 * on restart.
 *
 * Held on globalThis rather than in a module-level variable: the dev server
 * compiles each route into its own module instance, so / and /roasters would
 * otherwise disagree about whether the link was switched off. Nothing outside
 * this file reads or writes the property.
 */
const memHolder = globalThis as typeof globalThis & { __tipLinkSettings?: TipLinkSettings };

/** Exposed for tests so they can clear the fallback between runs. */
export function __resetTipLinkStoreForTests(): void {
  delete memHolder.__tipLinkSettings;
}

export async function readTipLinkSettings(): Promise<TipLinkSettings> {
  if (!hasTurso()) return memHolder.__tipLinkSettings ?? envDefaults();

  await ensureDbInit();
  const rows = await dbGetSettings([ENABLED_KEY, URL_KEY]);
  const defaults = envDefaults();
  const storedEnabled = rows[ENABLED_KEY];
  return {
    enabled: storedEnabled === undefined ? defaults.enabled : storedEnabled === "1",
    url: rows[URL_KEY] ?? defaults.url,
  };
}

export async function writeTipLinkSettings(settings: TipLinkSettings): Promise<void> {
  if (!hasTurso()) {
    memHolder.__tipLinkSettings = settings;
    return;
  }

  await ensureDbInit();
  await dbSetSetting(ENABLED_KEY, settings.enabled ? "1" : "0");
  await dbSetSetting(URL_KEY, settings.url);
}
