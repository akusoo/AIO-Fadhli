"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Plus, Search, Sparkles, X } from "lucide-react";
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
import type { Note, NoteLink, NoteLinkType } from "@/lib/domain/models";
import { useAppState } from "@/providers/app-state-provider";

type CreateContext = "standalone" | NoteLinkType;

function groupTone(note: Note) {
  if (note.links.some((link) => link.type === "project")) {
    return "mint";
  }

  if (note.links.some((link) => link.type === "task")) {
    return "amber";
  }

  return "neutral";
}

function noteContextLabel(note: Note) {
  if (note.links.length === 0) {
    return "standalone";
  }

  const labels = [
    note.links.some((link) => link.type === "project") ? "project" : null,
    note.links.some((link) => link.type === "task") ? "task" : null,
  ].filter(Boolean);

  return labels.join(" + ");
}

function buildNotePreview(content: string) {
  return content.length > 120 ? `${content.slice(0, 117)}...` : content;
}

function dedupeLinks(links: NoteLink[]) {
  return links.filter(
    (link, index) =>
      links.findIndex((item) => item.type === link.type && item.id === link.id) === index,
  );
}

function matchesNoteQuery(note: Note, query: string) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return [note.title, note.content].some((value) =>
    value.toLowerCase().includes(normalized),
  );
}

function LibraryGroup({
  description,
  notes,
  onSelect,
  selectedNoteId,
  title,
}: {
  description: string;
  notes: Note[];
  onSelect: (noteId: string) => void;
  selectedNoteId: string;
  title: string;
}) {
  return (
    <div className="space-y-3">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-base font-semibold text-[var(--foreground)]">{title}</p>
          <Pill>{notes.length} note</Pill>
        </div>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{description}</p>
      </div>

      {notes.length ? (
        <div className="space-y-2">
          {notes.map((note) => {
            const isSelected = note.id === selectedNoteId;

            return (
              <button
                className={
                  isSelected
                    ? "w-full rounded-[22px] border border-transparent bg-[rgba(16,33,43,0.94)] px-4 py-4 text-left text-white shadow-[0_18px_50px_rgba(16,33,43,0.18)]"
                    : "w-full rounded-[22px] border border-[var(--border)] bg-white/78 px-4 py-4 text-left transition-colors hover:bg-white"
                }
                key={note.id}
                onClick={() => onSelect(note.id)}
                type="button"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{note.title}</p>
                  <Pill tone={groupTone(note)}>{noteContextLabel(note)}</Pill>
                </div>
                <p className={isSelected ? "mt-2 text-sm leading-6 text-white/72" : "mt-2 text-sm leading-6 text-[var(--muted)]"}>
                  {buildNotePreview(note.content)}
                </p>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[20px] bg-[var(--surface)] px-4 py-4 text-sm leading-6 text-[var(--muted)]">
          Belum ada note di kelompok ini.
        </div>
      )}
    </div>
  );
}

export default function NotesPage() {
  const { snapshot, addNote, addTask, setNoteLinks, updateNote } = useAppState();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [createContext, setCreateContext] = useState<CreateContext>("standalone");
  const [createLinkedId, setCreateLinkedId] = useState("");
  const [showCreateContext, setShowCreateContext] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState(snapshot.notes[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [libraryFilter, setLibraryFilter] = useState<"all" | "standalone" | "project" | "task">("all");
  const [noteDraft, setNoteDraft] = useState({
    noteId: snapshot.notes[0]?.id ?? "",
    title: snapshot.notes[0]?.title ?? "",
    content: snapshot.notes[0]?.content ?? "",
  });
  const [linkType, setLinkType] = useState<NoteLinkType>("project");
  const [linkId, setLinkId] = useState("");
  const [createFeedback, setCreateFeedback] = useState("");
  const [saveFeedback, setSaveFeedback] = useState("");
  const [linkFeedback, setLinkFeedback] = useState("");
  const [taskFeedback, setTaskFeedback] = useState("");
  const [quickErrors, setQuickErrors] = useState<Record<string, string>>({});
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  const selectedNote =
    snapshot.notes.find((note) => note.id === selectedNoteId) ?? snapshot.notes[0];
  const activeDraftTitle =
    selectedNote && noteDraft.noteId === selectedNote.id
      ? noteDraft.title
      : selectedNote?.title ?? "";
  const activeDraftContent =
    selectedNote && noteDraft.noteId === selectedNote.id
      ? noteDraft.content
      : selectedNote?.content ?? "";

  const standaloneNotes = useMemo(
    () =>
      snapshot.notes.filter(
        (note) => note.links.length === 0 && matchesNoteQuery(note, query),
      ),
    [query, snapshot.notes],
  );
  const projectLinkedNotes = useMemo(
    () =>
      snapshot.notes.filter((note) =>
        note.links.some((link) => link.type === "project") && matchesNoteQuery(note, query),
      ),
    [query, snapshot.notes],
  );
  const taskLinkedNotes = useMemo(
    () =>
      snapshot.notes.filter(
        (note) => note.links.some((link) => link.type === "task") && matchesNoteQuery(note, query),
      ),
    [query, snapshot.notes],
  );

  const createTargets =
    createContext === "task"
      ? snapshot.tasks.map((task) => ({ id: task.id, label: task.title }))
      : createContext === "project"
        ? snapshot.projects.map((project) => ({ id: project.id, label: project.name }))
        : [];

  const linkTargets =
    linkType === "task"
      ? snapshot.tasks.map((task) => ({ id: task.id, label: task.title }))
      : snapshot.projects.map((project) => ({ id: project.id, label: project.name }));

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = "Judul note wajib diisi.";
    if (!content.trim()) newErrors.content = "Isi note wajib diisi.";
    if (createContext !== "standalone" && !createLinkedId) {
      newErrors.createLinkedId = `Pilih ${createContext} yang valid.`;
    }

    setQuickErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      setCreateFeedback("");
      return;
    }

    const links =
      createContext === "standalone" || !createLinkedId
        ? []
        : [{ type: createContext, id: createLinkedId }];

    const createdNote = await addNote({
      title: title.trim(),
      content: content.trim(),
      links,
    });

    setTitle("");
    setContent("");
    setCreateContext("standalone");
    setCreateLinkedId("");
    setShowCreateContext(false);
    setSelectedNoteId(createdNote.id);
    setNoteDraft({
      noteId: createdNote.id,
      title: createdNote.title,
      content: createdNote.content,
    });
    setQuickErrors({});
    setCreateFeedback(`Note "${createdNote.title}" siap dirapikan di library.`);
  }

  async function handleSaveSelectedNote() {
    if (!selectedNote) {
      return;
    }

    if (!activeDraftTitle.trim()) {
      setEditErrors({ title: "Judul note wajib diisi." });
      return;
    }
    
    setEditErrors({});

    await updateNote({
      noteId: selectedNote.id,
      title: activeDraftTitle.trim(),
      content: activeDraftContent.trim(),
    });

    setSaveFeedback("Perubahan note tersimpan.");
  }

  async function handleAddLink() {
    if (!selectedNote || !linkId) {
      return;
    }

    await setNoteLinks({
      noteId: selectedNote.id,
      links: dedupeLinks([...selectedNote.links, { type: linkType, id: linkId }]),
    });

    setLinkId("");
    setLinkFeedback("Relasi note diperbarui.");
  }

  async function handleRemoveLink(linkToRemove: NoteLink) {
    if (!selectedNote) {
      return;
    }

    await setNoteLinks({
      noteId: selectedNote.id,
      links: selectedNote.links.filter(
        (link) =>
          !(link.type === linkToRemove.type && link.id === linkToRemove.id),
      ),
    });

    setLinkFeedback("Relasi note diperbarui.");
  }

  async function handleCreateTaskFromNote() {
    if (!selectedNote) {
      return;
    }

    const nextTitle = activeDraftTitle.trim() || selectedNote.title;
    const nextContent = activeDraftContent.trim() || selectedNote.content;
    const projectLink = selectedNote.links.find((link) => link.type === "project");

    if (nextTitle !== selectedNote.title || nextContent !== selectedNote.content) {
      await updateNote({
        noteId: selectedNote.id,
        title: nextTitle,
        content: nextContent,
      });
    }

    const createdTask = await addTask({
      title: nextTitle,
      projectId: projectLink?.id,
      note: nextContent || undefined,
    });

    await setNoteLinks({
      noteId: selectedNote.id,
      links: dedupeLinks([
        ...selectedNote.links,
        { type: "task", id: createdTask.id },
      ]),
    });

    setTaskFeedback(`Task baru "${createdTask.title}" dibuat dari note ini.`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Core flow / notes"
        title="Notes sekarang jadi ruang capture lalu rapikan."
        description="Tangkap ide lebih dulu, lalu beri konteks saat memang sudah perlu."
        actions={
          <ActionButton href="/projects" variant="secondary">
            Lihat project context
          </ActionButton>
        }
      />

      <SectionCard
        description="Tangkap note cepat, lalu tambahkan konteks hanya bila perlu."
        title="Quick capture"
      >
        <form className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto]" onSubmit={handleCreate}>
          <Field error={quickErrors.title} label="Judul note">
            <Input
              onChange={(event) => {
                setTitle(event.target.value);
                if (quickErrors.title) setQuickErrors(prev => ({ ...prev, title: "" }));
              }}
              placeholder="Contoh: insight flow onboarding"
              value={title}
            />
          </Field>
          <div className="flex items-end">
            <ActionButton type="submit">Simpan note</ActionButton>
          </div>
        </form>

        <div className="mt-4">
          {!showCreateContext && createContext === "standalone" ? (
            <ActionButton onClick={() => setShowCreateContext(true)} variant="ghost">
              Tambah konteks opsional
            </ActionButton>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[220px_220px_auto]">
              <Field label="Konteks">
                <Select
                  onChange={(event) => {
                    setCreateContext(event.target.value as CreateContext);
                    setCreateLinkedId("");
                  }}
                  value={createContext}
                >
                  <option value="standalone">Standalone</option>
                  <option value="project">Project</option>
                  <option value="task">Task</option>
                </Select>
              </Field>
              {createContext !== "standalone" ? (
                <Field error={quickErrors.createLinkedId} label={`Pilih ${createContext}`}>
                  <Select
                    onChange={(event) => {
                      setCreateLinkedId(event.target.value);
                      if (quickErrors.createLinkedId) setQuickErrors(prev => ({ ...prev, createLinkedId: "" }));
                    }}
                    value={createLinkedId}
                  >
                    <option value="">Pilih satu</option>
                    {createTargets.map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <div className="hidden md:block" />
              )}
              <div className="flex items-end">
                <ActionButton
                  onClick={() => {
                    setCreateContext("standalone");
                    setCreateLinkedId("");
                    setShowCreateContext(false);
                  }}
                  type="button"
                  variant="ghost"
                >
                  Sembunyikan konteks
                </ActionButton>
              </div>
            </div>
          )}
        </div>

        <Field error={quickErrors.content} label="Isi note">
          <Textarea
            className="mt-4"
            onChange={(event) => {
              setContent(event.target.value);
              if (quickErrors.content) setQuickErrors(prev => ({ ...prev, content: "" }));
            }}
            placeholder="Tulis insight, keputusan, referensi, atau ide yang ingin diproses lebih lanjut..."
            value={content}
          />
        </Field>

        {createFeedback ? (
          <p className="mt-4 rounded-[20px] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
            {createFeedback}
          </p>
        ) : null}
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <SectionCard
          description="Cari dan scan note tanpa tenggelam di tumpukan card."
          title="Library"
        >
          <div className="space-y-6">
            <div className="grid gap-3">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]"
                  strokeWidth={2.2}
                />
                <Input
                  className="pl-11"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari judul atau isi note"
                  value={query}
                />
              </div>
              <Select
                onChange={(event) =>
                  setLibraryFilter(
                    event.target.value as "all" | "standalone" | "project" | "task",
                  )
                }
                value={libraryFilter}
              >
                <option value="all">Semua konteks</option>
                <option value="standalone">Standalone</option>
                <option value="project">Linked ke project</option>
                <option value="task">Linked ke task</option>
              </Select>
            </div>

            {libraryFilter === "all" || libraryFilter === "standalone" ? (
              <LibraryGroup
                description="Catatan mandiri yang belum ditempelkan ke konteks kerja tertentu."
                notes={standaloneNotes}
                onSelect={setSelectedNoteId}
                selectedNoteId={selectedNote?.id ?? ""}
                title="Inbox / standalone"
              />
            ) : null}
            {libraryFilter === "all" || libraryFilter === "project" ? (
            <div className="border-t border-[var(--border)] pt-6">
              <LibraryGroup
                description="Notes yang sudah menjadi bagian dari konteks project."
                notes={projectLinkedNotes}
                onSelect={setSelectedNoteId}
                selectedNoteId={selectedNote?.id ?? ""}
                title="Linked to projects"
              />
            </div>
            ) : null}
            {libraryFilter === "all" || libraryFilter === "task" ? (
            <div className="border-t border-[var(--border)] pt-6">
              <LibraryGroup
                description="Notes yang sudah menempel ke task dan dipakai sebagai context kerja."
                notes={taskLinkedNotes}
                onSelect={setSelectedNoteId}
                selectedNoteId={selectedNote?.id ?? ""}
                title="Linked to tasks"
              />
            </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard
          description="Isi note tetap jadi pusat, dengan action penting tetap dekat."
          title="Focus"
        >
          {!selectedNote ? (
            <EmptyState
              description="Buat note baru atau pilih note dari library untuk mulai merapikan isi, relasi, dan action lanjutannya."
              title="Belum ada note terpilih"
            />
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold text-[var(--foreground)]">
                      {selectedNote.title}
                    </p>
                    <Pill tone={groupTone(selectedNote)}>{noteContextLabel(selectedNote)}</Pill>
                  </div>
                </div>

                <ActionButton onClick={() => void handleCreateTaskFromNote()}>
                  <Sparkles className="mr-2 size-4" strokeWidth={2.2} />
                  Create task from note
                </ActionButton>
              </div>

              <div className="grid gap-4">
                <Field error={editErrors.title} label="Judul note">
                  <Input
                    onChange={(event) => {
                      setNoteDraft({
                        noteId: selectedNote.id,
                        title: event.target.value,
                        content: activeDraftContent,
                      });
                      if (editErrors.title) setEditErrors({});
                    }}
                    value={activeDraftTitle}
                  />
                </Field>
                <Field label="Isi note">
                  <Textarea
                    className="min-h-44"
                    onChange={(event) =>
                      setNoteDraft({
                        noteId: selectedNote.id,
                        title: activeDraftTitle,
                        content: event.target.value,
                      })
                    }
                    value={activeDraftContent}
                  />
                </Field>
                <div className="flex flex-wrap gap-3">
                  <ActionButton onClick={() => void handleSaveSelectedNote()}>
                    Simpan perubahan
                  </ActionButton>
                  <ActionButton href="/tasks" variant="secondary">
                    Buka Tasks
                  </ActionButton>
                </div>
                {saveFeedback ? (
                  <p className="rounded-[20px] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
                    {saveFeedback}
                  </p>
                ) : null}
                {taskFeedback ? (
                  <p className="rounded-[20px] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
                    {taskFeedback}
                  </p>
                ) : null}
              </div>

              <div className="border-t border-[var(--border)] pt-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-[var(--foreground)]">
                      Linked context
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                      Relasi ke task dan project tetap opsional dan bisa lebih dari satu.
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedNote.links.length ? (
                    selectedNote.links.map((link) => {
                      const label =
                        link.type === "task"
                          ? snapshot.tasks.find((task) => task.id === link.id)?.title ?? "Task"
                          : snapshot.projects.find((project) => project.id === link.id)?.name ??
                            "Project";

                      return (
                        <span
                          className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/80 px-3 py-2 text-xs font-medium text-[var(--foreground)]"
                          key={`${link.type}-${link.id}`}
                        >
                          <span>{link.type}: {label}</span>
                          <button
                            className="rounded-full p-1 text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
                            onClick={() => void handleRemoveLink(link)}
                            type="button"
                          >
                            <X className="size-3.5" strokeWidth={2.2} />
                          </button>
                        </span>
                      );
                    })
                  ) : (
                    <div className="rounded-[20px] bg-[var(--surface)] px-4 py-4 text-sm leading-6 text-[var(--muted)]">
                      Note ini masih standalone. Tambahkan relasi jika sudah ada konteks kerja yang jelas.
                    </div>
                  )}
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-[180px_minmax(0,1fr)_auto]">
                  <Field label="Tambah link">
                    <Select
                      onChange={(event) => {
                        setLinkType(event.target.value as NoteLinkType);
                        setLinkId("");
                      }}
                      value={linkType}
                    >
                      <option value="project">Project</option>
                      <option value="task">Task</option>
                    </Select>
                  </Field>
                  <Field label={`Pilih ${linkType}`}>
                    <Select onChange={(event) => setLinkId(event.target.value)} value={linkId}>
                      <option value="">Pilih satu</option>
                      {linkTargets.map((target) => (
                        <option key={target.id} value={target.id}>
                          {target.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <div className="flex items-end">
                    <ActionButton onClick={() => void handleAddLink()}>
                      <Plus className="mr-2 size-4" strokeWidth={2.2} />
                      Tambah link
                    </ActionButton>
                  </div>
                </div>

                {linkFeedback ? (
                  <p className="mt-4 rounded-[20px] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
                    {linkFeedback}
                  </p>
                ) : null}
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
