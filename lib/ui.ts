/**
 * ChefOS design tokens — luxury private residence operations UI.
 * Use these class strings for consistent styling across pages.
 */

export const ui = {
  /** App shell & page background */
  pageBg: "bg-ivory min-h-dvh",

  /** Elevated surface card */
  card:
    "rounded-2xl border border-stone-200/60 bg-surface shadow-card transition-shadow",

  /** Card with more presence (lists, dashboard) */
  cardElevated:
    "rounded-2xl border border-stone-200/50 bg-surface shadow-card-lg",

  /** Inset list container */
  cardInset:
    "rounded-2xl border border-stone-200/50 bg-surface/80 shadow-card overflow-hidden",

  /** Hero / command header */
  hero:
    "rounded-3xl bg-gradient-to-br from-navy via-navy-light to-navy-soft p-7 text-ivory shadow-hero",

  /** Section title on ivory pages */
  sectionTitle: "font-display text-lg font-semibold tracking-tight text-charcoal",

  /** Page title (PageHeader) */
  pageTitle: "font-display text-2xl font-semibold tracking-tight text-charcoal",

  pageSubtitle: "mt-1 text-sm text-stone-500",

  /** Primary CTA */
  btnPrimary:
    "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-ivory shadow-soft transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",

  /** Header action button */
  btnHeader:
    "inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-ivory shadow-soft",

  /** Secondary / outline */
  btnSecondary:
    "inline-flex min-h-[44px] items-center justify-center rounded-xl border border-stone-200 bg-surface px-4 py-2.5 text-sm font-semibold text-charcoal transition active:bg-stone-50",

  /** Ghost icon button */
  btnIcon:
    "flex h-10 w-10 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-charcoal active:bg-stone-100",

  /** Filter chip — inactive */
  chip:
    "shrink-0 rounded-full border border-stone-200/80 bg-surface px-4 py-2 text-xs font-semibold text-stone-600 transition",

  /** Filter chip — active */
  chipActive:
    "shrink-0 rounded-full bg-navy px-4 py-2 text-xs font-semibold text-ivory shadow-soft",

  /** Text input */
  input:
    "w-full rounded-xl border border-stone-200/80 bg-stone-50/50 px-4 py-3 text-base text-charcoal placeholder:text-stone-400 focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/15",

  /** Form label */
  label:
    "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500",

  /** Empty state container */
  empty:
    "rounded-2xl border border-dashed border-stone-200/80 bg-surface/60 px-8 py-10 text-center",

  emptyTitle: "text-sm font-semibold text-charcoal",
  emptyText: "mt-1.5 text-sm leading-relaxed text-stone-500",

  /** Loading skeleton */
  skeleton: "animate-pulse rounded-2xl bg-stone-200/60",

  /** Link accent */
  link: "text-sm font-semibold text-navy-light hover:text-navy",

  /** Divider inside cards */
  divider: "border-b border-stone-100 last:border-0",
} as const
