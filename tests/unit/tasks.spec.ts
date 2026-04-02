import { describe, expect, it } from "vitest";
import {
  advanceRecurringTask,
  getDoneTodayTasks,
  getTaskSubtaskProgress,
  getTodayTasks,
  getUpcomingTasks,
  isTaskDueToday,
  isTaskInToday,
  isTaskOverdue,
  sortTasks,
} from "@/lib/tasks";
import { makeTask } from "../support/factories";

describe("tasks helpers", () => {
  it("detects due-today, overdue, and today inclusion states", () => {
    const dueToday = makeTask({ dueOn: "2026-04-02" });
    const overdue = makeTask({ dueOn: "2026-04-01" });

    expect(isTaskDueToday(dueToday, "2026-04-02")).toBe(true);
    expect(isTaskOverdue(overdue, "2026-04-02")).toBe(true);
    expect(isTaskInToday(dueToday, "2026-04-02")).toBe(true);
  });

  it("sorts tasks by date, time, priority, and title", () => {
    const ordered = [
      makeTask({ id: "b", title: "Beta", dueOn: "2026-04-01", startTime: "09:00" }),
      makeTask({ id: "a", title: "Alpha", dueOn: "2026-04-01", startTime: "12:00" }),
      makeTask({ id: "c", title: "Gamma", dueOn: "2026-04-02", priority: "high" }),
      makeTask({ id: "d", title: "Delta", dueOn: undefined }),
    ].sort(sortTasks);

    expect(ordered.map((task) => task.id)).toEqual(["b", "a", "c", "d"]);
  });

  it("advances recurring tasks and clears done state", () => {
    const task = makeTask({
      dueOn: "2026-04-02",
      reminderAt: "2026-04-02T08:00",
      todayPinned: true,
      status: "done",
      completedAt: "2026-04-02T10:00",
      recurring: {
        cadence: "weekly",
        interval: 2,
      },
    });

    advanceRecurringTask(task);

    expect(task.dueOn).toBe("2026-04-16");
    expect(task.reminderAt).toBe("2026-04-16T08:00");
    expect(task.status).toBe("todo");
    expect(task.todayPinned).toBe(false);
    expect(task.completedAt).toBeUndefined();
  });

  it("filters today, upcoming, and done-today buckets", () => {
    const tasks = [
      makeTask({ id: "today", dueOn: "2026-04-02" }),
      makeTask({ id: "future", dueOn: "2026-04-04" }),
      makeTask({ id: "done", status: "done", completedAt: "2026-04-02T11:00" }),
    ];

    expect(getTodayTasks(tasks, "2026-04-02").map((task) => task.id)).toEqual(["today"]);
    expect(getUpcomingTasks(tasks, "2026-04-02").map((task) => task.id)).toEqual([
      "today",
      "future",
    ]);
    expect(getDoneTodayTasks(tasks, "2026-04-02").map((task) => task.id)).toEqual(["done"]);
  });

  it("computes subtask progress for a task", () => {
    expect(
      getTaskSubtaskProgress("task-1", [
        { id: "s1", taskId: "task-1", title: "A", done: true },
        { id: "s2", taskId: "task-1", title: "B", done: false },
        { id: "s3", taskId: "task-2", title: "C", done: true },
      ]),
    ).toEqual({
      total: 2,
      done: 1,
    });
  });
});
