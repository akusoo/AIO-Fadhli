"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Plus, Search, X } from "lucide-react";
import {
  ActionButton,
  Field,
  Input,
  PageHeader,
  Pill,
  SectionCard,
  Select,
  Textarea,
} from "@/components/ui";
import type { AddProjectInput, Priority, Project, Task } from "@/lib/domain/models";
import {
  getTaskSubtaskProgress,
  isTaskDueToday,
  isTaskOverdue,
  sortTasks,
} from "@/lib/tasks";
import { cn, formatDate } from "@/lib/utils";
import { useAppState } from "@/providers/app-state-provider";

function getDefaultProjectId(projects: Project[]) {
  return projects.find((project) => project.status === "active")?.id ?? projects[0]?.id ?? "";
}

function statusTone(status: Project["status"]) {
  if (status === "active") {
    return "mint";
  }

  if (status === "paused") {
    return "amber";
  }

  return "neutral";
}

function priorityTone(priority: Task["priority"]) {
  if (priority === "high") {
    return "rose";
  }

  if (priority === "medium") {
    return "amber";
  }

  return "neutral";
}

function nextTaskStatus(status: Task["status"]) {
  if (status === "todo") {
    return "doing";
  }

  if (status === "doing") {
    return "done";
  }

  return "todo";
}

function statusLabel(status: Task["status"]) {
  return {
    todo: "to do",
    doing: "doing",
    done: "done",
  }[status];
}

function formatTaskSchedule(task: Task) {
  const parts: string[] = [];

  if (task.dueOn) {
    parts.push(formatDate(task.dueOn));
  }

  if (task.startTime || task.dueTime) {
    parts.push([task.startTime, task.dueTime].filter(Boolean).join(" - "));
  }

  return parts.length ? parts.join(" • ") : "Tanpa deadline spesifik";
}

function ProjectMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[22px] bg-white/72 px-4 py-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
        {value}
      </p>
    </div>
  );
}

function EmptyBlock({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[22px] border border-dashed border-[var(--border)] px-4 py-8 text-center">
      <p className="font-semibold text-[var(--foreground)]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

function TaskRow({
  task,
  onMove,
  subtasksDone,
  subtasksTotal,
  highlighted = false,
}: {
  task: Task;
  onMove: (nextStatus: Task["status"]) => void;
  subtasksDone: number;
  subtasksTotal: number;
  highlighted?: boolean;
}) {
  const nextStatus = nextTaskStatus(task.status);
  const hasAttention = isTaskOverdue(task) || isTaskDueToday(task);

  return (
    <div
      id={`project-task-${task.id}`}
      className={cn(
        "rounded-[22px] border border-[var(--border)] bg-white/84 px-4 py-4 transition-[box-shadow,border-color,background-color]",
        hasAttention && "border-[rgba(166,64,77,0.22)] bg-[rgba(255,247,248,0.96)]",
        highlighted && "border-[var(--accent)] bg-white shadow-[0_0_0_3px_rgba(111,168,146,0.18)]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-[var(--foreground)]">{task.title}</p>
            <Pill tone={priorityTone(task.priority)}>{task.priority}</Pill>
            {task.status === "doing" ? <Pill tone="mint">sedang dikerjakan</Pill> : null}
            {isTaskOverdue(task) ? <Pill tone="rose">overdue</Pill> : null}
            {!isTaskOverdue(task) && isTaskDueToday(task) ? (
              <Pill tone="amber">due today</Pill>
            ) : null}
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{formatTaskSchedule(task)}</p>
        </div>

        <button
          className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface)]"
          onClick={() => onMove(nextStatus)}
          type="button"
        >
          Pindah ke {nextStatus}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {subtasksTotal ? (
          <Pill>
            {subtasksDone}/{subtasksTotal} subtask
          </Pill>
        ) : null}
        {task.reminderAt ? <Pill>reminder</Pill> : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <ActionButton href="/tasks" variant="ghost">
          Buka detail di Tasks
        </ActionButton>
      </div>
    </div>
  );
}

function NotePreview({
  title,
  content,
}: {
  title: string;
  content: string;
}) {
  return (
    <div className="rounded-[22px] bg-white/74 px-4 py-4">
      <p className="font-semibold text-[var(--foreground)]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{content}</p>
    </div>
  );
}

type ProjectTaskDraft = {
  title: string;
  priority: Priority;
  dueOn: string;
  reminderAt: string;
  startTime: string;
  dueTime: string;
  note: string;
};

type ProjectSubtaskDraft = {
  id: string;
  title: string;
  note: string;
};

function createProjectTaskDraft(): ProjectTaskDraft {
  return {
    title: "",
    priority: "medium",
    dueOn: "",
    reminderAt: "",
    startTime: "",
    dueTime: "",
    note: "",
  };
}

function createProjectSubtaskDraft(): ProjectSubtaskDraft {
  return {
    id: `draft-subtask-${Math.random().toString(16).slice(2, 10)}`,
    title: "",
    note: "",
  };
}

function ProjectModal({
  draft,
  errors,
  isOpen,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: AddProjectInput;
  errors: Record<string, string>;
  isOpen: boolean;
  onChange: (draft: AddProjectInput) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(16,33,43,0.42)] p-4">
      <div className="w-full max-w-xl rounded-[28px] border border-[var(--border)] bg-[rgba(255,252,249,0.98)] p-5 shadow-[var(--shadow-lg)] md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
              Project baru
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
              Tambah project
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Isi tiga field inti dulu agar project baru langsung siap dipakai di workspace ini.
            </p>
          </div>
          <button
            className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-white"
            onClick={onClose}
            type="button"
          >
            Tutup
          </button>
        </div>

        <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
          <Field error={errors?.name} label="Nama project">
            <Input
              onChange={(event) => onChange({ ...draft, name: event.target.value })}
              placeholder="Contoh: Client portal iteration"
              value={draft.name}
            />
          </Field>
          <Field error={errors?.focus} label="Focus">
            <Input
              onChange={(event) => onChange({ ...draft, focus: event.target.value })}
              placeholder="Contoh: Validasi flow utama"
              value={draft.focus}
            />
          </Field>
          <Field label="Description">
            <Textarea
              onChange={(event) => onChange({ ...draft, description: event.target.value })}
              placeholder="Ringkas konteks project ini agar mudah dibaca nanti."
              required
              value={draft.description}
            />
          </Field>
          <div className="flex flex-wrap justify-end gap-3">
            <ActionButton onClick={onClose} variant="ghost">
              Batal
            </ActionButton>
            <ActionButton type="submit">Simpan project</ActionButton>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const { snapshot, addNote, addProject, addSubtask, addTask, moveTask } = useAppState();
  const [selectedProjectId, setSelectedProjectId] = useState(() =>
    getDefaultProjectId(snapshot.projects),
  );
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [projectDraft, setProjectDraft] = useState<AddProjectInput>({
    name: "",
    focus: "",
    description: "",
  });
  const [taskDraft, setTaskDraft] = useState<ProjectTaskDraft>(createProjectTaskDraft);
  const [subtaskDrafts, setSubtaskDrafts] = useState<ProjectSubtaskDraft[]>([]);
  const [projectQuery, setProjectQuery] = useState("");
  const [showTaskScheduleFields, setShowTaskScheduleFields] = useState(false);
  const [showTaskSubtasks, setShowTaskSubtasks] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [projectFeedback, setProjectFeedback] = useState("");
  const [taskFeedback, setTaskFeedback] = useState("");
  const [noteFeedback, setNoteFeedback] = useState("");
  const [projectErrors, setProjectErrors] = useState<Record<string, string>>({});
  const [taskErrors, setTaskErrors] = useState<Record<string, string>>({});
  const [recentCreatedTaskId, setRecentCreatedTaskId] = useState("");

  const selectedProject =
    snapshot.projects.find((project) => project.id === selectedProjectId) ??
    snapshot.projects.find((project) => project.id === getDefaultProjectId(snapshot.projects));

  const projectSummaries = useMemo(
    () =>
      snapshot.projects.map((project) => {
        const tasks = snapshot.tasks.filter((task) => task.projectId === project.id);
        const activeCount = tasks.filter((task) => task.status !== "done").length;

        return {
          project,
          taskCount: activeCount,
        };
      }),
    [snapshot.projects, snapshot.tasks],
  );
  const visibleProjectSummaries = useMemo(() => {
    const normalized = projectQuery.trim().toLowerCase();

    if (!normalized) {
      return projectSummaries;
    }

    return projectSummaries.filter(({ project }) =>
      [project.name, project.focus, project.description].some((value) =>
        value.toLowerCase().includes(normalized),
      ),
    );
  }, [projectQuery, projectSummaries]);

  const projectTasks = useMemo(
    () =>
      selectedProject
        ? snapshot.tasks.filter((task) => task.projectId === selectedProject.id)
        : [],
    [selectedProject, snapshot.tasks],
  );

  const projectNotes = useMemo(
    () =>
      selectedProject
        ? snapshot.notes.filter(
            (note) =>
              note.links.some(
                (link) => link.type === "project" && link.id === selectedProject.id,
              ),
          )
        : [],
    [selectedProject, snapshot.notes],
  );

  const activeTasks = useMemo(
    () => projectTasks.filter((task) => task.status !== "done"),
    [projectTasks],
  );

  const attentionTasks = useMemo(
    () => activeTasks.filter((task) => isTaskOverdue(task) || isTaskDueToday(task)).sort(sortTasks),
    [activeTasks],
  );

  const doingTasks = useMemo(
    () => activeTasks.filter((task) => task.status === "doing").sort(sortTasks),
    [activeTasks],
  );

  const nextTasks = useMemo(
    () =>
      activeTasks
        .filter((task) => task.status === "todo" && !isTaskOverdue(task) && !isTaskDueToday(task))
        .sort(sortTasks),
    [activeTasks],
  );

  const completedTasks = useMemo(
    () =>
      projectTasks
        .filter((task) => task.status === "done")
        .sort((left, right) =>
          (right.completedAt ?? right.dueOn ?? "").localeCompare(
            left.completedAt ?? left.dueOn ?? "",
          ),
        ),
    [projectTasks],
  );

  const taskProgress = projectTasks.length
    ? Math.round((completedTasks.length / projectTasks.length) * 100)
    : 0;

  useEffect(() => {
    if (!recentCreatedTaskId) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      document
        .getElementById(`project-task-${recentCreatedTaskId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    const timerId = window.setTimeout(() => {
      setRecentCreatedTaskId((current) => (current === recentCreatedTaskId ? "" : current));
    }, 4500);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timerId);
    };
  }, [recentCreatedTaskId, projectTasks]);

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!projectDraft.name.trim()) newErrors.name = "Nama project tidak boleh kosong.";
    if (!projectDraft.focus.trim()) newErrors.focus = "Fokus project perlu diisi.";
    
    setProjectErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    const createdProject = await addProject({
      name: projectDraft.name.trim(),
      focus: projectDraft.focus.trim(),
      description: projectDraft.description.trim(),
    });

    setSelectedProjectId(createdProject.id);
    setProjectDraft({
      name: "",
      focus: "",
      description: "",
    });
    setIsCreateProjectOpen(false);
    setProjectFeedback(`Project "${createdProject.name}" siap dipakai.`);
  }

  async function handleQuickProjectNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedProject) {
      return;
    }

    await addNote({
      title: noteTitle.trim(),
      content: noteContent.trim(),
      links: [{ type: "project", id: selectedProject.id }],
    });

    setNoteTitle("");
    setNoteContent("");
    setNoteFeedback(`Note baru langsung ditautkan ke ${selectedProject.name}.`);
  }

  async function handleCreateProjectTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedProject) {
      return;
    }

    if (!taskDraft.title.trim()) {
      setTaskErrors({ title: "Judul task wajib diisi." });
      return;
    }
    setTaskErrors({});

    const createdTask = await addTask({
      title: taskDraft.title.trim(),
      priority: taskDraft.priority,
      dueOn: taskDraft.dueOn || undefined,
      projectId: selectedProject.id,
      note: taskDraft.note || undefined,
      startTime: taskDraft.startTime || undefined,
      dueTime: taskDraft.dueTime || undefined,
      reminderAt: taskDraft.reminderAt || undefined,
    });

    const validSubtasks = subtaskDrafts.filter((subtask) => subtask.title.trim());

    for (const subtask of validSubtasks) {
      await addSubtask({
        taskId: createdTask.id,
        title: subtask.title.trim(),
        note: subtask.note.trim() || undefined,
      });
    }

    setTaskDraft(createProjectTaskDraft());
    setSubtaskDrafts([]);
    setTaskErrors({});
    setIsCreateTaskOpen(false);
    setShowTaskScheduleFields(false);
    setShowTaskSubtasks(false);
    setRecentCreatedTaskId(createdTask.id);
    setTaskFeedback(
      validSubtasks.length
        ? `Task baru masuk ke ${selectedProject.name} beserta ${validSubtasks.length} subtask.`
        : `Task baru masuk ke ${selectedProject.name}.`,
    );
  }

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Core flow / projects"
          title="Projects sekarang jadi workspace yang lebih fokus dan tenang."
          description="Baca kondisi project, tentukan next step, dan simpan context penting tanpa membuat workspace terasa berat."
          actions={
            <>
              <ActionButton onClick={() => setIsCreateProjectOpen(true)}>Tambah project</ActionButton>
              <ActionButton href="/notes" variant="secondary">
                Kelola note di Notes
              </ActionButton>
            </>
          }
        />

        {!selectedProject ? (
          <SectionCard
            description="Belum ada project yang bisa dipilih dari snapshot saat ini."
            title="Projects"
          >
            <EmptyBlock
              action={
                <ActionButton onClick={() => setIsCreateProjectOpen(true)}>
                  Tambah project pertama
                </ActionButton>
              }
              description="Begitu project pertama tersedia, halaman ini akan menampilkan overview, next steps, dan context project dalam satu tempat."
              title="Belum ada project"
            />
          </SectionCard>
        ) : (
          <>
            <SectionCard
              description="Pilih satu project aktif untuk menjaga workspace tetap ringan."
              title="Project switcher"
            >
              <div className="mb-4 relative">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]"
                  strokeWidth={2.2}
                />
                <Input
                  className="pl-11"
                  onChange={(event) => setProjectQuery(event.target.value)}
                  placeholder="Cari project, focus, atau deskripsi"
                  value={projectQuery}
                />
              </div>
              {visibleProjectSummaries.length ? (
              <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
                {visibleProjectSummaries.map(({ project, taskCount }) => {
                  const isSelected = project.id === selectedProject.id;

                  return (
                    <button
                      className={cn(
                        "min-w-[240px] rounded-[24px] border px-4 py-4 text-left transition-colors",
                        isSelected
                          ? "border-transparent bg-[rgba(16,33,43,0.94)] text-white shadow-[0_18px_50px_rgba(16,33,43,0.18)]"
                          : "border-[var(--border)] bg-white/78 text-[var(--foreground)] hover:bg-white",
                      )}
                      key={project.id}
                      onClick={() => {
                        setSelectedProjectId(project.id);
                        setNoteFeedback("");
                      }}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold">{project.name}</p>
                          <p
                            className={cn(
                              "mt-1 text-sm leading-6",
                              isSelected ? "text-white/72" : "text-[var(--muted)]",
                            )}
                          >
                            {project.focus}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 text-xs font-medium",
                            isSelected
                              ? "bg-white/14 text-white"
                              : "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
                          )}
                        >
                          {taskCount} aktif
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Pill tone={statusTone(project.status)}>{project.status}</Pill>
                      </div>
                    </button>
                  );
                })}
              </div>
              ) : (
                <EmptyBlock
                  description="Tidak ada project yang cocok dengan pencarian saat ini."
                  title="Project tidak ditemukan"
                />
              )}
            </SectionCard>

            <SectionCard
              description="Ringkasan project dan jalur cepat untuk menambah task baru."
              title="Project overview"
            >
              <div className="space-y-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                        {selectedProject.name}
                      </h2>
                      <Pill tone={statusTone(selectedProject.status)}>{selectedProject.status}</Pill>
                      <Pill>{selectedProject.focus}</Pill>
                    </div>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                      {selectedProject.description}
                    </p>
                  </div>

                  <ActionButton href="/tasks" variant="secondary">
                    Buka semua task project di Tasks
                  </ActionButton>
                </div>

                {projectFeedback ? (
                  <p className="rounded-[20px] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
                    {projectFeedback}
                  </p>
                ) : null}

                <div className="rounded-[24px] border border-[var(--border)] bg-white/72 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-[var(--foreground)]">
                        Tambah task project
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                        Task baru dari sini otomatis masuk ke project yang sedang dipilih.
                      </p>
                    </div>
                    <ActionButton
                      onClick={() => {
                        setIsCreateTaskOpen((current) => {
                          const next = !current;

                          if (!next) {
                            setShowTaskScheduleFields(false);
                            setShowTaskSubtasks(false);
                          }

                          return next;
                        });
                        setTaskFeedback("");
                      }}
                      variant={isCreateTaskOpen ? "ghost" : "secondary"}
                    >
                      {isCreateTaskOpen ? "Tutup form" : "Tambah task"}
                    </ActionButton>
                  </div>

                  {isCreateTaskOpen ? (
                    <form className="mt-5 space-y-5" onSubmit={handleCreateProjectTask}>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field error={taskErrors.title} label="Judul task">
                          <Input
                            onChange={(event) => {
                              setTaskDraft((current) => ({
                                ...current,
                                title: event.target.value,
                              }));
                              if (taskErrors.title) setTaskErrors({});
                            }}
                            placeholder="Contoh: validasi flow signup"
                            value={taskDraft.title}
                          />
                        </Field>
                        <Field label="Prioritas">
                          <Select
                            onChange={(event) =>
                              setTaskDraft((current) => ({
                                ...current,
                                priority: event.target.value as Priority,
                              }))
                            }
                            value={taskDraft.priority}
                          >
                            <option value="low">low</option>
                            <option value="medium">medium</option>
                            <option value="high">high</option>
                          </Select>
                        </Field>
                      </div>

                      <Field label="Catatan task">
                        <Textarea
                          onChange={(event) =>
                            setTaskDraft((current) => ({
                              ...current,
                              note: event.target.value,
                            }))
                          }
                          placeholder="Catatan utama untuk task ini"
                          value={taskDraft.note}
                        />
                      </Field>

                      <div className="flex flex-wrap gap-3">
                        <ActionButton
                          onClick={() => setShowTaskScheduleFields((current) => !current)}
                          type="button"
                          variant="ghost"
                        >
                          {showTaskScheduleFields ? "Sembunyikan detail jadwal" : "Tambah detail jadwal"}
                        </ActionButton>
                        <ActionButton
                          onClick={() => setShowTaskSubtasks((current) => !current)}
                          type="button"
                          variant="ghost"
                        >
                          {showTaskSubtasks ? "Sembunyikan subtasks" : "Tambah subtasks"}
                        </ActionButton>
                      </div>

                      {showTaskScheduleFields ? (
                        <div className="grid gap-4 border-t border-[var(--border)] pt-5 md:grid-cols-2">
                          <Field label="Due date">
                            <Input
                              onChange={(event) =>
                                setTaskDraft((current) => ({
                                  ...current,
                                  dueOn: event.target.value,
                                }))
                              }
                              type="date"
                              value={taskDraft.dueOn}
                            />
                          </Field>
                          <Field label="Reminder">
                            <Input
                              onChange={(event) =>
                                setTaskDraft((current) => ({
                                  ...current,
                                  reminderAt: event.target.value,
                                }))
                              }
                              type="datetime-local"
                              value={taskDraft.reminderAt}
                            />
                          </Field>
                          <Field label="Jam mulai">
                            <Input
                              onChange={(event) =>
                                setTaskDraft((current) => ({
                                  ...current,
                                  startTime: event.target.value,
                                }))
                              }
                              type="time"
                              value={taskDraft.startTime}
                            />
                          </Field>
                          <Field label="Jam target selesai">
                            <Input
                              onChange={(event) =>
                                setTaskDraft((current) => ({
                                  ...current,
                                  dueTime: event.target.value,
                                }))
                              }
                              type="time"
                              value={taskDraft.dueTime}
                            />
                          </Field>
                        </div>
                      ) : null}

                      {showTaskSubtasks ? (
                      <div className="border-t border-[var(--border)] pt-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-semibold text-[var(--foreground)]">
                              Subtasks
                            </p>
                            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                              Tambahkan langkah-langkah kecil sejak awal jika task ini memang perlu dipecah.
                            </p>
                          </div>
                          <ActionButton
                            onClick={() =>
                              setSubtaskDrafts((current) => [...current, createProjectSubtaskDraft()])
                            }
                            variant="ghost"
                          >
                            <Plus className="mr-2 size-4" strokeWidth={2.2} />
                            Tambah subtask
                          </ActionButton>
                        </div>

                        <div className="mt-4 space-y-3">
                          {subtaskDrafts.length === 0 ? (
                            <div className="rounded-[20px] bg-[var(--surface)] px-4 py-4 text-sm leading-6 text-[var(--muted)]">
                              Belum ada subtask. Anda bisa simpan task utama dulu, atau tambah beberapa langkah kecil di sini.
                            </div>
                          ) : null}

                          {subtaskDrafts.map((subtask) => (
                            <div
                              className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] px-4 py-4"
                              key={subtask.id}
                            >
                              <div className="mb-3 flex justify-end">
                                <button
                                  className="inline-flex rounded-full border border-[var(--border)] p-2 text-[var(--muted)] transition-colors hover:bg-white hover:text-[var(--foreground)]"
                                  onClick={() =>
                                    setSubtaskDrafts((current) =>
                                      current.filter((item) => item.id !== subtask.id),
                                    )
                                  }
                                  type="button"
                                >
                                  <X className="size-4" strokeWidth={2.2} />
                                </button>
                              </div>
                              <div className="grid gap-4">
                                <Field label="Judul subtask">
                                  <Input
                                    onChange={(event) =>
                                      setSubtaskDrafts((current) =>
                                        current.map((item) =>
                                          item.id === subtask.id
                                            ? { ...item, title: event.target.value }
                                            : item,
                                        ),
                                      )
                                    }
                                    placeholder="Contoh: rapikan copy empty state"
                                    value={subtask.title}
                                  />
                                </Field>
                                <Field label="Note subtask">
                                  <Textarea
                                    className="min-h-24"
                                    onChange={(event) =>
                                      setSubtaskDrafts((current) =>
                                        current.map((item) =>
                                          item.id === subtask.id
                                            ? { ...item, note: event.target.value }
                                            : item,
                                        ),
                                      )
                                    }
                                    placeholder="Catatan kecil untuk langkah ini"
                                    value={subtask.note}
                                  />
                                </Field>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      ) : null}

                      <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--border)] pt-5">
                        <ActionButton
                          onClick={() => {
                            setIsCreateTaskOpen(false);
                            setTaskDraft(createProjectTaskDraft());
                            setSubtaskDrafts([]);
                            setShowTaskScheduleFields(false);
                            setShowTaskSubtasks(false);
                          }}
                          variant="ghost"
                        >
                          Batal
                        </ActionButton>
                        <ActionButton type="submit">Simpan task ke project</ActionButton>
                      </div>
                    </form>
                  ) : null}

                  {taskFeedback ? (
                    <p className="mt-4 rounded-[20px] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
                      {taskFeedback}
                    </p>
                  ) : null}

                  {taskFeedback ? (
                    <div className="mt-3 flex flex-wrap gap-3">
                      <ActionButton href="/tasks" variant="secondary">
                        Buka di Tasks
                      </ActionButton>
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-3">
                  <ProjectMetric
                    label="Task aktif"
                    value={String(activeTasks.length)}
                  />
                  <ProjectMetric
                    label="Butuh perhatian"
                    value={String(attentionTasks.length)}
                  />
                  <ProjectMetric
                    label="Notes terkait"
                    value={String(projectNotes.length)}
                  />
                </div>

                <div className="rounded-[24px] bg-[var(--surface)] px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--foreground)]">Progress sederhana</p>
                      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                        {completedTasks.length} dari {projectTasks.length} task project sudah selesai.
                      </p>
                    </div>
                    <p className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                      {taskProgress}%
                    </p>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-[var(--accent-strong)] transition-[width]"
                      style={{ width: `${taskProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            </SectionCard>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
              <SectionCard
                description="Area utama diringkas menjadi grouped list supaya review project terasa cepat, jelas, dan tidak berat."
                title="Execution"
              >
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-[var(--foreground)]">
                          Butuh perhatian
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                          Overdue atau due hari ini dari project yang sedang dipilih.
                        </p>
                      </div>
                      <Pill tone={attentionTasks.length ? "rose" : "neutral"}>
                        {attentionTasks.length} item
                      </Pill>
                    </div>

                    {attentionTasks.length ? (
                      <div className="space-y-3">
                        {attentionTasks.map((task) => {
                          const progress = getTaskSubtaskProgress(task.id, snapshot.subtasks);

                          return (
                            <TaskRow
                              highlighted={task.id === recentCreatedTaskId}
                              key={task.id}
                              onMove={(nextStatus) => {
                                void moveTask(task.id, nextStatus);
                              }}
                              subtasksDone={progress.done}
                              subtasksTotal={progress.total}
                              task={task}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <EmptyBlock
                        description="Project ini sedang cukup tenang. Area ini akan terisi saat ada task yang overdue atau due hari ini."
                        title="Tidak ada task mendesak"
                      />
                    )}
                  </div>

                  <div className="space-y-3 border-t border-[var(--border)] pt-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-[var(--foreground)]">
                          Sedang dikerjakan
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                          Task aktif yang sedang berjalan sekarang.
                        </p>
                      </div>
                      <Pill tone={doingTasks.length ? "mint" : "neutral"}>
                        {doingTasks.length} item
                      </Pill>
                    </div>

                    {doingTasks.length ? (
                      <div className="space-y-3">
                        {doingTasks.map((task) => {
                          const progress = getTaskSubtaskProgress(task.id, snapshot.subtasks);

                          return (
                            <TaskRow
                              highlighted={task.id === recentCreatedTaskId}
                              key={task.id}
                              onMove={(nextStatus) => {
                                void moveTask(task.id, nextStatus);
                              }}
                              subtasksDone={progress.done}
                              subtasksTotal={progress.total}
                              task={task}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <EmptyBlock
                        description="Saat task mulai dikerjakan, area ini akan membantu membaca momentum project dengan cepat."
                        title="Belum ada task doing"
                      />
                    )}
                  </div>

                  <div className="space-y-3 border-t border-[var(--border)] pt-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-[var(--foreground)]">Berikutnya</p>
                        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                          Task todo terdekat yang siap dipilih sebagai next step.
                        </p>
                      </div>
                      <Pill>{nextTasks.length} item</Pill>
                    </div>

                    {nextTasks.length ? (
                      <div className="space-y-3">
                        {nextTasks.map((task) => {
                          const progress = getTaskSubtaskProgress(task.id, snapshot.subtasks);

                          return (
                            <TaskRow
                              highlighted={task.id === recentCreatedTaskId}
                              key={task.id}
                              onMove={(nextStatus) => {
                                void moveTask(task.id, nextStatus);
                              }}
                              subtasksDone={progress.done}
                              subtasksTotal={progress.total}
                              task={task}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <EmptyBlock
                        description="Semua task todo sudah tertangani, atau project ini memang belum punya task yang bisa dijadwalkan berikutnya."
                        title="Belum ada next step"
                      />
                    )}
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                description="Sisi kanan menyimpan context penting supaya progress project terasa utuh tanpa membuat area utama penuh."
                title="Context"
              >
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div>
                      <p className="text-lg font-semibold text-[var(--foreground)]">
                        Quick add note
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                        Catatan baru dari area ini otomatis menempel ke project yang sedang dipilih.
                      </p>
                    </div>

                    <form className="space-y-3" onSubmit={handleQuickProjectNote}>
                      <Field label="Judul note">
                        <Input
                          onChange={(event) => setNoteTitle(event.target.value)}
                          placeholder="Contoh: keputusan flow onboarding"
                          required
                          value={noteTitle}
                        />
                      </Field>
                      <Field label="Isi note">
                        <Textarea
                          onChange={(event) => setNoteContent(event.target.value)}
                          placeholder="Tulis insight, keputusan, atau konteks yang perlu diingat untuk project ini."
                          required
                          value={noteContent}
                        />
                      </Field>
                      <ActionButton type="submit">Simpan note ke project</ActionButton>
                    </form>

                    {noteFeedback ? (
                      <p className="rounded-[20px] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
                        {noteFeedback}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-3 border-t border-[var(--border)] pt-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-[var(--foreground)]">Notes terkait</p>
                        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                          Catatan yang sudah di-attach ke project ini.
                        </p>
                      </div>
                      <ActionButton href="/notes" variant="ghost">
                        Buka Notes
                      </ActionButton>
                    </div>

                    {projectNotes.length ? (
                      <div className="space-y-3">
                        {projectNotes.map((note) => (
                          <NotePreview content={note.content} key={note.id} title={note.title} />
                        ))}
                      </div>
                    ) : (
                      <EmptyBlock
                        description="Tambahkan note pertama langsung dari form di atas, atau kelola attachment lebih lanjut dari halaman Notes."
                        title="Belum ada notes project"
                      />
                    )}
                  </div>

                  <div className="space-y-3 border-t border-[var(--border)] pt-6">
                    <div>
                      <p className="text-lg font-semibold text-[var(--foreground)]">Recent wins</p>
                      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                        Hasil yang sudah selesai supaya progress project terasa terlihat.
                      </p>
                    </div>

                    {completedTasks.length ? (
                      <div className="space-y-3">
                        {completedTasks.slice(0, 4).map((task) => (
                          <div className="rounded-[22px] bg-[var(--surface)] px-4 py-4" key={task.id}>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-[var(--foreground)]">{task.title}</p>
                              <Pill tone="mint">done</Pill>
                              <Pill tone={priorityTone(task.priority)}>{task.priority}</Pill>
                              <Pill>{statusLabel(task.status)}</Pill>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                              {task.completedAt
                                ? `Selesai ${formatDate(task.completedAt.slice(0, 10))}`
                                : task.dueOn
                                  ? `Target sebelumnya ${formatDate(task.dueOn)}`
                                  : "Selesai tanpa tanggal tercatat"}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyBlock
                        description="Begitu task project mulai selesai, area ini akan membantu menjaga rasa progres tetap terlihat."
                        title="Belum ada recent wins"
                      />
                    )}
                  </div>
                </div>
              </SectionCard>
            </div>
          </>
        )}
      </div>

      <ProjectModal
        draft={projectDraft}
        errors={projectErrors}
        isOpen={isCreateProjectOpen}
        onChange={setProjectDraft}
        onClose={() => {
          setIsCreateProjectOpen(false);
          setProjectErrors({});
        }}
        onSubmit={handleCreateProject}
      />
    </>
  );
}
