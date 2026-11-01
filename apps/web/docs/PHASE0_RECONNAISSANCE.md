# Aegis Frontend — Phase 0: Repository Reconnaissance & Technical Assessment

Date: 2026-10-30 · Branch inspected: `qwen-code-d6ea95fe-af7a-41e1-b3f6-d7692f2a2da1` (identical tree to `aegis-cinematic-motion-system-2f1c8`)

---

## 1. Current repository architecture

The repository is **not empty**. It contains a working Vue 3 SPA (~4,700 lines in `src/`) produced by a previous "Product Identity & Motion Engineering Overhaul" pass (documented in `README.md`).

```
/workspace
├── index.html              # Shell + flicker-free theme bootstrap script
├── package.json            # Vue 3.5 / Vite 6 / TS 5.7 / Tailwind v4 / motion-v / pinia / lucide
├── tsconfig.json           # strict: true, paths @/* → src/*
├── vite.config.ts          # @vitejs/plugin-vue + @tailwindcss/vite, alias @
└── src/
    ├── app/App.vue                 # Root shell; store-driven view switching (no router)
    ├── components/layout/          # AppSidebar, PageContainer, Grid, Section, Toolbar…
    ├── components/ui/              # AppButton, AppDialog, AppToasts, Card, EmptyState, FieldGroup, KeyValue
    ├── components/vault/           # CredentialForm, CredentialList  ← application functionality (out of Phase 0/1 scope)
    ├── composables/useTheme.ts     # module-singleton theme state, localStorage + system preference
    ├── features/                   # overview / passwords / apikeys / security / settings / vault(Unlock) ← out of scope
    ├── motion/                     # tokens, easings, springs, staggers, variants, transitions, presets,
    │                               # MotionReveal/Stagger/Page, ParallaxLayer, ScrollProgressBar,
    │                               # useReducedMotion, usePageMotion, useNavStack
    ├── services/api|mock/          # VaultClient contract + mock adapter ← backend scaffolding (out of scope)
    ├── stores/vaultStore.ts        # Pinia: vault state + currentPage navigation ← out of scope
    ├── styles/tokens.css           # CSS-variable design tokens (light/dark via [data-theme])
    ├── styles/global.css           # Tailwind import, reset, keyframes, utilities, reduced-motion block
    └── types/index.ts              # Domain + ThemeMode + PageId types
```

Verified baseline (executed, not assumed):

| Check     | Command                                          | Result                                                |
| --------- | ------------------------------------------------ | ----------------------------------------------------- |
| Install   | `npm install`                                    | OK (56 packages)                                      |
| Typecheck | `npm run typecheck` (`vue-tsc --noEmit`, strict) | ✅ passes                                             |
| Build     | `npm run build` (`vite build`)                   | ✅ 342.7 kB JS (110.5 kB gz), 27.6 kB CSS (6.3 kB gz) |

## 2. Existing dependencies and infrastructure

| Concern     | Present                                                                | Verdict                                           |
| ----------- | ---------------------------------------------------------------------- | ------------------------------------------------- |
| Framework   | Vue 3.5, `<script setup>`, Composition API                             | Matches expected stack — keep                     |
| Build       | Vite 6 + `@vitejs/plugin-vue`                                          | Keep                                              |
| Language    | TypeScript 5.7, `strict: true`                                         | Keep                                              |
| Styling     | Tailwind CSS v4 via `@tailwindcss/vite`; CSS variables in `tokens.css` | Keep                                              |
| Animation   | `motion-v` 2.9 (Motion for Vue)                                        | Keep — Vue-compatible; no React libraries present |
| Icons       | `lucide-vue-next`                                                      | Keep — consistent icon source                     |
| State       | `pinia` 2.3                                                            | Keep (used by out-of-scope vault store)           |
| Routing     | none — store-driven `currentPage`                                      | Documented convention; respected                  |
| Tests       | none configured                                                        | See risks §8                                      |
| Lint/Format | none configured (no ESLint/Prettier/biome)                             | See risks §8                                      |

No unnecessary dependencies were found; nothing was removed. No new runtime dependency was added in Phase 1 (fonts are bundled as static assets).

## 3. Existing functionality

- Full prototype vault application: unlock screen, overview, password/API-key CRUD views, security page, settings, toast notifications, mock `VaultClient`.
- Complete motion foundation: duration/easing/spring/stagger tokens, directional page transitions with an explicit LIFO nav-stack policy, scroll reveals, stagger groups, parallax, dialog/toast/menu variants, reduced-motion composable with manual override.
- Theme system: light/dark via `[data-theme]` attribute, pre-paint inline bootstrap script (no flash), localStorage persistence, system-preference detection, smooth body transition.

## 4. Missing infrastructure (relative to the Phase 1 brief)

1. **Wrong visual identity** — existing palette is "Quiet luxury: warm neutrals + indigo". The brief mandates **Cinematic Glassmorphism**: pale-blue light theme, midnight-navy dark theme, golden accents, layered translucent glass.
2. **No glass primitives** — zero `backdrop-filter` surface system; only ad-hoc `bg-black/60 backdrop-blur-sm` overlays.
3. **Missing token categories** — glass background/opacity, blur strengths, elevation levels, focus-ring tokens, gradient tokens, golden-highlight tokens.
4. **Incomplete component foundation** — no input primitive (forms inline-style inputs with JS `@focus/@blur` handlers), no badge, tooltip, divider, tabs, dropdown shell, modal shell (only a business-specific confirm dialog), no spinner/loading indicator, no theme toggle control.
5. **Typography scale undefined** — arbitrary `text-[10px]…text-[15px]` scattered across files; no display/title/heading/body/label/meta scale.
6. **External font runtime dependency** — Inter loaded from Google Fonts at runtime; brief requires locally bundled fonts.
7. **No design-system preview** at all.
8. **No theme-transition orchestration** beyond a single CSS transition on `body`.
9. **No docs** for the design system itself (README documented the old identity).

## 5. Recommended component architecture

- `src/components/ui/` remains the home for unopinionated visual primitives; new primitives follow the existing PascalCase + scoped-token-styles convention.
- Business components (`components/vault/`, `features/`) stay untouched in Phase 1; they will be restyled against the new primitives in later phases.
- Design-system showcase lives in `src/design-system/` and is reached through a URL flag (`#/design-system`) rather than adding vue-router solely for a preview page — routing infrastructure should be introduced deliberately when Phase 2 needs it.

## 6. Recommended design-token architecture

Three layers, all centralized:
1. **Palette layer** (`--a-*`): raw per-theme color values (navy ramp, blue ramp, gold ramp, semantic status colors).
2. **Semantic layer** (`--surface-*`, `--text-*`, `--border-*`, `--accent-*`, `--gold-*`, `--glass-*`, `--shadow-*`, `--gradient-*`, `--focus-ring`): what components consume. Names kept compatible with the existing vocabulary (`--surface-base/primary/secondary/tertiary/elevated/overlay`, `--text-primary/secondary/tertiary/disabled`, `--border-subtle/default/strong/focus`, `--accent-*`, `--success/warning/danger*`, `--type-*`) so legacy markup keeps resolving while gaining the new identity.
3. **Dimensional layer** (`--space-*`, `--radius-*`, `--blur-*`, `--elev-*`, typography scale, motion tokens mirrored into CSS vars for parity with `src/motion/tokens.ts`).

Components must reference semantic tokens only — never raw palette values.

## 7. Recommended motion architecture

Reuse the existing `src/motion/` system wholesale (it already satisfies the brief's motion-architecture requirements: durations, easings, delays, staggering, entrance/exit, hover/press presets, layout/dialog/toast variants, reduced-motion composable with override). Additions in Phase 1:
- `themeSurfaceTransition()` preset for the animated theme switch (View-Transition crossfade with graceful fallback).
- Motion-layer additions are additive exports only; no rewrites.
- All new UI primitives consume `presets.ts` bundles instead of hand-rolling transitions.

## 8. Potential technical risks

| Risk                                                                                               | Mitigation                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Restyling shared tokens changes the untouched prototype screens (they read the same CSS variables) | Accepted intentionally: one token source prevents split-brain styling. Legacy names preserved so nothing breaks structurally. Prototype screens remain functional; full redesign is Phase 2+. |
| Heavy `backdrop-filter` hurts Windows GPU performance                                              | Blur tiers capped (8/16/24/40px); glass reserved for panels/modals/toasts/sidebar chrome, never list rows; documented budget.                                                                 |
| View Transitions API support varies (fine on Chromium/Win11)                                       | Feature-detected; falls back to a CSS custom-property interpolation transition.                                                                                                               |
| No lint/format/test toolchain exists                                                               | Not introduced in Phase 1 (a second opinionated toolchain decision belongs to Phase 2); verification = strict `vue-tsc` + production build.                                                   |
| Font licensing                                                                                     | Sora + Inter + JetBrains Mono are OFL; WOFF2s ship with the repo (no runtime external requests).                                                                                              |
| Reduced-motion blanket `transition-duration: 0.01ms !important` also kills the theme crossfade     | Intended behavior: under reduced motion the theme switch becomes an instant swap (no flashing).                                                                                               |

## 9. Backend / contract dependencies

- `src/services/api/contracts.ts` defines a `VaultClient` interface consumed by the Pinia store; the backend (Node.js + PostgreSQL + Drizzle, separate repo) is authoritative for auth/crypto/persistence.
- Phase 1 introduces **zero** network calls and touches no contracts. No endpoints, encryption formats, or auth flows were invented or altered.

## 10. Precise Phase 1 implementation plan

1. Bundle fonts locally (Sora display, Inter body, JetBrains Mono technical); remove Google Fonts runtime links; update pre-paint bootstrap to match new base colors.
2. Rewrite `src/styles/tokens.css` into the three-layer Cinematic Glassmorphism system with complete light + dark themes.
3. Extend `global.css`: typography-scale classes, ambient aurora background, glass keyframes, spinner, theme-transition support, reduced-motion handling.
4. Add glass primitive: `GlassPanel.vue` (subtle/standard/elevated/modal/focused; radii; elevations).
5. Add UI primitives: `AppBadge`, `Divider`, `Spinner`, `Tooltip`, `Tabs`, `DropdownMenu` shell, `ModalShell`, `ThemeToggle`, `formStyles.ts` (shared input CSS), `ui/index.ts` barrel. Upgrade `AppButton` (add `glass`, `gold`, `lg`, `icon` sizing — additive, backward compatible).
6. Motion: add `themeSurfaceTransition()` preset.
7. Theme infra: keep `useTheme` semantics; add View-Transition-aware `toggleThemeAnimated()`.
8. Build the design-system preview (`src/design-system/DesignSystemPreview.vue` + sections) mounted via `#/design-system`; register the id in the `PageId` union so typing stays honest without touching nav-stack logic.
9. Documentation: rewrite README for the new identity + design-system usage guide; this report.
10. Verify: `npm run typecheck`, `npm run build` (report actual output).
