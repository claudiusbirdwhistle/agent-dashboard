/**
 * @jest-environment node
 */
import { tmpdir } from "os";
import { join } from "path";
import { writeFileSync, unlinkSync } from "fs";
import bcrypt from "bcrypt";

import { validateUser, loadUsers } from "../src/lib/auth";

const ORIG_USERS_FILE = process.env.USERS_FILE;

describe("auth library", () => {
  let usersFile: string;

  beforeEach(() => {
    usersFile = join(tmpdir(), `test-users-${Date.now()}.json`);
    process.env.USERS_FILE = usersFile;
  });

  afterEach(() => {
    try {
      unlinkSync(usersFile);
    } catch {}
    if (ORIG_USERS_FILE !== undefined) {
      process.env.USERS_FILE = ORIG_USERS_FILE;
    } else {
      delete process.env.USERS_FILE;
    }
  });

  describe("loadUsers", () => {
    it("returns empty object when file does not exist", () => {
      process.env.USERS_FILE = "/nonexistent/path/users.json";
      expect(loadUsers()).toEqual({});
    });

    it("loads users from an existing file", async () => {
      const hash = await bcrypt.hash("secret", 10);
      writeFileSync(usersFile, JSON.stringify({ alice: hash }));
      const users = loadUsers();
      expect(users).toHaveProperty("alice");
    });
  });

  describe("validateUser", () => {
    it("returns true for correct credentials", async () => {
      const hash = await bcrypt.hash("correct-pw", 10);
      writeFileSync(usersFile, JSON.stringify({ bob: hash }));
      await expect(validateUser("bob", "correct-pw")).resolves.toBe(true);
    });

    it("returns false for wrong password", async () => {
      const hash = await bcrypt.hash("correct-pw", 10);
      writeFileSync(usersFile, JSON.stringify({ bob: hash }));
      await expect(validateUser("bob", "wrong-pw")).resolves.toBe(false);
    });

    it("returns false for unknown user", async () => {
      writeFileSync(usersFile, JSON.stringify({}));
      await expect(validateUser("ghost", "any-pw")).resolves.toBe(false);
    });
  });
});
