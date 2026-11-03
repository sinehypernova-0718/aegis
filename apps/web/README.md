# Aegis Frontend — Cinematic Glassmorphism Design System & Vault Lifecycle

Premium, local-first password & API-key vault frontend. This repository contains:
- **Phase 0:** Repository reconnaissance, technical assessment, and architectural planning.
- **Phase 1:** Cinematic Glassmorphism design system, token architecture (Glacier light / Midnight dark), glass primitives, UI primitives, and motion foundation.
- **Phase 2:** Application shell, navigation structure, and page transitions.
- **Phase 3:** Complete vault lifecycle and authentication experience: first-run setup, recovery-key presentation and confirmation, passphrase unlocking, emergency recovery entry, manual locking with immediate frontend reactive state clearing, status reconciliation, and locked/unlocked transitions.

## Phase 3: Vault Lifecycle & Authentication

Phase 3 delivers the complete vault lifecycle experience:
1. **First-Run Vault Setup (`VaultSetupCard.vue`):**
   - Distinguishes an uninitialized vault (`state: 'uninitialized'`) from a locked vault (`state: 'locked'`) using real vault status from the service boundary.
   - Master passphrase creation and confirmation with real-time requirement validation (minimum 12 characters, confirmation mismatch checking).
   - Form loading, double-submission prevention, and accessible error handling.

2. **Recovery-Key Presentation & Confirmation (`VaultRecoverySetupCard.vue`):**
   - Displayed **only when supplied by the backend** in the `createVault` response (`recoveryKey`).
   - Deliberate privacy experience: masked by default with an explicit reveal/mask toggle.
   - Copy-to-clipboard action with tactile feedback (`confirmPop` motion preset).
   - Prominent security advisory requiring offline storage.
   - Explicit confirmation requirement ("I have written down or safely backed up this recovery key offline") before setup completion.
   - Strict memory hygiene: the key is never stored in `localStorage`, `sessionStorage`, or URL parameters, and is cleared from in-memory state upon completion or exit.
   - Never fabricates a recovery key if the backend does not return one.

3. **Vault Unlocking (`VaultUnlockCard.vue`):**
   - Replaced prototype with production-quality glassmorphism implementation using `GlassPanel` and `AppPasswordInput`.
   - Master passphrase entry with visibility toggle, double-submission locking, loading state ("Deriving key..."), and accessible error alerts (`role="alert"`, `aria-live="polite"`).
   - Immediate in-memory clearing of the passphrase upon successful unlock.
   - Application shell mounts only upon confirmed backend/client unlock success.

4. **Emergency Recovery Entry (`VaultRecoveryCard.vue`):**
   - Dedicated monospace recovery key entry with uppercase formatting and input validation.
   - Explicit integration boundary on `VaultClient` (`recoverVault?(recoveryKey: string): Promise<RecoverVaultResult>`).
   - Graceful error states when keys are malformed or when the active backend does not support recovery.
   - Clean cancellation returning to standard master passphrase entry.

5. **Manual Vault Locking (`store.lock()`):**
   - Immediate frontend state hygiene: all reactive in-memory credentials, passwords, API keys, selected items, activity, and presented recovery keys are cleared from frontend state before network or animation delays (without claiming cryptographic memory zeroization).
   - Backend session confirmation: authoritative status transition to `locked` is only set once the backend confirms session termination, with graceful error handling and retry mechanisms (`retryLock()`) if backend teardown fails.

6. **Status Reconciliation & Resilient Authentication (`store.reconcileStatus()`):**
   - Decouples raw authentication (unlock/recovery) from backend status confirmation.
   - If authentication succeeds on the backend but the follow-up status query fails, the store records a distinct reconciliation warning banner with a dedicated retry action (`reconcileStatus()`), preventing UI/backend state disagreement without falsely reporting credential rejection.
   - Recovery keys presented during setup are strictly preserved until backend unlocked status is authoritatively confirmed.

7. **Development Mock Testing Adapter (`mockVaultClient.ts`):**
   - Clearly identified development mock integration boundary.
   - Starts in `uninitialized` state to immediately demonstrate first-run setup.
   - Discreet mock switcher pill in the footer is strictly development-gated (`import.meta.env.DEV`), ensuring mock controls and testing tools are excluded from production builds and never exposed in the production UI.

## Visual Identity — Cinematic Glassmorphism

Aegis feels like an atmospheric, purpose-built security instrument: layered translucent glass over a soft aurora backdrop, restrained golden lighting, and deep blue-tinted ink. Blur, gradient, glow, and shadow are applied through a centralized recipe system (`a-glass--*`, tokens in `src/styles/tokens.css`) — never ad hoc per component.

### Themes

Applied via `<html data-theme="light|dark">`; all colors resolve through semantic tokens so components never hardcode palette values.
- **Light — "Porcelain":** porcelain/mist backgrounds (`#f1f5fb` base), white and `#f8fafd` surfaces, navy ink (`--a-blue-ink-900 #243d62`), and **antique gold as the signature accent** (`--a-gold-600 #b99142`). Blue is reserved for informational states (`--info #2c4d85`).
- **Dark — "Obsidian":** obsidian/graphite backgrounds (`#090b0d` base), graphite surface tiers, champagne gold as the signature accent (`--a-gold-500 #c6a45c`), gold focus rings and highlights, high-contrast warm-neutral text.

### Theme Switching

`src/composables/useTheme.ts` is the single source of truth:
- Pre-paint bootstrap inline script in `index.html` sets `data-theme` before first frame (no wrong-theme flash); persists to localStorage; follows system preference.
- `toggleTheme({ animate: true })` uses the **View Transitions API** (crossfade, no layout shift) when available, with a `.theme-animating` CSS-interpolation fallback elsewhere. Reduced-motion collapses both paths instantly.
- `ThemeToggle.vue` provides the reusable animated switch (spring knob, icon crossfade).

## Typography

Locally bundled variable fonts (WOFF2 in `src/assets/fonts/`, `@font-face` in `src/styles/fonts.css`) — zero runtime dependency on external font services:

| Register              | Class                         | Font           |
| --------------------- | ----------------------------- | -------------- |
| Display / page titles | `.a-display`, `.a-title`      | Sora           |
| Section headings      | `.a-heading`, `.a-subheading` | Sora           |
| Body / supporting     | `.a-body`, `.a-supporting`    | Inter          |
| Labels / metadata     | `.a-label`, `.a-meta`         | Inter          |
| Technical identifiers | `.a-mono`                     | JetBrains Mono |

## Glass Surfaces

One shared recipe (`.a-glass` + depth modifier) guarantees consistent background opacity, backdrop blur, border, inner highlight, shadow, and radius:

`a-glass--subtle` · `a-glass--standard` · `a-glass--elevated` · `a-glass--modal` · `a-glass--focused` · `a-glass--gold` (premium hairline variant).

The ambient backdrop is `.a-aurora` (three slow-drifting blobs; static under reduced motion). Blur tiers are capped (`--blur-xs 6px … --blur-xl 40px`) to keep rendering performant and text readable.

## Component Foundation (`src/components/ui/`, barrel: `@/components/ui`)

Unopinionated visual primitives:
- `AppButton` (variants: primary/secondary/danger/ghost/glass/gold; sizes sm/md/lg; loading/disabled; configurable `type="button" | "submit"`) and `AppIconButton`
- `AppInput`, `AppPasswordInput` (masked text control with reveal toggle, autofocus, autocomplete, and focus forwarding), `FieldGroup`
- `AppBadge` (tones incl. gold/success/warning/danger; `solid` fill option), `AppDivider`, `AppSpinner`, `EmptyState`, `KeyValue`
- `GlassPanel`, `Card` — glass-depth containers
- `ModalShell`, `DropdownShell`, `AppTabs`, `AppTooltip`, `AppDialog`, `AppToasts`
- `ThemeToggle`

## Motion System (`src/motion/`)

Centralized on `motion-v` with tokens in `tokens.ts`:
- `durations`: micro 0.15s · control 0.22s · component 0.3s · panel 0.38s · page 0.5s · cinematic 0.8s
- `easings`: out `[0.16, 1, 0.3, 1]` · inOut · in
- `springs`: snappy · smooth · dialog
- `presets.ts` interaction bundles: `buttonInteraction`, `cardInteraction`, `navItemInteraction`, `confirmPop`, `atmosphereEnter`, `emblemPulse`, `themeSurfaceTransition`, `verifySweep`.
- `useAppReducedMotion()` ensures full accessibility under `prefers-reduced-motion`.

## Design-System Preview

Open **`/#/design-system`** (dev or built site). Mounts `src/design-system/DesignSystemPreview.vue` to inspect themes, typography, glass depths, UI primitives, and motion examples.

## Development & Verification

```bash
pnpm install
pnpm run dev        # http://localhost:3000 (showcase: /#/design-system)
pnpm run build      # production build (Vite)
pnpm run typecheck  # vue-tsc strict validation
pnpm run test       # automated lifecycle test suite (15 tests)
```

## Status & Boundaries

- **Phase 0:** Complete.
- **Phase 1:** Complete (tokens, themes, glass primitives, UI foundation, motion system).
- **Phase 2:** Complete (application shell, navigation, page transitions).
- **Phase 3:** Complete (vault lifecycle, setup, recovery key handling, unlock, recovery, locking).
- **Remaining Limitations:**
  - Credential CRUD and dashboard feature expansions remain for future phases.
  - Backend integration uses the explicitly defined development mock integration boundary (`mockVaultClient.ts`); real backend HTTP endpoints will be connected when the Aegis backend service is deployed.
