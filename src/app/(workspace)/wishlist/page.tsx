"use client";

import { useMemo, useState, type FormEvent } from "react";
import { ArrowRightLeft, PencilLine, Search, Sparkles, Trash2 } from "lucide-react";
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
import type { Priority, WishItem } from "@/lib/domain/models";
import { useAppState } from "@/providers/app-state-provider";
import {
  cn,
  formatCompactCurrency,
  formatCurrency,
  formatNumberInput,
  parseNumberInput,
} from "@/lib/utils";

const prioritySections: Array<{ id: Priority; title: string; description: string }> = [
  {
    id: "high",
    title: "Prioritas tinggi",
    description: "Paling layak dipikirkan lebih dulu.",
  },
  {
    id: "medium",
    title: "Prioritas sedang",
    description: "Penting, tetapi belum perlu didorong sekarang.",
  },
  {
    id: "low",
    title: "Prioritas rendah",
    description: "Disimpan tanpa membebani fokus utama.",
  },
];

type WishDraft = {
  name: string;
  targetPrice: string;
  priority: Priority;
  note: string;
};

function priorityLabel(priority: Priority) {
  return {
    high: "high",
    medium: "medium",
    low: "low",
  }[priority];
}

function wishStatusTone(status: WishItem["status"]) {
  return {
    wish: "neutral",
    ready: "mint",
    moved: "amber",
  }[status] as "neutral" | "mint" | "amber";
}

function wishStatusLabel(status: WishItem["status"]) {
  return {
    wish: "Masih dipikirkan",
    ready: "Siap dibeli",
    moved: "Dipindah ke shopping",
  }[status];
}

function shoppingStatusLabel(status: "planned" | "buying" | "bought") {
  return {
    planned: "Shopping: direncanakan",
    buying: "Shopping: sedang dibeli",
    bought: "Shopping: sudah dibeli",
  }[status];
}

function sortWishItems(left: WishItem, right: WishItem) {
  const rank = (item: WishItem) => {
    if (item.status === "ready") {
      return 0;
    }

    if (item.status === "wish") {
      return 1;
    }

    return 2;
  };

  const rankDiff = rank(left) - rank(right);

  if (rankDiff !== 0) {
    return rankDiff;
  }

  return left.name.localeCompare(right.name);
}

function createWishDraft(item?: WishItem): WishDraft {
  return {
    name: item?.name ?? "",
    targetPrice: item ? formatNumberInput(String(item.targetPrice)) : "",
    priority: item?.priority ?? "medium",
    note: item?.note ?? "",
  };
}

function matchesQuery(item: WishItem, query: string) {
  if (!query) {
    return true;
  }

  const normalized = query.toLowerCase();
  return [item.name, item.note ?? ""].some((value) =>
    value.toLowerCase().includes(normalized),
  );
}

function CompactStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[18px] border border-[var(--border)] bg-[rgba(255,255,255,0.68)] px-4 py-4 shadow-[var(--shadow-sm)]">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-xl font-semibold tracking-tight text-[var(--foreground)]">
        {value}
      </p>
    </div>
  );
}

function ToggleButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "rounded-[16px] px-4 py-2 text-sm font-medium transition-all duration-150",
        active
          ? "bg-[var(--foreground)] text-white shadow-[var(--shadow-sm)]"
          : "border border-[var(--border)] bg-[rgba(255,255,255,0.76)] text-[var(--foreground)] hover:border-[var(--border-strong)] hover:bg-white",
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function InlineActionButton({
  children,
  onClick,
  type = "button",
  variant = "secondary",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <button
      className={cn(
        "inline-flex min-h-10 items-center justify-center rounded-[16px] px-4 py-2 text-sm font-medium transition-all duration-150",
        variant === "primary" &&
          "bg-[var(--foreground)] text-white shadow-[var(--shadow-sm)] hover:-translate-y-0.5 hover:bg-[var(--accent-strong)]",
        variant === "secondary" &&
          "border border-[var(--border)] bg-[rgba(255,255,255,0.76)] text-[var(--foreground)] hover:border-[var(--border-strong)] hover:bg-white",
        variant === "ghost" &&
          "text-[var(--accent-strong)] hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)]",
      )}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  );
}

function WishEditor({
  draft,
  onChange,
  onCancel,
  onSubmit,
}: {
  draft: WishDraft;
  onChange: (draft: WishDraft) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-4 md:px-5" onSubmit={onSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nama item">
          <Input
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
            required
            value={draft.name}
          />
        </Field>
        <Field label="Target harga">
          <Input
            inputMode="numeric"
            onChange={(event) =>
              onChange({
                ...draft,
                targetPrice: formatNumberInput(event.target.value),
              })
            }
            required
            value={draft.targetPrice}
          />
        </Field>
        <Field label="Prioritas">
          <Select
            onChange={(event) =>
              onChange({ ...draft, priority: event.target.value as Priority })
            }
            value={draft.priority}
          >
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
          </Select>
        </Field>
        <Field label="Catatan">
          <Input
            onChange={(event) => onChange({ ...draft, note: event.target.value })}
            placeholder="Catatan singkat"
            value={draft.note}
          />
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <InlineActionButton type="submit" variant="primary">
          Simpan perubahan
        </InlineActionButton>
        <InlineActionButton onClick={onCancel}>Batal</InlineActionButton>
      </div>
    </form>
  );
}

function WishlistRow({
  item,
  shoppingStatus,
  isEditing,
  editDraft,
  onDraftChange,
  onEditToggle,
  onEditCancel,
  onEditSubmit,
  onDelete,
  onMarkReady,
  onMove,
  onRevertToWish,
  archive = false,
}: {
  item: WishItem;
  shoppingStatus?: "planned" | "buying" | "bought";
  isEditing: boolean;
  editDraft: WishDraft;
  onDraftChange: (draft: WishDraft) => void;
  onEditToggle: () => void;
  onEditCancel: () => void;
  onEditSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: () => void;
  onMarkReady: () => void;
  onMove: () => void;
  onRevertToWish: () => void;
  archive?: boolean;
}) {
  return (
    <div>
      <div className="flex flex-col gap-4 px-4 py-4 md:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-semibold text-[var(--foreground)]">{item.name}</p>
              <Pill tone={wishStatusTone(item.status)}>{wishStatusLabel(item.status)}</Pill>
              {archive && shoppingStatus ? <Pill>{shoppingStatusLabel(shoppingStatus)}</Pill> : null}
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {item.note
                ? item.note
                : archive
                  ? "Jejak perpindahan ke shopping disimpan di sini."
                  : "Belum ada catatan tambahan."}
            </p>
          </div>

          <div className="shrink-0 text-left lg:text-right">
            <p className="text-lg font-semibold text-[var(--foreground)]">
              {formatCurrency(item.targetPrice)}
            </p>
            {!archive ? (
              <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                prioritas {priorityLabel(item.priority)}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {!archive ? (
            <>
              {item.status === "wish" ? (
                <InlineActionButton onClick={onMarkReady}>Tandai siap beli</InlineActionButton>
              ) : null}
              {item.status === "ready" ? (
                <>
                  <InlineActionButton onClick={onRevertToWish}>Belum dulu</InlineActionButton>
                  <InlineActionButton onClick={onMove} variant="primary">
                    <ArrowRightLeft className="mr-2 size-4" strokeWidth={2.2} />
                    Pindahkan ke shopping
                  </InlineActionButton>
                </>
              ) : null}
              <InlineActionButton onClick={onEditToggle} variant="ghost">
                <PencilLine className="mr-2 size-4" strokeWidth={2.2} />
                Edit
              </InlineActionButton>
              <InlineActionButton onClick={onDelete} variant="ghost">
                <Trash2 className="mr-2 size-4" strokeWidth={2.2} />
                Hapus
              </InlineActionButton>
            </>
          ) : (
            <ActionButton href="/shopping" variant="ghost">
              Buka shopping
            </ActionButton>
          )}
        </div>
      </div>

      {isEditing ? (
        <WishEditor
          draft={editDraft}
          onCancel={onEditCancel}
          onChange={onDraftChange}
          onSubmit={onEditSubmit}
        />
      ) : null}
    </div>
  );
}

export default function WishlistPage() {
  const {
    snapshot,
    addWish,
    deleteWish,
    moveWishToShopping,
    setWishStatus,
    updateWish,
  } = useAppState();
  const [quickDraft, setQuickDraft] = useState<WishDraft>(createWishDraft());
  const [showQuickNote, setShowQuickNote] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [query, setQuery] = useState("");
  const [readyOnly, setReadyOnly] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [editDraft, setEditDraft] = useState<WishDraft>(createWishDraft());

  const filteredActiveItems = useMemo(
    () =>
      snapshot.wishItems.filter(
        (item) =>
          item.status !== "moved" &&
          (!readyOnly || item.status === "ready") &&
          matchesQuery(item, query),
      ),
    [query, readyOnly, snapshot.wishItems],
  );

  const filteredArchiveItems = useMemo(
    () =>
      snapshot.wishItems
        .filter((item) => item.status === "moved" && matchesQuery(item, query))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [query, snapshot.wishItems],
  );

  const activeCount = snapshot.wishItems.filter((item) => item.status !== "moved").length;
  const readyCount = snapshot.wishItems.filter((item) => item.status === "ready").length;
  const totalTarget = snapshot.wishItems
    .filter((item) => item.status !== "moved")
    .reduce((sum, item) => sum + item.targetPrice, 0);

  const shoppingStatusByWishId = useMemo(
    () =>
      new Map(
        snapshot.shoppingItems.flatMap((item) =>
          item.sourceWishId ? [[item.sourceWishId, item.status] as const] : [],
        ),
      ),
    [snapshot.shoppingItems],
  );

  const groupedItems = useMemo(
    () =>
      prioritySections.map((section) => ({
        ...section,
        items: filteredActiveItems
          .filter((item) => item.priority === section.id)
          .sort(sortWishItems),
      })),
    [filteredActiveItems],
  );

  async function handleCreateWish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextTargetPrice = parseNumberInput(quickDraft.targetPrice);

    if (!quickDraft.name.trim() || nextTargetPrice <= 0) {
      setFeedback("Isi nama item dan target harga yang valid dulu.");
      return;
    }

    await addWish({
      name: quickDraft.name.trim(),
      targetPrice: nextTargetPrice,
      priority: quickDraft.priority,
      note: quickDraft.note.trim() || undefined,
    });

    setQuickDraft(createWishDraft());
    setShowQuickNote(false);
    setFeedback(`"${quickDraft.name.trim()}" masuk ke wishlist.`);
  }

  function startEditing(item: WishItem) {
    setEditingId(item.id);
    setEditDraft(createWishDraft(item));
  }

  async function handleUpdateWish(event: FormEvent<HTMLFormElement>, item: WishItem) {
    event.preventDefault();

    const nextTargetPrice = parseNumberInput(editDraft.targetPrice);

    if (!editDraft.name.trim() || nextTargetPrice <= 0) {
      setFeedback("Nama item dan target harga masih perlu dirapikan.");
      return;
    }

    await updateWish({
      wishId: item.id,
      name: editDraft.name.trim(),
      targetPrice: nextTargetPrice,
      priority: editDraft.priority,
      note: editDraft.note.trim() || undefined,
    });

    setEditingId("");
    setFeedback(`"${editDraft.name.trim()}" berhasil diperbarui.`);
  }

  async function handleDeleteWish(item: WishItem) {
    await deleteWish(item.id);

    if (editingId === item.id) {
      setEditingId("");
    }

    setFeedback(`"${item.name}" dihapus dari wishlist.`);
  }

  async function handleSetWishStatus(item: WishItem, status: WishItem["status"]) {
    await setWishStatus({
      wishId: item.id,
      status,
    });

    setFeedback(
      status === "ready"
        ? `"${item.name}" sekarang siap dibeli.`
        : `"${item.name}" dikembalikan ke mode pertimbangan.`,
    );
  }

  async function handleMoveToShopping(item: WishItem) {
    await moveWishToShopping(item.id);

    if (editingId === item.id) {
      setEditingId("");
    }

    setFeedback(`"${item.name}" dipindahkan ke shopping.`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Core flow / wishlist"
        title="Wishlist jadi ruang keputusan sebelum benar-benar belanja."
        description="Simpan item incaran, tandai mana yang sudah matang, lalu dorong ke shopping saat memang siap."
        actions={
          <ActionButton href="/shopping" variant="secondary">
            Buka shopping list
          </ActionButton>
        }
      />

      <SectionCard title="Ringkasan" description="Cukup tiga angka untuk membaca kondisi wishlist tanpa membuat halaman terasa seperti dashboard.">
        <div className="grid gap-3 md:grid-cols-3">
          <CompactStat label="Wish aktif" value={String(activeCount)} />
          <CompactStat label="Siap dibeli" value={String(readyCount)} />
          <CompactStat label="Total target" value={formatCompactCurrency(totalTarget)} />
        </div>
      </SectionCard>

      <SectionCard title="Quick add" description="Tambah item baru dengan cepat. Catatan hanya dibuka saat memang perlu.">
        <form className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_220px_180px_auto]" onSubmit={handleCreateWish}>
          <Field label="Nama item">
            <Input
              onChange={(event) =>
                setQuickDraft((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Contoh: Mechanical keyboard"
              required
              value={quickDraft.name}
            />
          </Field>
          <Field label="Target harga">
            <Input
              inputMode="numeric"
              onChange={(event) =>
                setQuickDraft((current) => ({
                  ...current,
                  targetPrice: formatNumberInput(event.target.value),
                }))
              }
              placeholder="Contoh: 450.000"
              required
              value={quickDraft.targetPrice}
            />
          </Field>
          <Field label="Prioritas">
            <Select
              onChange={(event) =>
                setQuickDraft((current) => ({
                  ...current,
                  priority: event.target.value as Priority,
                }))
              }
              value={quickDraft.priority}
            >
              <option value="high">high</option>
              <option value="medium">medium</option>
              <option value="low">low</option>
            </Select>
          </Field>
          <div className="flex items-end gap-3">
            <InlineActionButton type="submit" variant="primary">
              <Sparkles className="mr-2 size-4" strokeWidth={2.2} />
              Simpan wish
            </InlineActionButton>
          </div>
        </form>

        <div className="mt-4">
          {!showQuickNote ? (
            <InlineActionButton onClick={() => setShowQuickNote(true)}>
              Tambah catatan
            </InlineActionButton>
          ) : (
            <Field label="Catatan singkat">
              <Textarea
                className="min-h-24"
                onChange={(event) =>
                  setQuickDraft((current) => ({ ...current, note: event.target.value }))
                }
                placeholder="Promo, alasan beli, atau hal yang masih dipertimbangkan."
                value={quickDraft.note}
              />
            </Field>
          )}
        </div>

        {feedback ? (
          <p className="mt-4 rounded-[20px] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
            {feedback}
          </p>
        ) : null}
      </SectionCard>

      <SectionCard title="Scan cepat" description="Cari item tertentu atau fokus ke item yang memang sudah siap dibeli.">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" strokeWidth={2.2} />
            <Input
              className="pl-11"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari nama item atau catatan"
              value={query}
            />
          </div>
          <ToggleButton
            active={readyOnly}
            label="Hanya siap dibeli"
            onClick={() => setReadyOnly((current) => !current)}
          />
        </div>
      </SectionCard>

      {filteredActiveItems.length === 0 ? (
        <SectionCard title="Wishlist aktif">
          <EmptyState
            description={
              query || readyOnly
                ? "Tidak ada item aktif yang cocok dengan filter saat ini."
                : "Belum ada item aktif di wishlist."
            }
            title="Tidak ada item yang tampil"
          />
        </SectionCard>
      ) : (
        <div className="space-y-5">
          {groupedItems
            .filter((section) => section.items.length > 0 || (!query && !readyOnly))
            .map((section) => (
              <SectionCard
                description={section.description}
                key={section.id}
                title={section.title}
              >
                {section.items.length ? (
                  <div className="overflow-hidden rounded-[24px] border border-[var(--border)] bg-white/72">
                    {section.items.map((item, index) => (
                      <div
                        className={cn(index !== 0 && "border-t border-[var(--border)]")}
                        key={item.id}
                      >
                        <WishlistRow
                          editDraft={editingId === item.id ? editDraft : createWishDraft(item)}
                          isEditing={editingId === item.id}
                          item={item}
                          onDelete={() => {
                            void handleDeleteWish(item);
                          }}
                          onDraftChange={setEditDraft}
                          onEditCancel={() => {
                            setEditingId("");
                          }}
                          onEditSubmit={(event) => {
                            void handleUpdateWish(event, item);
                          }}
                          onEditToggle={() => {
                            if (editingId === item.id) {
                              setEditingId("");
                              return;
                            }

                            startEditing(item);
                          }}
                          onMarkReady={() => {
                            void handleSetWishStatus(item, "ready");
                          }}
                          onMove={() => {
                            void handleMoveToShopping(item);
                          }}
                          onRevertToWish={() => {
                            void handleSetWishStatus(item, "wish");
                          }}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    description="Belum ada item di kelompok prioritas ini."
                    title="Masih kosong"
                  />
                )}
              </SectionCard>
            ))}
        </div>
      )}

      <SectionCard
        description="Jejak item yang sudah naik ke shopping tetap ada, tapi dipisahkan agar area utama tetap bersih."
        title="Archive"
      >
        {filteredArchiveItems.length ? (
          <div className="overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface)]">
            {filteredArchiveItems.map((item, index) => (
              <div
                className={cn(index !== 0 && "border-t border-[var(--border)]")}
                key={item.id}
              >
                <WishlistRow
                  archive
                  editDraft={createWishDraft(item)}
                  isEditing={false}
                  item={item}
                  onDelete={() => undefined}
                  onDraftChange={() => undefined}
                  onEditCancel={() => undefined}
                  onEditSubmit={() => undefined}
                  onEditToggle={() => undefined}
                  onMarkReady={() => undefined}
                  onMove={() => undefined}
                  onRevertToWish={() => undefined}
                  shoppingStatus={shoppingStatusByWishId.get(item.id)}
                />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            description={
              query
                ? "Tidak ada item archive yang cocok dengan pencarian."
                : "Begitu ada item yang dipindah ke shopping, jejaknya muncul di sini."
            }
            title="Archive masih kosong"
          />
        )}
      </SectionCard>
    </div>
  );
}
