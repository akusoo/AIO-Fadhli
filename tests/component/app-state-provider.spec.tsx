import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AddTransactionInput, AppSnapshot } from "@/lib/domain/models";
import { AppStateProvider, useAppState } from "@/providers/app-state-provider";
import { cloneSnapshot, makeExpenseInput } from "../support/factories";

const CACHE_KEY = "aio-personal-tracker-cache-v1";
const OUTBOX_KEY = "aio-personal-tracker-outbox-v1";

function createBootSnapshot(overrides: Partial<AppSnapshot> = {}) {
  return {
    ...cloneSnapshot(),
    ...overrides,
  } satisfies AppSnapshot;
}

function createJsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
    },
    ...init,
  });
}

function TestHarness() {
  const { addTransaction, isHydrated, snapshot } = useAppState();
  const [error, setError] = useState("");

  async function handleAdd() {
    try {
      await addTransaction({
        ...makeExpenseInput(),
      } satisfies AddTransactionInput);
    } catch (value) {
      setError(value instanceof Error ? value.message : "unknown");
    }
  }

  return (
    <div>
      <div data-testid="hydrated">{String(isHydrated)}</div>
      <div data-testid="first-task">{snapshot.tasks[0]?.title ?? ""}</div>
      <div data-testid="first-transaction">{snapshot.transactions[0]?.title ?? ""}</div>
      <div data-testid="transaction-count">{snapshot.transactions.length}</div>
      <div data-testid="error">{error}</div>
      <button onClick={() => void handleAdd()} type="button">
        Tambah transaksi
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <AppStateProvider>
      <TestHarness />
    </AppStateProvider>,
  );
}

describe("AppStateProvider", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("boots from backend snapshot", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        snapshot: createBootSnapshot({
          tasks: [{ id: "task-boot", title: "Task dari backend", status: "todo", priority: "medium" }],
        }),
      }),
    );

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("hydrated")).toHaveTextContent("true"));
    expect(screen.getByTestId("first-task")).toHaveTextContent("Task dari backend");
  });

  it("hydrates cached snapshot before server refresh lands", async () => {
    const cachedSnapshot = createBootSnapshot({
      tasks: [{ id: "task-cache", title: "Task cache", status: "todo", priority: "medium" }],
    });
    const deferred = Promise.withResolvers<Response>();

    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cachedSnapshot));
    vi.spyOn(globalThis, "fetch").mockReturnValue(deferred.promise);

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("first-task")).toHaveTextContent("Task cache"));

    deferred.resolve(
      createJsonResponse({
        snapshot: createBootSnapshot({
          tasks: [{ id: "task-server", title: "Task server", status: "todo", priority: "medium" }],
        }),
      }),
    );

    await waitFor(() => expect(screen.getByTestId("first-task")).toHaveTextContent("Task server"));
  });

  it("queues optimistic mutation to outbox when browser is offline", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(createJsonResponse({ snapshot: createBootSnapshot() }))
      .mockRejectedValueOnce(new TypeError("Network down"));

    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("hydrated")).toHaveTextContent("true"));
    fireEvent.click(screen.getByRole("button", { name: "Tambah transaksi" }));

    await waitFor(() => {
      const outbox = JSON.parse(window.localStorage.getItem(OUTBOX_KEY) ?? "[]") as Array<{
        url: string;
      }>;

      expect(outbox).toHaveLength(1);
      expect(outbox[0]?.url).toBe("/api/finance/transactions");
      expect(screen.getByTestId("first-transaction")).toHaveTextContent("Belanja test");
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("flushes queued mutations after the browser comes back online", async () => {
    const flushedSnapshot = createBootSnapshot({
      transactions: [
        {
          id: "trx-flushed",
          title: "Belanja test",
          kind: "expense",
          amount: 125_000,
          occurredOn: "2026-04-02",
          accountId: "acct-bca",
          categoryId: "cat-food",
          cycleId: "cycle-01",
          tags: ["shopping"],
        },
      ],
    });

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(createJsonResponse({ snapshot: createBootSnapshot() }))
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(createJsonResponse({ snapshot: flushedSnapshot }));

    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("hydrated")).toHaveTextContent("true"));
    fireEvent.click(screen.getByRole("button", { name: "Tambah transaksi" }));

    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(OUTBOX_KEY) ?? "[]")).toHaveLength(1));

    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
    window.dispatchEvent(new Event("online"));

    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(OUTBOX_KEY) ?? "[]")).toHaveLength(0));
    expect(screen.getByTestId("first-transaction")).toHaveTextContent("Belanja test");
  });

  it("rolls back optimistic state when server rejects mutation and refreshes snapshot", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(createJsonResponse({ snapshot: createBootSnapshot() }))
      .mockResolvedValueOnce(createJsonResponse({ error: "Mutasi gagal." }, { status: 400 }))
      .mockResolvedValueOnce(createJsonResponse({ snapshot: createBootSnapshot() }));

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("hydrated")).toHaveTextContent("true"));
    fireEvent.click(screen.getByRole("button", { name: "Tambah transaksi" }));

    await waitFor(() => {
      expect(screen.getByTestId("error")).toHaveTextContent("Mutasi gagal.");
      expect(screen.getByTestId("first-transaction")).not.toHaveTextContent("Belanja test");
    });
  });
});
