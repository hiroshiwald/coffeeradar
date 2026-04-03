/**
 * Site auth abstraction layer.
 * Delegates to DB or in-memory store based on hasTurso().
 * Follows the same pattern as sourceStore.ts.
 */

import { SiteUser } from "./types";
import {
  hasTurso,
  initDb,
  dbGetSiteUsers,
  dbGetSiteUserByUsername,
  dbAddSiteUser,
  dbRemoveSiteUser,
  dbGetSiteProtection,
  dbSetSiteProtection,
} from "./db";
import {
  memGetSiteUsers,
  memGetSiteUserByUsername,
  memAddSiteUser,
  memRemoveSiteUser,
  memGetSiteProtection,
  memSetSiteProtection,
} from "./siteAuth";
import { hashPassword, verifyPassword } from "./crypto";

export async function listSiteUsers(): Promise<Omit<SiteUser, "passwordHash" | "salt">[]> {
  let users: SiteUser[];
  if (hasTurso()) {
    await initDb();
    users = await dbGetSiteUsers();
  } else {
    users = memGetSiteUsers();
  }
  return users.map(({ username, createdAt }) => ({ username, createdAt }));
}

export async function addSiteUser(username: string, password: string): Promise<void> {
  const { hash, salt } = await hashPassword(password);
  const user: SiteUser = {
    username,
    passwordHash: hash,
    salt,
    createdAt: new Date().toISOString(),
  };

  if (hasTurso()) {
    await initDb();
    await dbAddSiteUser(user);
  } else {
    memAddSiteUser(user);
  }
}

export async function removeSiteUser(username: string): Promise<void> {
  if (hasTurso()) {
    await initDb();
    await dbRemoveSiteUser(username);
  } else {
    memRemoveSiteUser(username);
  }
}

export async function validateSiteUser(username: string, password: string): Promise<boolean> {
  let user: SiteUser | null;
  if (hasTurso()) {
    await initDb();
    user = await dbGetSiteUserByUsername(username);
  } else {
    user = memGetSiteUserByUsername(username);
  }

  if (!user) return false;
  return verifyPassword(password, user.salt, user.passwordHash);
}

export async function isSiteProtectionEnabled(): Promise<boolean> {
  if (hasTurso()) {
    await initDb();
    return dbGetSiteProtection();
  }
  return memGetSiteProtection();
}

export async function setSiteProtection(enabled: boolean): Promise<void> {
  if (hasTurso()) {
    await initDb();
    await dbSetSiteProtection(enabled);
  } else {
    memSetSiteProtection(enabled);
  }
}
