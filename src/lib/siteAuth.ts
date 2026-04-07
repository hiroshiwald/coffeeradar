import { SiteUser } from "./types";
import fs from "fs";
import path from "path";
import { logger } from "./logger";

const DATA_FILE = path.join(process.cwd(), "data", "local-auth.json");

interface AuthData {
  users: SiteUser[];
  protectionEnabled: boolean;
}

function isAuthData(value: unknown): value is AuthData {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return Array.isArray(obj.users);
}

function emptyAuthData(): AuthData {
  return { users: [], protectionEnabled: false };
}

function getAuthData(): AuthData {
  try {
    if (!fs.existsSync(DATA_FILE)) return emptyAuthData();
    const parsed: unknown = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    if (!isAuthData(parsed)) return emptyAuthData();
    return {
      users: parsed.users,
      protectionEnabled: !!parsed.protectionEnabled,
    };
  } catch (err) {
    logger.warn("siteAuth: failed to read local-auth.json", { err });
    return emptyAuthData();
  }
}

function saveAuthData(data: AuthData): void {
  try {
    if (!fs.existsSync(path.dirname(DATA_FILE))) {
      fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    logger.warn("siteAuth: failed to write local-auth.json", { err });
  }
}

export function memGetSiteUsers(): SiteUser[] {
  return getAuthData().users;
}

export function memGetSiteUserByUsername(username: string): SiteUser | null {
  return getAuthData().users.find((u) => u.username === username) ?? null;
}

export function memAddSiteUser(user: SiteUser): void {
  const data = getAuthData();
  const existing = data.users.findIndex((u) => u.username === user.username);
  if (existing >= 0) data.users[existing] = user;
  else data.users.push(user);
  saveAuthData(data);
}

export function memRemoveSiteUser(username: string): void {
  const data = getAuthData();
  data.users = data.users.filter((u) => u.username !== username);
  saveAuthData(data);
}

// Exported for tests.
export const __testing = { isAuthData };
