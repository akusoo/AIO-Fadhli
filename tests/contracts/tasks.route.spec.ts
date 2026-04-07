import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAuthedRouteContextMock, fromMock, insertMock } = vi.hoisted(() => {
  const insert = vi.fn();

  return {
    getAuthedRouteContextMock: vi.fn(),
    insertMock: insert,
    fromMock: vi.fn(() => ({
      insert,
    })),
  };
});

vi.mock("@/lib/server/routes", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/routes")>("@/lib/server/routes");
  return {
    ...actual,
    getAuthedRouteContext: getAuthedRouteContextMock,
  };
});

import { POST } from "@/app/api/tasks/route";

describe("POST /api/tasks", () => {
  beforeEach(() => {
    fromMock.mockClear();
    insertMock.mockReset();
    getAuthedRouteContextMock.mockReset();
  });

  it("returns 401/503 guards without mutating", async () => {
    getAuthedRouteContextMock.mockResolvedValue({
      error: NextResponse.json({ error: "Supabase belum dikonfigurasi di environment." }, { status: 503 }),
    });

    const response = await POST(
      new Request("http://localhost/api/tasks", {
        method: "POST",
        body: JSON.stringify({ title: "Task" }),
      }),
    );
    expect(response).toBeDefined();
    if (!response) {
      throw new Error("Expected a response");
    }

    expect(response.status).toBe(503);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("creates a task and returns item payload", async () => {
    insertMock.mockResolvedValue({ error: null });
    getAuthedRouteContextMock.mockResolvedValue({
      supabase: {
        from: fromMock,
      },
      user: { id: "user-1" },
      applyCookies: vi.fn(),
    });

    const response = await POST(
      new Request("http://localhost/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: "Task baru",
          priority: "high",
          clientId: "task-client",
        }),
      }),
    );
    expect(response).toBeDefined();
    if (!response) {
      throw new Error("Expected a response");
    }

    expect(response.status).toBe(200);
    expect(fromMock).toHaveBeenCalledWith("tasks");
    await expect(response.json()).resolves.toMatchObject({
      item: {
        id: "task-client",
        title: "Task baru",
        priority: "high",
      },
    });
  });

  it("maps insert errors to 400", async () => {
    insertMock.mockResolvedValue({ error: new Error("insert gagal") });
    getAuthedRouteContextMock.mockResolvedValue({
      supabase: {
        from: fromMock,
      },
      user: { id: "user-1" },
      applyCookies: vi.fn(),
    });

    const response = await POST(
      new Request("http://localhost/api/tasks", {
        method: "POST",
        body: JSON.stringify({ title: "Task gagal" }),
      }),
    );
    expect(response).toBeDefined();
    if (!response) {
      throw new Error("Expected a response");
    }

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "insert gagal" });
  });
});
