import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";
import bcrypt from "bcryptjs";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

type CookieCall = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

function createPublicContext(): { ctx: TrpcContext; setCookies: CookieCall[] } {
  const setCookies: CookieCall[] = [];

  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        setCookies.push({ name, value, options });
      },
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx, setCookies };
}

describe("auth.login", () => {
  const testEmail = "test-login@traderfoundation.com";
  const testPassword = "TestPassword123!";
  const testOpenId = `test-user-${Date.now()}`;

  beforeAll(async () => {
    // Create a test user with email/password
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const passwordHash = await bcrypt.hash(testPassword, 10);
    
    // Clean up any existing test user
    await db.delete(users).where(eq(users.email, testEmail));
    
    // Create test user with openId already set (no need to update after)
    await db.insert(users).values({
      email: testEmail,
      name: "Test Login User",
      passwordHash,
      role: "closer",
      permissions: JSON.stringify(["dashboard"]),
      openId: testOpenId,
    });
  });

  afterAll(async () => {
    // Clean up test user
    const db = await getDb();
    if (db) {
      await db.delete(users).where(eq(users.email, testEmail));
    }
  });

  it("successfully logs in with valid email and password", async () => {
    const { ctx, setCookies } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.login({
      email: testEmail,
      password: testPassword,
    });

    expect(result.success).toBe(true);
    expect(result.user.email).toBe(testEmail);
    expect(result.user.name).toBe("Test Login User");
    
    // Verify session cookie was set
    expect(setCookies).toHaveLength(1);
    expect(setCookies[0]?.name).toBe(COOKIE_NAME);
    expect(setCookies[0]?.value).toBeTruthy(); // JWT token
    expect(setCookies[0]?.options).toMatchObject({
      httpOnly: true,
      secure: true,
      path: "/",
    });
  });

  it("rejects login with invalid password", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({
        email: testEmail,
        password: "WrongPassword123!",
      })
    ).rejects.toThrow("Invalid email or password");
  });

  it("rejects login with non-existent email", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({
        email: "nonexistent@traderfoundation.com",
        password: testPassword,
      })
    ).rejects.toThrow("Invalid email or password");
  });

  it("handles case-insensitive email login", async () => {
    const { ctx, setCookies } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.login({
      email: testEmail.toUpperCase(),
      password: testPassword,
    });

    expect(result.success).toBe(true);
    expect(result.user.email).toBe(testEmail);
  });
});
