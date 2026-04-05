import { SiteUser } from "./types";
import fs from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "data", "local-auth.json");

function getAuthData() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch (e) {}
  return { users: [], protectionEnabled: false };
}

function saveAuthData(data: any) {
  try {
    if (!fs.existsSync(path.dirname(DATA_FILE))) fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {}
}

export function memGetSiteUsers(): SiteUser[] { return getAuthData().users; }
export function memGetSiteUserByUsername(username: string): SiteUser | null { return getAuthData().users.find((u: any) => u.username === username) ?? null; }
export function memAddSiteUser(user: SiteUser): void {
  const data = getAuthData();
  const existing = data.users.findIndex((u: any) => u.username === user.username);
  if (existing >= 0) data.users[existing] = user; else data.users.push(user);
  saveAuthData(data);
}
export function memRemoveSiteUser(username: string): void {
  const data = getAuthData();
  data.users = data.users.filter((u: any) => u.username !== username);
  saveAuthData(data);
}
