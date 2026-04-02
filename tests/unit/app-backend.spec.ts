import { describe, expect, it, vi } from "vitest";
import { ensureUserBootstrap } from "@/lib/server/app-backend";

type MockError = {
  message: string;
  code?: string;
} | null;

function createSupabaseMock(profileErrors: MockError[]) {
  let profileUpsertCalls = 0;

  return {
    supabase: {
      from(table: string) {
        if (table === "profiles") {
          return {
            select() {
              return {
                eq() {
                  return {
                    maybeSingle: async () => ({ data: null, error: null }),
                  };
                },
              };
            },
            upsert: async () => {
              const error = profileErrors[profileUpsertCalls] ?? null;
              profileUpsertCalls += 1;
              return { error };
            },
          };
        }

        return {
          select() {
            return {
              eq() {
                return {
                  is() {
                    return {
                      limit: async () => ({ data: [{ id: `${table}-existing` }], error: null }),
                    };
                  },
                };
              },
            };
          },
          upsert: async () => ({ error: null }),
        };
      },
    } as never,
    getProfileUpsertCalls() {
      return profileUpsertCalls;
    },
  };
}

describe("app backend bootstrap", () => {
  it("retries transient profile foreign key errors before succeeding", async () => {
    vi.useFakeTimers();

    const mock = createSupabaseMock([
      {
        message: 'insert or update on table "profiles" violates foreign key constraint "profiles_id_fkey"',
        code: "23503",
      },
      null,
    ]);

    const promise = ensureUserBootstrap(mock.supabase, {
      id: "user-1",
      email: "user@example.com",
      user_metadata: { name: "User Example" },
    } as never);

    await vi.runAllTimersAsync();
    await promise;

    expect(mock.getProfileUpsertCalls()).toBe(2);
  });

  it("fails fast for non-retryable profile errors", async () => {
    const mock = createSupabaseMock([
      {
        message: "permission denied for table profiles",
        code: "42501",
      },
    ]);

    await expect(
      ensureUserBootstrap(mock.supabase, {
        id: "user-1",
        email: "user@example.com",
        user_metadata: { name: "User Example" },
      } as never),
    ).rejects.toThrow("permission denied for table profiles");

    expect(mock.getProfileUpsertCalls()).toBe(1);
  });
});
