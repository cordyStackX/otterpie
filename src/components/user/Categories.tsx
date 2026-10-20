"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { Fetch_to } from "@/utilities";
import routes from "@/routes/user.json";

type Category = {
  id: string;
  name: string;
  percent: number;
  goal: number;
  icons: string;
};

type CategoriesProps = { email: string };

const iconOptions = [
  { name: "Default", path: "/icons/otters/otter-default.svg" },
  { name: "Personal", path: "/icons/otters/otter-personal.svg" },
  { name: "Supplier", path: "/icons/otters/otter-supplier.svg" },
  { name: "Rent", path: "/icons/otters/otter-rent.svg" },
  { name: "Savings", path: "/icons/otters/otter-savings.svg" },
];

const card = "rounded-xl border border-foreground/10 bg-background";

export default function Categories({ email }: CategoriesProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [percent, setPercent] = useState("");
  const [icon, setIcon] = useState(iconOptions[0].path);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadCategories = async () => {
      if (!email) return;
      setLoading(true);
      try {
        const response = await Fetch_to("POST", routes.categories, {
          email,
          page: 1,
          limit: 50,
        });
        if (!cancelled && response.success) {
          setCategories(response.data?.rules ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadCategories();
    return () => {
      cancelled = true;
    };
  }, [email]);

  const totalPercent = categories.reduce((sum, category) => sum + category.percent, 0);
  const remainingPercent = Math.max(100 - totalPercent, 0);
  const formAvailablePercent = Math.max(
    100 - categories
      .filter((category) => category.id !== editingCategoryId)
      .reduce((sum, category) => sum + category.percent, 0),
    0
  );

  const resetForm = () => {
    setEditingCategoryId(null);
    setName("");
    setGoal("");
    setPercent("");
    setIcon(iconOptions[0].path);
    setFormError("");
  };

  const persistCategories = async (nextCategories: Category[]) => {
    setSaving(true);
    setActionError("");
    try {
      const response = await Fetch_to("PATCH", routes.modify_categories, {
        email,
        category: nextCategories,
      });
      if (!response.success) {
        setActionError(response.message || "Could not save categories.");
        return false;
      }
      setCategories(nextCategories);
      return true;
    } catch {
      setActionError("Could not save categories. Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async(event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = name.trim();
    const amount = Number(goal || 0);
    const deduction = Number(percent);

    if (!cleanName) {
      setFormError("Enter a category name.");
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setFormError("Enter a valid goal amount.");
      return;
    }
    if (!Number.isFinite(deduction) || deduction <= 0 || deduction > formAvailablePercent) {
      setFormError(`Choose a deduction from 1% to ${formAvailablePercent}%.`);
      return;
    }

    const updated: Category = {
      id: editingCategoryId ?? crypto.randomUUID(),
      name: cleanName,
      percent: deduction,
      goal: amount,
      icons: icon,
    };
    const nextCategories = editingCategoryId
      ? categories.map((category) => category.id === editingCategoryId ? updated : category)
      : [...categories, updated];

    if (!(await persistCategories(nextCategories))) {
      setFormError("Could not save this category. Please try again.");
      return;
    }

    resetForm();
    setDialogOpen(false);
  };

  const openEditCategory = (category: Category) => {
    setEditingCategoryId(category.id);
    setName(category.name);
    setGoal(category.goal ? String(category.goal) : "");
    setPercent(String(category.percent));
    setIcon(category.icons);
    setFormError("");
    setDialogOpen(true);
  };

  const toggleDeleteSelection = (id: string) => {
    setSelectedForDelete((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const deleteSelected = async () => {
    const nextCategories = categories.filter((category) => !selectedForDelete.includes(category.id));
    if (await persistCategories(nextCategories)) setSelectedForDelete([]);
  };

  return (
    <div className="space-y-6 text-foreground">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Wallet planning</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Categories</h1>
          <p className="mt-1 text-sm text-foreground/55">
            Choose how incoming funds are divided between your goals.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {editing && selectedForDelete.length > 0 && (
            <button
              type="button"
              onClick={deleteSelected}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg border border-rose-500/40 px-4 py-2.5 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
            >
              Delete selected ({selectedForDelete.length})
            </button>
          )}
          {editing && (
            <button
              type="button"
              onClick={() => { setDialogOpen(true); resetForm(); }}
              disabled={remainingPercent <= 0 || saving}
              title={remainingPercent <= 0 ? "All 100% is already allocated. Edit or delete a category to make room." : undefined}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              Add category
            </button>
          )}
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setSelectedForDelete([]);
              }}
              className="rounded-lg border border-rose-500/30 px-4 py-2.5 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setEditing((value) => !value);
              setSelectedForDelete([]);
            }}
            className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
              editing
                ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                : "border border-foreground/15 text-foreground/80 hover:bg-foreground/5"
            }`}
          >
            {editing ? "Save" : "Edit categories"}
          </button>
        </div>
      </header>

      {actionError && (
        <p role="alert" className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-600">
          {actionError}
        </p>
      )}

      <section aria-label="Category allocation summary" className="grid gap-3 sm:grid-cols-3">
        <div className={`${card} p-4`}>
          <p className="text-xs font-medium text-foreground/50">Categories</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{categories.length}</p>
          <p className="mt-1 text-xs text-foreground/45">Your active fund goals</p>
        </div>
        <div className={`${card} p-4`}>
          <p className="text-xs font-medium text-foreground/50">Allocated</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{totalPercent}%</p>
          <p className="mt-1 text-xs text-foreground/45">of 100% maximum</p>
        </div>
        <div className={`${card} p-4`}>
          <p className="text-xs font-medium text-foreground/50">Unassigned</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{remainingPercent}%</p>
          <p className="mt-1 text-xs text-foreground/45">Available to allocate</p>
        </div>
      </section>

      <section aria-labelledby="categories-list-title" className={`${card} overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-foreground/10 px-5 py-4">
          <div>
            <h2 id="categories-list-title" className="text-sm font-semibold">Your categories</h2>
            <p className="mt-1 text-xs text-foreground/50">Deductions apply to incoming wallet funds.</p>
          </div>
          <span className="rounded-full bg-foreground/5 px-2.5 py-1 text-xs tabular-nums text-foreground/60">
            {categories.length}
          </span>
        </div>

        {loading ? (
          <p className="px-5 py-16 text-center text-sm text-foreground/50">Loading categories…</p>
        ) : categories.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-6 w-6">
                <path d="M12 3.5v17M3.5 12h17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
            <p className="mt-3 text-sm font-medium">No categories yet</p>
            <p className="mt-1 text-xs text-foreground/50">Create a category to start planning your incoming funds.</p>
            <button
              type="button"
              onClick={() => { setEditing(true); setDialogOpen(true); resetForm(); }}
              className="mt-4 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Add your first category
            </button>
          </div>
        ) : (
          <ul className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {categories.map((category) => {
              const selected = selectedForDelete.includes(category.id);
              return (
                <li key={category.id} className="space-y-2">
                  <div
                    role={editing ? "checkbox" : undefined}
                    aria-checked={editing ? selected : undefined}
                    aria-label={editing ? `${category.name}, ${selected ? "marked for deletion" : "click to mark for deletion"}` : undefined}
                    tabIndex={editing ? 0 : undefined}
                    onClick={() => editing && toggleDeleteSelection(category.id)}
                    onKeyDown={(event) => {
                      if (editing && (event.key === "Enter" || event.key === " ")) {
                        event.preventDefault();
                        toggleDeleteSelection(category.id);
                      }
                    }}
                    className={`relative rounded-xl border p-4 transition-colors ${
                      editing
                        ? selected
                          ? "cursor-pointer border-rose-500 bg-rose-500/10 ring-1 ring-rose-500/20"
                          : "cursor-pointer border-foreground/10 hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        : "border-foreground/10 hover:border-primary/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-foreground/5">
                          <Image src={category.icons} alt="" width={32} height={32} className="h-8 w-8 object-contain" />
                        </span>
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold">{category.name}</h3>
                          <p className="mt-0.5 text-xs text-foreground/50">{category.goal > 0 ? `Goal ${formatAmount(category.goal)}` : "No goal set"}</p>
                        </div>
                      </div>
                      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${selected ? "bg-rose-600 text-white" : "bg-primary/10 text-primary"}`}>
                        {selected && (
                          <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
                            <path d="m3.5 8.2 2.8 2.8 6.2-6.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                        {category.percent}%
                      </span>
                    </div>
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-foreground/8">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${category.percent}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-foreground/45">of every incoming payment</p>
                  </div>
                  {editing && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => openEditCategory(category)}
                        className="rounded-md px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        Edit category
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-foreground/35 p-4 backdrop-blur-[2px]" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setDialogOpen(false);
        }}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-category-title"
            className="my-auto w-full max-w-lg rounded-2xl border border-foreground/10 bg-background p-5 text-foreground shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="add-category-title" className="text-lg font-semibold">{editingCategoryId ? "Edit category" : "Add category"}</h2>
                <p className="mt-1 text-sm text-foreground/55">Set an icon, goal, and share of incoming funds.</p>
              </div>
              <button
                type="button"
                aria-label="Close dialog"
                onClick={() => setDialogOpen(false)}
                className="-mr-2 -mt-1 flex h-9 w-9 items-center justify-center rounded-lg text-foreground/50 transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-5 w-5">
                  <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <form className="mt-5 space-y-5" onSubmit={handleSubmit}>
              <fieldset>
                <legend className="text-sm font-medium">Choose an icon</legend>
                <div className="mt-2 grid grid-cols-5 gap-2">
                  {iconOptions.map((option) => (
                    <button
                      key={option.path}
                      type="button"
                      aria-label={option.name}
                      aria-pressed={icon === option.path}
                      onClick={() => setIcon(option.path)}
                      className={`flex aspect-square items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${icon === option.path ? "border-primary bg-primary/10" : "border-foreground/10 hover:bg-foreground/5"}`}
                    >
                      <Image src={option.path} alt="" width={36} height={36} className="h-9 w-9 object-contain" />
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="block text-sm font-medium" htmlFor="category-name">
                Category name
                <input
                  id="category-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={40}
                  placeholder="e.g. Savings"
                  className="mt-1.5 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2.5 text-sm font-normal outline-none placeholder:text-foreground/35 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium" htmlFor="category-goal">
                  Goal amount <span className="font-normal text-foreground/45">(optional)</span>
                  <input
                    id="category-goal"
                    type="number"
                    min="0"
                    step="any"
                    value={goal}
                    onChange={(event) => setGoal(event.target.value)}
                    placeholder="No limit"
                    className="mt-1.5 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2.5 text-sm font-normal outline-none placeholder:text-foreground/35 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                  />
                </label>
                <label className="block text-sm font-medium" htmlFor="category-percent">
                  Deduction percentage
                  <div className="relative mt-1.5">
                    <input
                      id="category-percent"
                      type="number"
                      min="1"
                      max={formAvailablePercent}
                      step="0.1"
                      required
                      value={percent}
                      onChange={(event) => setPercent(event.target.value)}
                      placeholder="e.g. 10"
                      className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2.5 pr-9 text-sm font-normal outline-none placeholder:text-foreground/35 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-foreground/45">%</span>
                  </div>
                  <span className="mt-1 block text-xs font-normal text-foreground/45">
                    Up to {formAvailablePercent}% available · allocations are capped at 100%
                  </span>
                </label>
              </div>

              {formError && <p role="alert" className="text-sm text-rose-600">{formError}</p>}
              <div className="flex gap-3 border-t border-foreground/10 pt-4">
                <button
                  type="button"
                  onClick={() => { resetForm(); setDialogOpen(false); }}
                  className="flex-1 rounded-lg border border-foreground/15 px-4 py-2.5 text-sm font-medium text-foreground/75 transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving…" : editingCategoryId ? "Save changes" : "Add category"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}
