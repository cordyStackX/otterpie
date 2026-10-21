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
  color: string;
};

type CategoriesProps = { email: string };

const iconOptions = [
  { name: "Default", path: "/icons/otters/otter-default.svg" },
  { name: "Personal", path: "/icons/otters/otter-personal.svg" },
  { name: "Supplier", path: "/icons/otters/otter-supplier.svg" },
  { name: "Rent", path: "/icons/otters/otter-rent.svg" },
  { name: "Savings", path: "/icons/otters/otter-savings.svg" },
];

const colorOptions = [
  { name: "Cyan", value: "#42c7df" },
  { name: "Violet", value: "#9b7bea" },
  { name: "Coral", value: "#f07878" },
  { name: "Amber", value: "#e9ad4b" },
  { name: "Mint", value: "#56c9a5" },
  { name: "Blue", value: "#6298ed" },
  { name: "Rose", value: "#e879b5" },
  { name: "Lime", value: "#a4c85a" },
];
const DEFAULT_COLOR = colorOptions[0].value;
const CATEGORIES_PER_PAGE = 10;
const skeletonClass = "animate-pulse motion-reduce:animate-none rounded-md bg-foreground/10";

const card = "rounded-xl border border-foreground/10 bg-background";

export default function Categories({ email }: CategoriesProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryPage, setCategoryPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [percent, setPercent] = useState("");
  const [icon, setIcon] = useState(iconOptions[0].path);
  const [color, setColor] = useState(DEFAULT_COLOR);
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
  const totalCategoryPages = Math.max(Math.ceil(categories.length / CATEGORIES_PER_PAGE), 1);
  const currentCategoryPage = Math.min(categoryPage, totalCategoryPages);
  const visibleCategories = categories.slice(
    (currentCategoryPage - 1) * CATEGORIES_PER_PAGE,
    currentCategoryPage * CATEGORIES_PER_PAGE,
  );
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
    setColor(DEFAULT_COLOR);
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
    const share = Number(percent);

    if (!cleanName) {
      setFormError("Enter a category name.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("Enter a goal amount greater than zero.");
      return;
    }
    if (!Number.isFinite(share) || share <= 0 || share > formAvailablePercent) {
      setFormError(`Choose a share from 1% to ${formAvailablePercent}%.`);
      return;
    }

    const updated: Category = {
      id: editingCategoryId ?? crypto.randomUUID(),
      name: cleanName,
      percent: share,
      goal: amount,
      icons: icon,
      color,
    };
    const nextCategories = editingCategoryId
      ? categories.map((category) => category.id === editingCategoryId ? updated : category)
      : [...categories, updated];

    if (!(await persistCategories(nextCategories))) {
      setFormError("Could not save this category. Please try again.");
      return;
    }

    if (!editingCategoryId) {
      setCategoryPage(Math.ceil(nextCategories.length / CATEGORIES_PER_PAGE));
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
    setColor(category.color || DEFAULT_COLOR);
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
            Set the share each incoming payment adds to your categories.
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

      <aside className="rounded-xl border border-primary/15 bg-primary/[0.05] px-4 py-3.5 text-sm leading-6 text-foreground/65">
        <p className="font-semibold text-foreground">How category shares work</p>
        <p className="mt-1">
          Each successful incoming payment adds its percentage to a category. For example, two 1-unit payments at 40% add 0.4 + 0.4 = 0.8 units. Contributions build toward the category goal, which stops further allocation when reached. This tracks amounts in your wallet; it does not move funds into separate on-chain wallets.
        </p>
      </aside>

      {actionError && (
        <p role="alert" className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-600">
          {actionError}
        </p>
      )}

      <section aria-label="Category allocation summary" className="grid gap-3 sm:grid-cols-3">
        <div className={`${card} p-4`}>
          <p className="text-xs font-medium text-foreground/50">Categories</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {loading ? <span aria-hidden="true" className={`inline-block h-7 w-12 align-middle ${skeletonClass}`} /> : categories.length}
          </p>
          <p className="mt-1 text-xs text-foreground/45">Your active fund goals</p>
        </div>
        <div className={`${card} p-4`}>
          <p className="text-xs font-medium text-foreground/50">Allocated</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {loading ? <span aria-hidden="true" className={`inline-block h-7 w-16 align-middle ${skeletonClass}`} /> : `${totalPercent}%`}
          </p>
          <p className="mt-1 text-xs text-foreground/45">of 100% maximum</p>
        </div>
        <div className={`${card} p-4`}>
          <p className="text-xs font-medium text-foreground/50">Unassigned</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {loading ? <span aria-hidden="true" className={`inline-block h-7 w-16 align-middle ${skeletonClass}`} /> : `${remainingPercent}%`}
          </p>
          <p className="mt-1 text-xs text-foreground/45">Available to allocate</p>
        </div>
      </section>

      <section aria-labelledby="categories-list-title" className={`${card} overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-foreground/10 px-5 py-4">
          <div>
            <h2 id="categories-list-title" className="text-sm font-semibold">Your categories</h2>
            <p className="mt-1 text-xs text-foreground/50">Each percentage is applied to every successful incoming payment.</p>
          </div>
          <span className="rounded-full bg-foreground/5 px-2.5 py-1 text-xs tabular-nums text-foreground/60">
            {loading ? <span aria-hidden="true" className={`inline-block h-3 w-5 align-middle ${skeletonClass}`} /> : categories.length}
          </span>
        </div>

        {loading ? (
          <div role="status" aria-label="Loading categories" className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} aria-hidden="true" className="rounded-xl border border-foreground/10 p-4">
                <div className="flex items-center gap-3">
                  <span className={`h-11 w-11 shrink-0 rounded-xl ${skeletonClass}`} />
                  <div className="min-w-0 flex-1 space-y-2">
                    <span className={`block h-4 w-3/4 ${skeletonClass}`} />
                    <span className={`block h-3 w-1/2 ${skeletonClass}`} />
                  </div>
                  <span className={`h-6 w-12 ${skeletonClass}`} />
                </div>
                <span className={`mt-4 block h-1.5 w-full rounded-full ${skeletonClass}`} />
                <span className={`mt-2 block h-3 w-2/3 ${skeletonClass}`} />
              </div>
            ))}
            <span className="sr-only">Loading categories…</span>
          </div>
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
          <>
          <ul className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleCategories.map((category) => {
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
                          <h3 className="flex items-center gap-2 truncate text-sm font-semibold">
                            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: category.color || DEFAULT_COLOR }} />
                            <span className="truncate">{category.name}</span>
                          </h3>
                          <p className={`mt-0.5 text-xs ${category.goal > 0 ? "font-semibold text-primary" : "text-amber-600"}`}>
                            {category.goal > 0 ? `Target ${formatAmount(category.goal)}` : "Goal not set"}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${selected ? "bg-rose-600 text-white" : ""}`}
                        style={selected ? undefined : { color: category.color || DEFAULT_COLOR, backgroundColor: `${category.color || DEFAULT_COLOR}20` }}
                      >
                        {selected && (
                          <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
                            <path d="m3.5 8.2 2.8 2.8 6.2-6.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                        {category.percent}%
                      </span>
                    </div>
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-foreground/8">
                      <div className="h-full rounded-full" style={{ width: `${category.percent}%`, backgroundColor: category.color || DEFAULT_COLOR }} />
                    </div>
                    <p className="mt-2 text-xs text-foreground/45">of each incoming payment</p>
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
          {totalCategoryPages > 1 && (
            <nav
              aria-label="Category pages"
              className="flex items-center justify-between border-t border-foreground/10 px-4 py-3 sm:px-5"
            >
              <p className="text-xs text-foreground/50">
                Showing {(currentCategoryPage - 1) * CATEGORIES_PER_PAGE + 1}–{Math.min(currentCategoryPage * CATEGORIES_PER_PAGE, categories.length)} of {categories.length} loaded categories
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCategoryPage((current) => Math.max(1, current - 1))}
                  disabled={currentCategoryPage === 1}
                  className="rounded-lg border border-foreground/15 px-3 py-1.5 text-xs font-medium text-foreground/75 transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <span aria-live="polite" className="min-w-16 text-center text-xs text-foreground/55">
                  Page {currentCategoryPage} of {totalCategoryPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCategoryPage((current) => Math.min(totalCategoryPages, current + 1))}
                  disabled={currentCategoryPage === totalCategoryPages}
                  className="rounded-lg border border-foreground/15 px-3 py-1.5 text-xs font-medium text-foreground/75 transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </nav>
          )}
          </>
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
                <p className="mt-1 text-sm text-foreground/55">Choose a goal first. Each incoming payment adds its share toward that target.</p>
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

              <fieldset>
                <legend className="text-sm font-medium">Choose a color</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {colorOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-label={`${option.name} category color`}
                      aria-pressed={color === option.value}
                      onClick={() => setColor(option.value)}
                      className={`flex h-9 w-9 items-center justify-center rounded-full border transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${color === option.value ? "border-foreground/60" : "border-foreground/10"}`}
                    >
                      <span aria-hidden="true" className="h-5 w-5 rounded-full" style={{ backgroundColor: option.value }} />
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

              <div className="rounded-xl border border-primary/25 bg-primary/[0.05] p-4">
                <label className="block text-sm font-semibold" htmlFor="category-goal">
                  Category goal <span className="text-rose-600">*</span>
                  <input
                    id="category-goal"
                    type="number"
                    min="0.0000001"
                    step="any"
                    required
                    value={goal}
                    onChange={(event) => setGoal(event.target.value)}
                    placeholder="Enter your target amount"
                    className="mt-1.5 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2.5 text-sm font-normal outline-none placeholder:text-foreground/35 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                  />
                  <span className="mt-1.5 block text-xs font-normal leading-5 text-foreground/55">
                    Incoming payment shares build toward this amount. Once reached, this category stops receiving allocations.
                  </span>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium" htmlFor="category-percent">
                  Share of each payment
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
                    Up to {formAvailablePercent}% available · category shares can total up to 100%
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
