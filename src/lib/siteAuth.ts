/**
 * In-memory site auth store (local dev fallback).
 * Mirrors the pattern in sources.ts — resets on server restart.
 */

import { SiteUser } from "./types";

let memUsers: SiteUser[] = [];
let memProtectionEnabled = false;

export function memGetSiteUsers(): SiteUser[] {
  return [...memUsers];
}

export function memGetSiteUserByUsername(username: string): SiteUser | null {
  return memUsers.find((u) => u.username === username) ?? null;
}

export function memAddSiteUser(user: SiteUser): void {
  const existing = memUsers.findIndex((u) => u.username === user.username);
  if (existing >= 0) {
    memUsers[existing] = user;
  } else {
    memUsers.push(user);
  }
}

export function memRemoveSiteUser(username: string): void {
  memUsers = memUsers.filter((u) => u.username !== username);
}

export function memGetSiteProtection(): boolean {
  return memProtectionEnabled;
}

export function memSetSiteProtection(enabled: boolean): void {
  memProtectionEnabled = enabled;
}
