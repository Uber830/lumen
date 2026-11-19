import { describe, expect, it } from "vitest";

import { generatePassword } from "@/lib/auth/password";

describe("generatePassword", () => {
  it("returns a string of the requested length", () => {
    expect(generatePassword({ length: 12 }).length).toBe(12);
    expect(generatePassword({ length: 32 }).length).toBe(32);
  });

  it("clamps lengths below the zod minimum to 8", () => {
    expect(generatePassword({ length: 4 }).length).toBe(8);
    expect(generatePassword({ length: 0 }).length).toBe(8);
    expect(generatePassword({ length: -5 }).length).toBe(8);
  });

  it("clamps lengths above the zod maximum to 128", () => {
    expect(generatePassword({ length: 999 }).length).toBe(128);
    expect(generatePassword({ length: 1000 }).length).toBe(128);
  });

  it("defaults to 18 characters when no length is given", () => {
    expect(generatePassword().length).toBe(18);
  });

  it("always contains at least one lowercase letter", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generatePassword()).toMatch(/[a-z]/);
    }
  });

  it("always contains at least one uppercase letter", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generatePassword()).toMatch(/[A-Z]/);
    }
  });

  it("always contains at least one digit", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generatePassword()).toMatch(/[0-9]/);
    }
  });

  it("always contains at least one symbol", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generatePassword()).toMatch(/[!@#$%^&*()\-_=+[\]{};:,.<>?/]/);
    }
  });

  it("avoids the ambiguous chars 0 O 1 l I by default", () => {
    for (let i = 0; i < 50; i += 1) {
      const pwd = generatePassword();
      expect(pwd).not.toMatch(/[0O1lI|`'"]/);
    }
  });

  it("includes ambiguous chars when avoidAmbiguous is false", () => {
    let foundAmbiguous = false;
    for (let i = 0; i < 200; i += 1) {
      const pwd = generatePassword({ avoidAmbiguous: false });
      if (/[0O1lI|`'"]/.test(pwd)) {
        foundAmbiguous = true;
        break;
      }
    }
    expect(foundAmbiguous).toBe(true);
  });

  it("produces different values across consecutive calls", () => {
    const samples = new Set<string>();
    for (let i = 0; i < 20; i += 1) {
      samples.add(generatePassword({ length: 16 }));
    }
    // At 16 characters the collision probability is negligible.
    expect(samples.size).toBe(20);
  });
});
