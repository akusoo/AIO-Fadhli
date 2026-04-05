"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CalendarDays,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Pin,
  Plus,
  Search,
  X,
} from "lucide-react";
import {
  ActionButton,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Pill,
  SectionCard,
  Select,
  Textarea,
} from "@/components/ui";
import type {
  Priority,
  Subtask,
  Task,
  TaskRecurringCadence,
  TaskStatus,
  UpdateTaskInput,
} from "@/lib/domain/models";
import {
  getDoneTodayTasks,
  getTaskSubtaskProgress,
  getTodayTasks,
  getUpcomingTasks,
  isTaskDueToday,
  isTaskOverdue,
  isTaskPinnedToday,
  isTaskReminderToday,
  sortTasks,
} from "@/lib/tasks";
import { useAppState } from "@/providers/app-state-provider";
import { cn, formatDate, isoToday } from "@/lib/utils";

type TaskFilter = "today" | "upcoming" | "all" | "done";
type UpcomingView = "list" | "calendar";
type TaskDraft = {
  title: string;
  status: TaskStatus;
  priority: Priority;
  dueOn: string;
  projectId: string;
  todayPinned: boolean;
  note: string;
  startTime: string;
  dueTime: string;
  reminderAt: string;
  recurringCadence: "none" | TaskRecurringCadence;
  recurringInterval: string;
};

const filterOrder: Array<{ id: TaskFilter; label: string; detail: string }> = [
  { id: "today", label: "Today", detail: "fokus dan prioritas hari ini" },
  { id: "upcoming", label: "Upcoming", detail: "rencana dan kalender deadline" },
  { id: "all", label: "All tasks", detail: "semua task aktif lintas konteks" },
  { id: "done", label: "Done", detail: "task selesai dan hasil kerja" },
];

const weekDayLabels = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function shiftMonth(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function isoDateFromParts(year: number, monthIndex: number, day: number) {
  return `${year}-${padDatePart(monthIndex + 1)}-${padDatePart(day)}`;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function priorityTone(priority: Priority) {
  return {
    high: "rose",
    medium: "amber",
    low: "neutral",
  }[priority] as "rose" | "amber" | "neutral";
}

function statusLabel(status: TaskStatus) {
  return {
    todo: "to do",
    doing: "doing",
    done: "done",
  }[status];
}

function statusTone(status: TaskStatus) {
  return {
    todo: "mint",
    doing: "amber",
    done: "neutral",
  }[status] as "mint" | "amber" | "neutral";
}

function buildTaskMeta(task: Task, projectName?: string) {
  const parts: string[] = [];

  if (projectName) {
    parts.push(projectName);
  } else {
    parts.push("Task standalone");
  }

  if (task.dueOn) {
    parts.push(`due ${formatDate(task.dueOn)}`);
  }

  if (task.startTime || task.dueTime) {
    parts.push(
      task.startTime && task.dueTime
        ? `${task.startTime} - ${task.dueTime}`
        : task.startTime
          ? `mulai ${task.startTime}`
          : `target ${task.dueTime}`,
    );
  }

  if (task.reminderAt) {
    parts.push(`ingatkan ${task.reminderAt.slice(11, 16)}`);
  }

  return parts.join(" • ");
}

function matchesTaskQuery(task: Task, projectName: string | undefined, query: string) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return [
    task.title,
    task.note ?? "",
    projectName ?? "",
    task.dueOn ?? "",
    task.startTime ?? "",
    task.dueTime ?? "",
  ].some((value) => value.toLowerCase().includes(normalized));
}

function createTaskDraft(task?: Task): TaskDraft {
  return {
    title: task?.title ?? "",
    status: task?.status ?? "todo",
    priority: task?.priority ?? "medium",
    dueOn: task?.dueOn ?? "",
    projectId: task?.projectId ?? "",
    todayPinned: task?.todayPinned ?? false,
    note: task?.note ?? "",
    startTime: task?.startTime ?? "",
    dueTime: task?.dueTime ?? "",
    reminderAt: task?.reminderAt ?? "",
    recurringCadence: task?.recurring?.cadence ?? "none",
    recurringInterval: task?.recurring?.interval ? String(task.recurring.interval) : "1",
  };
}

function FilterButton({
  active,
  count,
  label,
  detail,
  onClick,
}: {
  active: boolean;
  count: number;
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex w-full items-start justify-between gap-3 rounded-[18px] px-3 py-3 text-left transition-colors",
        active
          ? "bg-[var(--accent-strong)] text-white"
          : "text-[var(--foreground)] hover:bg-white/72",
      )}
      onClick={onClick}
      type="button"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <p className={cn("mt-1 text-xs", active ? "text-white/72" : "text-[var(--muted)]")}>
          {detail}
        </p>
      </div>
      <span
        className={cn(
          "rounded-full px-2.5 py-1 text-xs font-medium",
          active ? "bg-white/12 text-white" : "bg-[var(--surface)] text-[var(--accent-strong)]",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function SubtaskRow({
  subtask,
  onToggle,
  onSave,
}: {
  subtask: Subtask;
  onToggle: () => void;
  onSave: (input: { title: string; note: string }) => void;
}) {
  const [title, setTitle] = useState(subtask.title);
  const [note, setNote] = useState(subtask.note ?? "");

  return (
    <div className="py-4">
      <div className="flex items-start gap-3">
        <label className="mt-1 inline-flex items-center">
          <input
            checked={subtask.done}
            className="size-4 accent-[var(--accent-strong)]"
            onChange={onToggle}
            type="checkbox"
          />
        </label>
        <div className="min-w-0 flex-1 space-y-3">
          <Input
            onChange={(event) => setTitle(event.target.value)}
            value={title}
          />
          <Input
            onChange={(event) => setNote(event.target.value)}
            placeholder="Catatan kecil untuk subtask ini"
            value={note}
          />
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <ActionButton onClick={() => onSave({ title, note })} variant="ghost">
          Simpan subtask
        </ActionButton>
      </div>
    </div>
  );
}

function TaskCard({
  task,
  projectName,
  progress,
  onOpen,
  onDone,
  onTogglePin,
}: {
  task: Task;
  projectName?: string;
  progress: { done: number; total: number };
  onOpen: () => void;
  onDone: () => void;
  onTogglePin: () => void;
}) {
  return (
    <div className="py-4" data-testid={`task-card-${task.id}`}>
      <div className="flex items-start justify-between gap-3">
        <button className="min-w-0 flex-1 text-left" onClick={onOpen} type="button">
          <div className="flex flex-wrap items-start gap-2">
            <p className="min-w-0 max-w-full font-semibold [overflow-wrap:anywhere]">
              {task.title}
            </p>
            <Pill tone={priorityTone(task.priority)}>{task.priority}</Pill>
            <Pill tone={statusTone(task.status)}>{statusLabel(task.status)}</Pill>
            {task.todayPinned ? <Pill tone="mint">pinned</Pill> : null}
          </div>
          <p className="mt-2 text-sm text-[var(--muted)]">{buildTaskMeta(task, projectName)}</p>
          {progress.total ? (
            <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              {progress.done} / {progress.total} subtask selesai
            </p>
          ) : null}
        </button>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {task.status !== "done" ? (
            <button
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium text-[var(--accent-strong)] hover:bg-[var(--accent-soft)]"
              onClick={onDone}
              type="button"
            >
              <CheckCheck className="size-4" strokeWidth={2.2} />
              Selesai
            </button>
          ) : null}
          <button
            className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface)]"
            onClick={onTogglePin}
            type="button"
          >
            <Pin className="size-3.5" strokeWidth={2.2} />
            {task.todayPinned ? "Lepas today" : "Pin ke today"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TasksPage() {
  const {
    snapshot,
    addSubtask,
    addTask,
    moveTask,
    toggleSubtask,
    toggleTodayPin,
    updateSubtask,
    updateTask,
  } = useAppState();
  const [filter, setFilter] = useState<TaskFilter>("today");
  const [upcomingView, setUpcomingView] = useState<UpcomingView>("calendar");
  const [quickTitle, setQuickTitle] = useState("");
  const [query, setQuery] = useState("");
  const [quickFeedback, setQuickFeedback] = useState("");
  const [showTodayDone, setShowTodayDone] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(snapshot.tasks[0]?.id ?? "");
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => getMonthStart(new Date(isoToday())));
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(isoToday());
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [draft, setDraft] = useState<TaskDraft>(createTaskDraft(snapshot.tasks[0]));

  const sortedTasks = useMemo(() => [...snapshot.tasks].sort(sortTasks), [snapshot.tasks]);

  useEffect(() => {
    if (!sortedTasks.length) {
      setSelectedTaskId("");
      return;
    }

    if (!sortedTasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(sortedTasks[0].id);
    }
  }, [selectedTaskId, sortedTasks]);

  const selectedTask = useMemo(
    () => sortedTasks.find((task) => task.id === selectedTaskId) ?? sortedTasks[0],
    [selectedTaskId, sortedTasks],
  );

  useEffect(() => {
    setDraft(createTaskDraft(selectedTask));
  }, [selectedTask]);

  const selectedTaskSubtasks = useMemo(
    () => snapshot.subtasks.filter((subtask) => subtask.taskId === selectedTask?.id),
    [selectedTask?.id, snapshot.subtasks],
  );

  const todayTasks = useMemo(() => getTodayTasks(snapshot.tasks), [snapshot.tasks]);
  const doneTodayTasks = useMemo(() => getDoneTodayTasks(snapshot.tasks), [snapshot.tasks]);
  const overdueTodayTasks = todayTasks.filter((task) => isTaskOverdue(task));
  const dueTodayTasks = todayTasks.filter(
    (task) => !isTaskOverdue(task) && (isTaskDueToday(task) || isTaskReminderToday(task)),
  );
  const pinnedTodayTasks = todayTasks.filter(
    (task) =>
      !isTaskOverdue(task) &&
      !isTaskDueToday(task) &&
      !isTaskReminderToday(task) &&
      isTaskPinnedToday(task),
  );
  const upcomingTasks = useMemo(
    () =>
      getUpcomingTasks(snapshot.tasks).filter(
        (task) => Boolean(task.dueOn && task.dueOn > isoToday()),
      ),
    [snapshot.tasks],
  );
  const allActiveTasks = useMemo(
    () => sortedTasks.filter((task) => task.status !== "done"),
    [sortedTasks],
  );
  const doneTasks = useMemo(
    () =>
      sortedTasks
        .filter((task) => task.status === "done")
        .sort((left, right) => (right.completedAt ?? "").localeCompare(left.completedAt ?? "")),
    [sortedTasks],
  );

  const filterCounts = {
    today: todayTasks.length + doneTodayTasks.length,
    upcoming: upcomingTasks.length,
    all: allActiveTasks.length,
    done: doneTasks.length,
  };

  const calendarTasks = useMemo(
    () => snapshot.tasks.filter((task) => task.dueOn && task.status !== "done").sort(sortTasks),
    [snapshot.tasks],
  );

  const calendarEventsByDate = useMemo(() => {
    const map = new Map<string, Task[]>();

    calendarTasks.forEach((task) => {
      if (!task.dueOn) {
        return;
      }

      const existing = map.get(task.dueOn) ?? [];
      existing.push(task);
      map.set(task.dueOn, existing);
    });

    return map;
  }, [calendarTasks]);

  const calendarMonthCells = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const monthIndex = visibleMonth.getMonth();
    const firstDayOfMonth = new Date(year, monthIndex, 1);
    const startWeekday = firstDayOfMonth.getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const daysInPreviousMonth = new Date(year, monthIndex, 0).getDate();

    return Array.from({ length: 42 }, (_, index) => {
      const relativeDay = index - startWeekday + 1;

      if (relativeDay <= 0) {
        const date = shiftMonth(visibleMonth, -1);
        const day = daysInPreviousMonth + relativeDay;
        const iso = isoDateFromParts(date.getFullYear(), date.getMonth(), day);

        return {
          iso,
          day,
          isCurrentMonth: false,
          isToday: iso === isoToday(),
          isSelected: iso === selectedCalendarDate,
          tasks: calendarEventsByDate.get(iso) ?? [],
        };
      }

      if (relativeDay > daysInMonth) {
        const date = shiftMonth(visibleMonth, 1);
        const day = relativeDay - daysInMonth;
        const iso = isoDateFromParts(date.getFullYear(), date.getMonth(), day);

        return {
          iso,
          day,
          isCurrentMonth: false,
          isToday: iso === isoToday(),
          isSelected: iso === selectedCalendarDate,
          tasks: calendarEventsByDate.get(iso) ?? [],
        };
      }

      const iso = isoDateFromParts(year, monthIndex, relativeDay);

      return {
        iso,
        day: relativeDay,
        isCurrentMonth: true,
        isToday: iso === isoToday(),
        isSelected: iso === selectedCalendarDate,
        tasks: calendarEventsByDate.get(iso) ?? [],
      };
    });
  }, [calendarEventsByDate, selectedCalendarDate, visibleMonth]);

  const selectedCalendarTasks = useMemo(
    () => calendarEventsByDate.get(selectedCalendarDate) ?? [],
    [calendarEventsByDate, selectedCalendarDate],
  );

  async function handleQuickCapture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!quickTitle.trim()) {
      return;
    }

    const createdTask = await addTask({
      title: quickTitle.trim(),
      todayPinned: filter === "today",
    });

    setQuickTitle("");
    setQuickFeedback("Task baru masuk dan siap dirapikan di detail panel.");
    setSelectedTaskId(createdTask.id);
    setMobileDetailOpen(true);
  }

  async function handleSaveTaskDetail() {
    if (!selectedTask) {
      return;
    }

    const input: UpdateTaskInput = {
      taskId: selectedTask.id,
      title: draft.title,
      status: draft.status,
      priority: draft.priority,
      dueOn: draft.dueOn || undefined,
      projectId: draft.projectId || undefined,
      todayPinned: draft.todayPinned,
      note: draft.note || undefined,
      startTime: draft.startTime || undefined,
      dueTime: draft.dueTime || undefined,
      reminderAt: draft.reminderAt || undefined,
      recurring:
        draft.recurringCadence === "none"
          ? undefined
          : {
              cadence: draft.recurringCadence,
              interval: Number(draft.recurringInterval) || 1,
            },
      completedAt: selectedTask.completedAt,
    };

    await updateTask(input);
    setQuickFeedback("Detail task tersimpan.");
  }

  async function handleAddSubtask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedTask || !newSubtaskTitle.trim()) {
      return;
    }

    await addSubtask({
      taskId: selectedTask.id,
      title: newSubtaskTitle.trim(),
    });
    setNewSubtaskTitle("");
  }

  function openTaskDetail(taskId: string) {
    setSelectedTaskId(taskId);
    setMobileDetailOpen(true);
  }

  function renderTaskList(tasks: Task[], emptyTitle: string, emptyDescription: string) {
    const visibleTasks = tasks.filter((task) => {
      const project = snapshot.projects.find((item) => item.id === task.projectId);
      return matchesTaskQuery(task, project?.name, query);
    });

    if (!visibleTasks.length) {
      return (
        <EmptyState
          description={
            query
              ? "Tidak ada task yang cocok dengan pencarian saat ini."
              : emptyDescription
          }
          title={query ? "Tidak ada task yang cocok" : emptyTitle}
        />
      );
    }

    return (
      <div className="divide-y divide-[var(--border)]">
        {visibleTasks.map((task) => {
          const project = snapshot.projects.find((item) => item.id === task.projectId);
          const progress = getTaskSubtaskProgress(task.id, snapshot.subtasks);

          return (
            <TaskCard
              key={task.id}
              onDone={() => {
                void moveTask(task.id, "done");
              }}
              onOpen={() => openTaskDetail(task.id)}
              onTogglePin={() => {
                void toggleTodayPin(task.id);
              }}
              progress={progress}
              projectName={project?.name}
              task={task}
            />
          );
        })}
      </div>
    );
  }

  const detailPanel = selectedTask ? (
    <div className="space-y-5">
      <div className="border-b border-[var(--border)] pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={priorityTone(selectedTask.priority)}>{selectedTask.priority}</Pill>
          <Pill tone={statusTone(selectedTask.status)}>{statusLabel(selectedTask.status)}</Pill>
          {selectedTask.recurring ? <Pill tone="amber">{selectedTask.recurring.cadence}</Pill> : null}
        </div>
        <p className="mt-3 text-lg font-semibold">{selectedTask.title}</p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {buildTaskMeta(
            selectedTask,
            snapshot.projects.find((item) => item.id === selectedTask.projectId)?.name,
          )}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Judul task">
          <Input
            onChange={(event) =>
              setDraft((current) => ({ ...current, title: event.target.value }))
            }
            value={draft.title}
          />
        </Field>
        <Field label="Status">
          <Select
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                status: event.target.value as TaskStatus,
              }))
            }
            value={draft.status}
          >
            <option value="todo">to do</option>
            <option value="doing">doing</option>
            <option value="done">done</option>
          </Select>
        </Field>
        <Field label="Prioritas">
          <Select
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                priority: event.target.value as Priority,
              }))
            }
            value={draft.priority}
          >
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </Select>
        </Field>
        <Field label="Masuk project?">
          <Select
            onChange={(event) =>
              setDraft((current) => ({ ...current, projectId: event.target.value }))
            }
            value={draft.projectId}
          >
            <option value="">Task standalone</option>
            {snapshot.projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Due date">
          <Input
            onChange={(event) =>
              setDraft((current) => ({ ...current, dueOn: event.target.value }))
            }
            type="date"
            value={draft.dueOn}
          />
        </Field>
        <Field label="Reminder">
          <Input
            onChange={(event) =>
              setDraft((current) => ({ ...current, reminderAt: event.target.value }))
            }
            type="datetime-local"
            value={draft.reminderAt}
          />
        </Field>
        <Field label="Jam mulai">
          <Input
            onChange={(event) =>
              setDraft((current) => ({ ...current, startTime: event.target.value }))
            }
            type="time"
            value={draft.startTime}
          />
        </Field>
        <Field label="Jam target selesai">
          <Input
            onChange={(event) =>
              setDraft((current) => ({ ...current, dueTime: event.target.value }))
            }
            type="time"
            value={draft.dueTime}
          />
        </Field>
        <Field label="Recurring">
          <Select
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                recurringCadence: event.target.value as TaskDraft["recurringCadence"],
              }))
            }
            value={draft.recurringCadence}
          >
            <option value="none">Tidak berulang</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </Select>
        </Field>
        <Field label="Interval recurring">
          <Input
            inputMode="numeric"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                recurringInterval: event.target.value.replace(/\D/g, "") || "1",
              }))
            }
            type="text"
            value={draft.recurringInterval}
          />
        </Field>
      </div>

      <Field label="Catatan task">
        <Textarea
          onChange={(event) =>
            setDraft((current) => ({ ...current, note: event.target.value }))
          }
          placeholder="Catatan utama untuk task ini"
          value={draft.note}
        />
      </Field>

      <div className="flex flex-wrap gap-3">
        <ActionButton onClick={() => void handleSaveTaskDetail()}>
          Simpan detail
        </ActionButton>
        <ActionButton
          onClick={() => {
            void toggleTodayPin(selectedTask.id);
          }}
          variant="secondary"
        >
          {selectedTask.todayPinned ? "Lepas dari today" : "Pin ke today"}
        </ActionButton>
        <ActionButton
          onClick={() => {
            void moveTask(
              selectedTask.id,
              selectedTask.status === "done" ? "todo" : "done",
            );
          }}
          variant="ghost"
        >
          {selectedTask.status === "done" ? "Kembalikan ke todo" : "Tandai selesai"}
        </ActionButton>
      </div>

      <div className="border-t border-[var(--border)] pt-5">
        <div className="mb-4">
          <h3 className="text-base font-semibold">Subtasks</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Subtasks membantu memecah task besar tanpa memaksa masuk project board.
          </p>
        </div>
        <div className="space-y-1">
          {selectedTaskSubtasks.length === 0 ? (
            <EmptyState
              description="Task ini belum punya langkah turunan."
              title="Belum ada subtask"
            />
          ) : null}
          {selectedTaskSubtasks.map((subtask) => (
            <SubtaskRow
              key={`${subtask.id}-${subtask.title}-${subtask.note ?? ""}-${subtask.done}`}
              onSave={({ title, note }) => {
                void updateSubtask({
                  subtaskId: subtask.id,
                  title,
                  note: note || undefined,
                });
              }}
              onToggle={() => {
                void toggleSubtask(subtask.id);
              }}
              subtask={subtask}
            />
          ))}
          <form className="flex flex-wrap gap-3" onSubmit={handleAddSubtask}>
            <Input
              className="min-w-[240px] flex-1"
              onChange={(event) => setNewSubtaskTitle(event.target.value)}
              placeholder="Tambah subtask baru"
              value={newSubtaskTitle}
            />
            <ActionButton type="submit">
              <Plus className="mr-2 size-4" strokeWidth={2.2} />
              Tambah subtask
            </ActionButton>
          </form>
        </div>
      </div>
    </div>
  ) : (
    <EmptyState
      description="Pilih task dari list untuk membuka detail lengkapnya."
      title="Belum ada task terpilih"
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Core flow / tasks"
        title="Task sekarang jadi execution hub yang fokus ke Today."
        description="Fokus ke task yang perlu ditangani hari ini, dengan planner dan detail yang tetap dekat saat dibutuhkan."
        actions={
          <ActionButton href="/projects" variant="secondary">
            Project board tetap terpisah
          </ActionButton>
        }
      />

      <div className="xl:hidden">
        <SectionCard
          description="Di mobile, view utama disederhanakan jadi segmented filters dan quick capture."
          title="Task views"
        >
          <div className="flex flex-wrap gap-2">
            {filterOrder.map((item) => (
              <button
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  filter === item.id
                    ? "bg-[var(--foreground)] text-white"
                    : "border border-[var(--border)] bg-white/80 text-[var(--foreground)] hover:bg-white",
                )}
                key={item.id}
                onClick={() => setFilter(item.id)}
                type="button"
              >
                {item.label} • {filterCounts[item.id]}
              </button>
            ))}
          </div>
          <form className="mt-4 flex flex-wrap gap-3" onSubmit={handleQuickCapture}>
            <Input
              className="min-w-[220px] flex-1"
              data-testid="quick-task-input-mobile"
              onChange={(event) => setQuickTitle(event.target.value)}
              placeholder="Tulis task cepat lalu rapikan nanti"
              value={quickTitle}
            />
            <ActionButton data-testid="quick-task-submit-mobile" type="submit">
              Tambah cepat
            </ActionButton>
          </form>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)_390px]">
        <div className="hidden xl:block">
          <SectionCard
            description="Pindah konteks dan tambah task tanpa meninggalkan area utama."
            title="Views"
          >
            <div className="space-y-3">
              {filterOrder.map((item) => (
                <FilterButton
                  active={filter === item.id}
                  count={filterCounts[item.id]}
                  detail={item.detail}
                  key={item.id}
                  label={item.label}
                  onClick={() => setFilter(item.id)}
                />
              ))}
            </div>

            <div className="mt-6 border-t border-[var(--border)] pt-5">
              <p className="text-sm font-semibold">Quick capture</p>
              <form className="mt-4 space-y-3" onSubmit={handleQuickCapture}>
                <Input
                  data-testid="quick-task-input-desktop"
                  onChange={(event) => setQuickTitle(event.target.value)}
                  placeholder="Contoh: follow up feedback hero"
                  value={quickTitle}
                />
                <ActionButton data-testid="quick-task-submit-desktop" type="submit">
                  Tambah task
                </ActionButton>
              </form>
            </div>

            {quickFeedback ? (
              <p className="mt-4 rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
                {quickFeedback}
              </p>
            ) : null}
          </SectionCard>
        </div>

        <SectionCard
          className="min-w-0"
          description={
            filter === "today"
              ? "Today menggabungkan prioritas yang memang perlu dilihat hari ini."
              : filter === "upcoming"
                ? "Upcoming dipakai untuk merencanakan minggu dan bulan berikutnya."
                : filter === "all"
                  ? "Semua task aktif lintas project dan task pribadi."
                  : "Task selesai disimpan terpisah agar view utama tetap ringan."
          }
          title={
            filter === "today"
              ? "Today"
              : filter === "upcoming"
                ? "Upcoming"
                : filter === "all"
                  ? "All tasks"
                  : "Done"
          }
        >
          <div className="space-y-5">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]"
                strokeWidth={2.2}
              />
              <Input
                className="pl-11"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari task, project, atau catatan"
                value={query}
              />
            </div>

            {filter === "upcoming" ? (
              <div className="flex flex-wrap gap-2">
                <button
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    upcomingView === "calendar"
                      ? "bg-[var(--foreground)] text-white"
                      : "border border-[var(--border)] bg-white/80 text-[var(--foreground)] hover:bg-white",
                  )}
                  onClick={() => setUpcomingView("calendar")}
                  type="button"
                >
                  Calendar
                </button>
                <button
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    upcomingView === "list"
                      ? "bg-[var(--foreground)] text-white"
                      : "border border-[var(--border)] bg-white/80 text-[var(--foreground)] hover:bg-white",
                  )}
                  onClick={() => setUpcomingView("list")}
                  type="button"
                >
                  List
                </button>
              </div>
            ) : null}

            {filter === "today" ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2">
                    <Pill tone="rose">Overdue</Pill>
                    <p className="text-sm text-[var(--muted)]">Lewat due date.</p>
                  </div>
                  {renderTaskList(
                    overdueTodayTasks,
                    "Tidak ada overdue",
                    "Bagian ini kosong saat semua task terlambat sudah tertangani.",
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2">
                    <Pill tone="mint">Today</Pill>
                    <p className="text-sm text-[var(--muted)]">Due dan reminder hari ini.</p>
                  </div>
                  {renderTaskList(
                    dueTodayTasks,
                    "Today masih ringan",
                    "Belum ada due hari ini atau reminder yang aktif hari ini.",
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2">
                    <Pill tone="amber">Pin ke today</Pill>
                    <p className="text-sm text-[var(--muted)]">Di-pin manual ke today.</p>
                  </div>
                  {renderTaskList(
                    pinnedTodayTasks,
                    "Belum ada task pinned",
                    "Pin task penting ke today kalau ingin membawanya ke fokus harian.",
                  )}
                </div>

                <div className="space-y-2">
                  <button
                    className="flex w-full items-center justify-between border-b border-[var(--border)] pb-2 text-left"
                    onClick={() => setShowTodayDone((current) => !current)}
                    type="button"
                  >
                    <div className="flex items-center gap-2">
                      <Pill>Done</Pill>
                      <p className="text-sm text-[var(--muted)]">Task yang selesai hari ini.</p>
                    </div>
                    <span className="text-sm font-medium text-[var(--foreground)]">
                      {showTodayDone ? "Sembunyikan" : `Tampilkan ${doneTodayTasks.length}`}
                    </span>
                  </button>
                  {showTodayDone
                    ? renderTaskList(
                        doneTodayTasks,
                        "Belum ada task selesai hari ini",
                        "Saat kamu menyelesaikan task, ia akan masuk ke section ini.",
                      )
                    : null}
                </div>
              </div>
            ) : null}

            {filter === "upcoming" && upcomingView === "list"
              ? renderTaskList(
                  upcomingTasks,
                  "Belum ada upcoming task",
                  "Task dengan due date mendatang akan muncul di sini.",
                )
              : null}

            {filter === "upcoming" && upcomingView === "calendar" ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Month planner</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Lihat task berdasarkan due date, lalu buka agenda per tanggal.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      aria-label="Bulan lalu"
                      className="flex size-10 items-center justify-center rounded-full border border-[var(--border)] bg-white/80 text-[var(--foreground)] hover:bg-white"
                      onClick={() => {
                        const previous = shiftMonth(visibleMonth, -1);
                        setVisibleMonth(previous);
                        setSelectedCalendarDate(
                          isoDateFromParts(previous.getFullYear(), previous.getMonth(), 1),
                        );
                      }}
                      type="button"
                    >
                      <ChevronLeft className="size-4" strokeWidth={2.4} />
                    </button>
                    <button
                      className="rounded-full border border-[var(--border)] bg-white/80 px-4 py-2 text-sm font-medium hover:bg-white"
                      onClick={() => {
                        const currentMonth = getMonthStart(new Date(isoToday()));
                        setVisibleMonth(currentMonth);
                        setSelectedCalendarDate(isoToday());
                      }}
                      type="button"
                    >
                      Bulan ini
                    </button>
                    <button
                      aria-label="Bulan depan"
                      className="flex size-10 items-center justify-center rounded-full border border-[var(--border)] bg-white/80 text-[var(--foreground)] hover:bg-white"
                      onClick={() => {
                        const next = shiftMonth(visibleMonth, 1);
                        setVisibleMonth(next);
                        setSelectedCalendarDate(
                          isoDateFromParts(next.getFullYear(), next.getMonth(), 1),
                        );
                      }}
                      type="button"
                    >
                      <ChevronRight className="size-4" strokeWidth={2.4} />
                    </button>
                  </div>
                </div>

                <div className="rounded-[24px] border border-[var(--border)] bg-white/72 p-3 sm:p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold capitalize">{monthLabel(visibleMonth)}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Task ditampilkan berdasarkan due date.
                      </p>
                    </div>
                    <div className="hidden gap-2 sm:flex">
                      <Pill tone="mint">today</Pill>
                      <Pill tone="amber">pinned</Pill>
                      <Pill tone="rose">high priority</Pill>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted)] sm:gap-2 sm:text-xs">
                    {weekDayLabels.map((label) => (
                          <div className="rounded-2xl bg-[rgba(255,255,255,0.55)] px-2 py-2" key={label}>
                        {label}
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 grid grid-cols-7 gap-1.5 sm:gap-2">
                    {calendarMonthCells.map((cell) => (
                      <button
                        className={cn(
                          "min-h-24 rounded-[20px] border p-2 text-left transition-colors sm:min-h-28 sm:p-3",
                          cell.isCurrentMonth
                            ? "border-[var(--border)] bg-white/78"
                            : "border-transparent bg-transparent text-[var(--muted)]",
                          cell.isSelected && "border-[var(--accent)] ring-1 ring-[var(--accent)]",
                        )}
                        key={cell.iso}
                        onClick={() => {
                          setSelectedCalendarDate(cell.iso);
                          if (!cell.isCurrentMonth) {
                            setVisibleMonth(getMonthStart(new Date(cell.iso)));
                          }
                        }}
                        type="button"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold">{cell.day}</span>
                          {cell.tasks.length ? (
                            <span className="rounded-full bg-[var(--foreground)] px-2 py-0.5 text-[10px] font-medium text-white">
                              {cell.tasks.length}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2 space-y-1.5">
                          {cell.tasks.slice(0, 2).map((task) => (
                            <div
                              className={cn(
                                "rounded-xl px-2 py-1 text-[10px] font-medium leading-4 sm:text-[11px]",
                                task.priority === "high" &&
                                  "bg-[rgba(166,64,77,0.12)] text-[var(--rose)]",
                                task.priority === "medium" &&
                                  "bg-[rgba(218,108,44,0.12)] text-[var(--warn)]",
                                task.priority === "low" &&
                                  "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
                              )}
                              key={task.id}
                            >
                              {task.title}
                            </div>
                          ))}
                          {cell.tasks.length > 2 ? (
                            <p className="text-[10px] text-[var(--muted)] sm:text-[11px]">
                              +{cell.tasks.length - 2} task lain
                            </p>
                          ) : null}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[0.82fr_1.18fr]">
                  <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.55)] p-4">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="size-4 text-[var(--muted)]" strokeWidth={2.2} />
                      <p className="text-sm font-semibold">Tanggal terpilih</p>
                    </div>
                    <p className="mt-3 text-2xl font-semibold">{formatDate(selectedCalendarDate)}</p>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      {selectedCalendarTasks.length
                        ? `${selectedCalendarTasks.length} task ada di tanggal ini.`
                        : "Belum ada task di tanggal ini."}
                    </p>
                  </div>
                  <div className="space-y-3">
                    {renderTaskList(
                      selectedCalendarTasks,
                      "Tanggal ini kosong",
                      "Pilih tanggal lain untuk melihat agenda task-nya.",
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {filter === "all" ? (
              <div className="space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Pill tone="amber">Doing</Pill>
                    <p className="text-sm text-[var(--muted)]">Sedang dikerjakan.</p>
                  </div>
                  {renderTaskList(
                    allActiveTasks.filter((task) => task.status === "doing"),
                    "Belum ada task doing",
                    "Task yang sedang berjalan akan muncul di sini.",
                  )}
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Pill tone="mint">To do</Pill>
                    <p className="text-sm text-[var(--muted)]">Backlog aktif.</p>
                  </div>
                  {renderTaskList(
                    allActiveTasks.filter((task) => task.status === "todo"),
                    "Belum ada task todo",
                    "Quick capture atau task project akan mengisi area ini.",
                  )}
                </div>
              </div>
            ) : null}

            {filter === "done"
              ? renderTaskList(
                  doneTasks,
                  "Belum ada task selesai",
                  "Task yang sudah selesai akan terkumpul di sini.",
                )
              : null}
          </div>
        </SectionCard>

        <div className="hidden xl:block">
          <SectionCard
            description="Detail tetap dekat saat task perlu dirapikan."
            title="Detail task"
          >
            {detailPanel}
          </SectionCard>
        </div>
      </div>

      {mobileDetailOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(23,37,47,0.42)] p-4 sm:p-6 xl:hidden"
          onClick={() => setMobileDetailOpen(false)}
          role="dialog"
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-[var(--border)] bg-[rgba(255,252,249,0.98)] p-5 shadow-[var(--shadow-lg)] sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  Task detail
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">
                  Edit task tanpa keluar dari flow harian
                </p>
              </div>
              <button
                aria-label="Tutup detail task"
                className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-3 text-[var(--foreground)] transition-colors hover:bg-white"
                onClick={() => setMobileDetailOpen(false)}
                type="button"
              >
                <X className="size-4" strokeWidth={2.4} />
              </button>
            </div>
            {detailPanel}
          </div>
        </div>
      ) : null}
    </div>
  );
}
