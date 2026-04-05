import { SiteUser } from "./types";

const globalAuth = globalThis as unknown as {
  memUsers: SiteUser[];
  memProtectionEnabled: boolean;
};

if (!globalAuth.memUsers) {
  globalAuth.memUsers = [];
}
if (globalAuth.memProtectionEnabled === undefined) {
  globalAuth.memProtectionEnabled = false;
}

export function memGetSiteUsers(): SiteUser[] {
  return [...globalAuth.memUsers];
}

export function memGetSiteUserByUsername(username: string): SiteUser | null {
  return globalAuth.memUsers.find((u) => u.username === username) ?? null;
}

export function memAddSiteUser(user: SiteUser): void {
  const existing = globalAuth.memUsers.findIndex((u) => u.username === user.username);
  if (existing >= 0) {
    globalAuth.memUsers[existing] = user;
  } else {
    globalAuth.memUsers.push(user);
  }
}

export function memRemoveSiteUser(username: string): void {
  globalAuth.memUsers = globalAuth.memUsers.filter((u) => u.username !== username);
}

export function memGetSiteProtection(): boolean {
  return globalAuth.memProtectionEnabled;
}

export function memSetSiteProtection(enabled: boolean): void {
  globalAuth.memProtectionEnabled = enabled;
}
