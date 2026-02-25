import bcrypt from "bcrypt";
import fs from "fs";

export type UserMap = Record<string, string>;

const defaultUsersFile = "/state/dashboard-users.json";

export function loadUsers(): UserMap {
  const file = process.env.USERS_FILE ?? defaultUsersFile;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as UserMap;
  } catch {
    return {};
  }
}

export async function validateUser(
  username: string,
  password: string
): Promise<boolean> {
  const users = loadUsers();
  const hash = users[username];
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}
