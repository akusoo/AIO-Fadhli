"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowRight,
  Minus,
  PencilLine,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  Trash2,
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
  AddShoppingItemInput,
  ShoppingItem,
  ShoppingStatus,
} from "@/lib/domain/models";
import { useAppState } from "@/providers/app-state-provider";
import { cn, formatCurrency, formatNumberInput, parseNumberInput } from "@/lib/utils";

const presetSections = [
  "Dapur & makanan",
  "Kamar mandi & kebersihan",
  "Rumah tangga",
  "Kerja & elektronik",
  "Lainnya",
] as const;

type SectionOption = (typeof presetSections)[number] | "__custom__";
type StatusFilter = "all" | "planned" | "buying" | "bought";

type ShoppingDraft = {
  name: string;
  estimatedPrice: string;
  quantity: string;
  sectionOption: SectionOption;
  customSection: string;
  store: string;
  note: string;
};

function createShoppingDraft(item?: ShoppingItem): ShoppingDraft {
  const isPreset = item
    ? presetSections.includes(item.section as (typeof presetSections)[number])
    : true;

  return {
    name: item?.name ?? "",
    estimatedPrice: item ? formatNumberInput(String(item.estimatedPrice)) : "",
    quantity: item ? String(item.quantity) : "1",
    sectionOption: item ? (isPreset ? (item.section as SectionOption) : "__custom__") : "Lainnya",
    customSection: item && !isPreset ? item.section : "",
    store: item?.store ?? "",
    note: item?.note ?? "",
  };
}

function resolveSection(draft: ShoppingDraft) {
  return draft.sectionOption === "__custom__"
    ? draft.customSection.trim()
    : draft.sectionOption;
}

function statusLabel(status: ShoppingStatus) {
  return {
    planned: "direncanakan",
    buying: "sedang dibeli",
    bought: "sudah dibeli",
  }[status];
}

function statusTone(status: ShoppingStatus) {
  return {
    planned: "neutral",
    buying: "amber",
    bought: "mint",
  }[status] as "neutral" | "amber" | "mint";
}

function nextStatus(status: ShoppingStatus): ShoppingStatus {
  if (status === "planned") {
    return "buying";
  }

  if (status === "buying") {
    return "bought";
  }

  return "bought";
}

function nextStatusLabel(status: ShoppingStatus) {
  if (status === "planned") {
    return "Mulai beli";
  }

  if (status === "buying") {
    return "Tandai sudah dibeli";
  }

  return "Sudah selesai";
}

function matchesItem(item: ShoppingItem, query: string, sectionFilter: string) {
  const normalizedQuery = query.trim().toLowerCase();
  const matchesQuery = !normalizedQuery
    ? true
    : [item.name, item.note ?? "", item.store ?? "", item.section].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      );
  const matchesSection = sectionFilter === "__all__" ? true : item.section === sectionFilter;

  return matchesQuery && matchesSection;
}

function InlineActionButton({
  children,
  onClick,
  type = "button",
  variant = "secondary",
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
}) {
  return (
    <button
      className={cn(
        "inline-flex min-h-10 items-center justify-center rounded-[16px] px-4 py-2 text-sm font-medium transition-all duration-150",
        variant === "primary" &&
          "border border-black bg-black text-white shadow-[var(--shadow-sm)] hover:-translate-y-0.5 hover:bg-black/90",
        variant === "secondary" &&
          "border border-black bg-black text-white hover:-translate-y-0.5 hover:bg-black/90",
        variant === "ghost" &&
          "border border-black bg-black/85 text-white hover:bg-black",
        disabled &&
          "cursor-not-allowed border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] shadow-none hover:translate-y-0 hover:bg-[var(--surface)]",
      )}
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  );
}

function ShoppingEditor({
  draft,
  onChange,
  onCancel,
  onSubmit,
}: {
  draft: ShoppingDraft;
  onChange: (draft: ShoppingDraft) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-4 md:px-5"
      onSubmit={onSubmit}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Nama item">
          <Input
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
            required
            value={draft.name}
          />
        </Field>
        <Field label="Estimasi harga">
          <Input
            inputMode="numeric"
            onChange={(event) =>
              onChange({
                ...draft,
                estimatedPrice: formatNumberInput(event.target.value),
              })
            }
            required
            value={draft.estimatedPrice}
          />
        </Field>
        <Field label="Quantity">
          <Input
            inputMode="numeric"
            min="1"
            onChange={(event) =>
              onChange({
                ...draft,
                quantity: event.target.value.replace(/\D/g, "") || "1",
              })
            }
            required
            value={draft.quantity}
          />
        </Field>
        <Field label="Section">
          <Select
            onChange={(event) =>
              onChange({
                ...draft,
                sectionOption: event.target.value as SectionOption,
              })
            }
            value={draft.sectionOption}
          >
            {presetSections.map((section) => (
              <option key={section} value={section}>
                {section}
              </option>
            ))}
            <option value="__custom__">Custom section</option>
          </Select>
        </Field>
      </div>

      {draft.sectionOption === "__custom__" ? (
        <div className="mt-4">
          <Field label="Nama custom section">
            <Input
              onChange={(event) => onChange({ ...draft, customSection: event.target.value })}
              placeholder="Contoh: Apotek"
              required
              value={draft.customSection}
            />
          </Field>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="Store opsional">
          <Input
            onChange={(event) => onChange({ ...draft, store: event.target.value })}
            placeholder="Contoh: Supermarket dekat kos"
            value={draft.store}
          />
        </Field>
        <Field label="Catatan opsional">
          <Input
            onChange={(event) => onChange({ ...draft, note: event.target.value })}
            placeholder="Contoh: ambil ukuran besar"
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

function ShoppingRow({
  item,
  isEditing,
  editDraft,
  shoppingRecorded,
  isEditingLocked,
  onDraftChange,
  onEditToggle,
  onEditCancel,
  onEditSubmit,
  onDelete,
  onProgress,
  onRecordFinance,
  onRestore,
  onIncreaseQuantity,
  onDecreaseQuantity,
}: {
  item: ShoppingItem;
  isEditing: boolean;
  editDraft: ShoppingDraft;
  shoppingRecorded: boolean;
  isEditingLocked: boolean;
  onDraftChange: (draft: ShoppingDraft) => void;
  onEditToggle: () => void;
  onEditCancel: () => void;
  onEditSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: () => void;
  onProgress: () => void;
  onRecordFinance: () => void;
  onRestore: () => void;
  onIncreaseQuantity: () => void;
  onDecreaseQuantity: () => void;
}) {
  const totalEstimated = item.estimatedPrice * item.quantity;
  const isBought = item.status === "bought";

  return (
    <div data-testid={`shopping-row-${item.id}`}>
      <div className="flex flex-col gap-4 px-4 py-4 md:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-semibold text-[var(--foreground)]">{item.name}</p>
              <Pill tone={statusTone(item.status)}>{statusLabel(item.status)}</Pill>
              {item.sourceWishId ? <Pill>dari wishlist</Pill> : null}
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {[item.section, item.store ? `Toko: ${item.store}` : null, item.note ?? null]
                .filter(Boolean)
                .join(" • ") || "Tanpa detail tambahan."}
            </p>
          </div>

          <div className="shrink-0 text-left lg:text-right">
            <p className="text-lg font-semibold text-[var(--foreground)]">
              {formatCurrency(totalEstimated)}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {formatCurrency(item.estimatedPrice)} x {item.quantity}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {!isBought ? (
            <>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/80 px-2 py-1.5">
                <button
                  className="inline-flex size-8 items-center justify-center rounded-full text-[var(--foreground)] transition-colors hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:text-[var(--muted)]"
                  disabled={isEditingLocked || item.quantity <= 1}
                  onClick={onDecreaseQuantity}
                  type="button"
                >
                  <Minus className="size-4" strokeWidth={2.2} />
                </button>
                <span className="min-w-8 text-center text-sm font-medium">{item.quantity}</span>
                <button
                  className="inline-flex size-8 items-center justify-center rounded-full text-[var(--foreground)] transition-colors hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:text-[var(--muted)]"
                  disabled={isEditingLocked}
                  onClick={onIncreaseQuantity}
                  type="button"
                >
                  <Plus className="size-4" strokeWidth={2.2} />
                </button>
              </div>
              <InlineActionButton onClick={onProgress} variant="primary">
                <ArrowRight className="mr-2 size-4" strokeWidth={2.2} />
                {nextStatusLabel(item.status)}
              </InlineActionButton>
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
            <>
              <InlineActionButton
                disabled={shoppingRecorded}
                onClick={onRecordFinance}
                variant="primary"
              >
                <ReceiptText className="mr-2 size-4" strokeWidth={2.2} />
                {shoppingRecorded ? "Sudah dicatat ke finance" : "Catat ke finance"}
              </InlineActionButton>
              <InlineActionButton onClick={onRestore}>
                <RotateCcw className="mr-2 size-4" strokeWidth={2.2} />
                Kembalikan ke buying
              </InlineActionButton>
            </>
          )}
        </div>
      </div>

      {isEditing ? (
        <ShoppingEditor
          draft={editDraft}
          onCancel={onEditCancel}
          onChange={onDraftChange}
          onSubmit={onEditSubmit}
        />
      ) : null}
    </div>
  );
}

export default function ShoppingPage() {
  const {
    snapshot,
    addShoppingItem,
    deleteShoppingItem,
    recordShoppingPurchase,
    setShoppingStatus,
    updateShoppingItem,
  } = useAppState();
  const [quickDraft, setQuickDraft] = useState<ShoppingDraft>(createShoppingDraft());
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editDraft, setEditDraft] = useState<ShoppingDraft>(createShoppingDraft());
  const [query, setQuery] = useState("");
  const [sectionFilter, setSectionFilter] = useState<string>("__all__");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const transactionSourceIds = useMemo(
    () =>
      new Set(
        snapshot.transactions
          .filter((transaction) => transaction.sourceType === "shopping" && transaction.sourceId)
          .map((transaction) => transaction.sourceId as string),
      ),
    [snapshot.transactions],
  );

  const sectionOptions = useMemo(
    () =>
      Array.from(new Set(snapshot.shoppingItems.map((item) => item.section))).sort((left, right) =>
        left.localeCompare(right),
      ),
    [snapshot.shoppingItems],
  );

  const activeItems = useMemo(
    () =>
      snapshot.shoppingItems.filter(
        (item) =>
          item.status !== "bought" &&
          (statusFilter === "all" || statusFilter === item.status) &&
          matchesItem(item, query, sectionFilter),
      ),
    [query, sectionFilter, snapshot.shoppingItems, statusFilter],
  );

  const boughtItems = useMemo(
    () =>
      snapshot.shoppingItems
        .filter(
          (item) =>
            item.status === "bought" &&
            (statusFilter === "all" || statusFilter === "bought") &&
            matchesItem(item, query, sectionFilter),
        )
        .sort(
          (left, right) =>
            left.section.localeCompare(right.section) || left.name.localeCompare(right.name),
        ),
    [query, sectionFilter, snapshot.shoppingItems, statusFilter],
  );

  const groupedActiveItems = useMemo(() => {
    const groups = new Map<string, ShoppingItem[]>();

    activeItems.forEach((item) => {
      const group = groups.get(item.section) ?? [];
      group.push(item);
      groups.set(item.section, group);
    });

    return Array.from(groups.entries())
      .map(([section, items]) => ({
        section,
        items: items.sort((left, right) => {
          const statusRank = { buying: 0, planned: 1, bought: 2 } as const;
          const rankDiff = statusRank[left.status] - statusRank[right.status];

          if (rankDiff !== 0) {
            return rankDiff;
          }

          return left.name.localeCompare(right.name);
        }),
      }))
      .sort((left, right) => {
        const leftIndex = presetSections.indexOf(left.section as (typeof presetSections)[number]);
        const rightIndex = presetSections.indexOf(
          right.section as (typeof presetSections)[number],
        );
        const normalizedLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
        const normalizedRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;

        return normalizedLeft - normalizedRight || left.section.localeCompare(right.section);
      });
  }, [activeItems]);

  const totalActiveBudget = activeItems.reduce(
    (sum, item) => sum + item.estimatedPrice * item.quantity,
    0,
  );

  async function handleQuickAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const estimatedPrice = parseNumberInput(quickDraft.estimatedPrice);
    const quantity = Number(quickDraft.quantity);
    const section = resolveSection(quickDraft);

    if (!quickDraft.name.trim() || estimatedPrice <= 0 || quantity < 1 || !section) {
      setFeedback("Lengkapi nama item, estimasi harga, quantity, dan section yang valid.");
      return;
    }

    await addShoppingItem({
      name: quickDraft.name.trim(),
      estimatedPrice,
      quantity,
      section,
      store: quickDraft.store.trim() || undefined,
      note: quickDraft.note.trim() || undefined,
    } satisfies AddShoppingItemInput);

    setQuickDraft(createShoppingDraft());
    setShowOptionalFields(false);
    setFeedback(`"${quickDraft.name.trim()}" masuk ke daftar belanja aktif.`);
  }

  function startEditing(item: ShoppingItem) {
    setEditingId(item.id);
    setEditDraft(createShoppingDraft(item));
  }

  async function handleUpdateItem(event: FormEvent<HTMLFormElement>, item: ShoppingItem) {
    event.preventDefault();

    const estimatedPrice = parseNumberInput(editDraft.estimatedPrice);
    const quantity = Number(editDraft.quantity);
    const section = resolveSection(editDraft);

    if (!editDraft.name.trim() || estimatedPrice <= 0 || quantity < 1 || !section) {
      setFeedback("Masih ada field item belanja yang belum valid.");
      return;
    }

    await updateShoppingItem({
      itemId: item.id,
      name: editDraft.name.trim(),
      estimatedPrice,
      quantity,
      section,
      store: editDraft.store.trim() || undefined,
      note: editDraft.note.trim() || undefined,
    });

    setEditingId("");
    setFeedback(`"${editDraft.name.trim()}" berhasil diperbarui.`);
  }

  async function handleDeleteItem(item: ShoppingItem) {
    await deleteShoppingItem(item.id);

    if (editingId === item.id) {
      setEditingId("");
    }

    setFeedback(`"${item.name}" dihapus dari daftar belanja.`);
  }

  async function handleProgress(item: ShoppingItem) {
    const next = nextStatus(item.status);

    await setShoppingStatus({
      itemId: item.id,
      status: next,
    });

    setFeedback(
      next === "buying"
        ? `"${item.name}" masuk tahap sedang dibeli.`
        : `"${item.name}" dipindah ke archive bought.`,
    );
  }

  async function handleRestore(item: ShoppingItem) {
    await setShoppingStatus({
      itemId: item.id,
      status: "buying",
    });

    setFeedback(`"${item.name}" dikembalikan ke list aktif.`);
  }

  async function handleRecordFinance(item: ShoppingItem) {
    await recordShoppingPurchase(item.id);
    setFeedback(`${item.name} dicatat sebagai pengeluaran di finance.`);
  }

  async function handleQuantityChange(item: ShoppingItem, nextQuantity: number) {
    if (nextQuantity < 1) {
      return;
    }

    await updateShoppingItem({
      itemId: item.id,
      name: item.name,
      estimatedPrice: item.estimatedPrice,
      quantity: nextQuantity,
      section: item.section,
      store: item.store,
      note: item.note,
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Core flow / shopping"
        title="Belanja sekarang jadi list operasional yang lebih cepat dipakai."
        description="Fokusnya membaca daftar aktif, maju ke status berikutnya, dan mencatat ke finance setelah item benar-benar selesai dibeli."
        actions={
          <ActionButton href="/wishlist" variant="secondary">
            Kembali ke wishlist
          </ActionButton>
        }
      />

      <SectionCard description="Tambah item secepat mungkin." title="Quick add">
        <form
          className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_220px_140px_220px_auto]"
          onSubmit={handleQuickAdd}
        >
          <Field label="Nama item">
            <Input
              onChange={(event) =>
                setQuickDraft((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Contoh: sabun mandi"
              required
              value={quickDraft.name}
            />
          </Field>
          <Field label="Estimasi harga">
            <Input
              inputMode="numeric"
              onChange={(event) =>
                setQuickDraft((current) => ({
                  ...current,
                  estimatedPrice: formatNumberInput(event.target.value),
                }))
              }
              placeholder="Contoh: 25.000"
              required
              value={quickDraft.estimatedPrice}
            />
          </Field>
          <Field label="Quantity">
            <Input
              inputMode="numeric"
              min="1"
              onChange={(event) =>
                setQuickDraft((current) => ({
                  ...current,
                  quantity: event.target.value.replace(/\D/g, "") || "1",
                }))
              }
              required
              value={quickDraft.quantity}
            />
          </Field>
          <Field label="Section">
            <Select
              onChange={(event) =>
                setQuickDraft((current) => ({
                  ...current,
                  sectionOption: event.target.value as SectionOption,
                }))
              }
              value={quickDraft.sectionOption}
            >
              {presetSections.map((section) => (
                <option key={section} value={section}>
                  {section}
                </option>
              ))}
              <option value="__custom__">Custom section</option>
            </Select>
          </Field>
          <div className="flex items-end">
            <InlineActionButton type="submit" variant="primary">
              <Plus className="mr-2 size-4" strokeWidth={2.2} />
              Tambah item
            </InlineActionButton>
          </div>
        </form>

        {quickDraft.sectionOption === "__custom__" ? (
          <div className="mt-4">
            <Field label="Nama custom section">
              <Input
                onChange={(event) =>
                  setQuickDraft((current) => ({
                    ...current,
                    customSection: event.target.value,
                  }))
                }
                placeholder="Contoh: Apotek"
                required
                value={quickDraft.customSection}
              />
            </Field>
          </div>
        ) : null}

        <div className="mt-4">
          {!showOptionalFields ? (
            <InlineActionButton onClick={() => setShowOptionalFields(true)}>
              Tambah detail opsional
            </InlineActionButton>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Store opsional">
                <Input
                  onChange={(event) =>
                    setQuickDraft((current) => ({ ...current, store: event.target.value }))
                  }
                  placeholder="Contoh: Supermarket dekat kos"
                  value={quickDraft.store}
                />
              </Field>
              <Field label="Catatan opsional">
                <Textarea
                  className="min-h-24"
                  onChange={(event) =>
                    setQuickDraft((current) => ({ ...current, note: event.target.value }))
                  }
                  placeholder="Contoh: ambil yang refill"
                  value={quickDraft.note}
                />
              </Field>
            </div>
          )}
        </div>

        {feedback ? (
          <p className="mt-4 rounded-[20px] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
            {feedback}
          </p>
        ) : null}
      </SectionCard>

      <SectionCard description="Scan cepat daftar aktif dengan filter ringan." title="Belanja aktif">
        <div className="mb-5 flex flex-col gap-3">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_180px]">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]"
                strokeWidth={2.2}
              />
              <Input
                className="pl-11"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari item, section, store, atau catatan"
                value={query}
              />
            </div>
            <Select onChange={(event) => setSectionFilter(event.target.value)} value={sectionFilter}>
              <option value="__all__">Semua section</option>
              {sectionOptions.map((section) => (
                <option key={section} value={section}>
                  {section}
                </option>
              ))}
            </Select>
            <Select
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              value={statusFilter}
            >
              <option value="all">Semua status</option>
              <option value="planned">Direncanakan</option>
              <option value="buying">Sedang dibeli</option>
              <option value="bought">Sudah dibeli</option>
            </Select>
          </div>

          <p className="text-sm text-[var(--muted)]">
            {activeItems.length} item aktif • {formatCurrency(totalActiveBudget)} estimasi total
          </p>
        </div>

        {groupedActiveItems.length ? (
          <div className="space-y-5">
            {groupedActiveItems.map((group) => (
              <div key={group.section}>
                <div className="mb-3">
                  <p className="text-lg font-semibold text-[var(--foreground)]">{group.section}</p>
                  <p className="text-sm text-[var(--muted)]">
                    {group.items.length} item di section ini
                  </p>
                </div>

                <div className="overflow-hidden rounded-[24px] border border-[var(--border)] bg-white/72">
                  {group.items.map((item, index) => (
                    <div
                      className={cn(index !== 0 && "border-t border-[var(--border)]")}
                      key={item.id}
                    >
                      <ShoppingRow
                        editDraft={editingId === item.id ? editDraft : createShoppingDraft(item)}
                        isEditing={editingId === item.id}
                        isEditingLocked={editingId === item.id}
                        item={item}
                        onDecreaseQuantity={() => {
                          void handleQuantityChange(item, item.quantity - 1);
                        }}
                        onDelete={() => {
                          void handleDeleteItem(item);
                        }}
                        onDraftChange={setEditDraft}
                        onEditCancel={() => {
                          setEditingId("");
                        }}
                        onEditSubmit={(event) => {
                          void handleUpdateItem(event, item);
                        }}
                        onEditToggle={() => {
                          if (editingId === item.id) {
                            setEditingId("");
                            return;
                          }

                          startEditing(item);
                        }}
                        onIncreaseQuantity={() => {
                          void handleQuantityChange(item, item.quantity + 1);
                        }}
                        onProgress={() => {
                          void handleProgress(item);
                        }}
                        onRecordFinance={() => {
                          void handleRecordFinance(item);
                        }}
                        onRestore={() => {
                          void handleRestore(item);
                        }}
                        shoppingRecorded={transactionSourceIds.has(item.id)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            description="Tidak ada item aktif yang cocok dengan kondisi filter sekarang."
            title="Belanja aktif kosong"
          />
        )}
      </SectionCard>

      <SectionCard description="Jejak item yang sudah selesai dibeli." title="Archive bought">
        {boughtItems.length ? (
          <div className="overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface)]">
            {boughtItems.map((item, index) => (
              <div
                className={cn(index !== 0 && "border-t border-[var(--border)]")}
                key={item.id}
              >
                <ShoppingRow
                  editDraft={createShoppingDraft(item)}
                  isEditing={false}
                  isEditingLocked={false}
                  item={item}
                  onDecreaseQuantity={() => undefined}
                  onDelete={() => undefined}
                  onDraftChange={() => undefined}
                  onEditCancel={() => undefined}
                  onEditSubmit={() => undefined}
                  onEditToggle={() => undefined}
                  onIncreaseQuantity={() => undefined}
                  onProgress={() => undefined}
                  onRecordFinance={() => {
                    void handleRecordFinance(item);
                  }}
                  onRestore={() => {
                    void handleRestore(item);
                  }}
                  shoppingRecorded={transactionSourceIds.has(item.id)}
                />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            description="Tidak ada item bought yang cocok dengan filter sekarang."
            title="Archive kosong"
          />
        )}
      </SectionCard>
    </div>
  );
}
