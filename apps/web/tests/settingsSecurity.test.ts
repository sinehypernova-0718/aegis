/**
 * Phase 4 PR 5 — Settings, Security, and Responsive Polish
 *
 * Tests verify:
 *  - Settings view has meaningful preference controls and honest disclaimers.
 *  - Security view has per-indicator explanations and no aggregate score.
 *  - AppSidebar has responsive collapse infrastructure.
 *  - SplitLayout has responsive stacking behaviour.
 *  - Grid is responsive.
 *  - No fake security promises are made in the UI.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');

console.log('--- Starting Phase 4 PR 5: Settings, Security & Responsive Polish Tests ---');

// ─── Settings View ─────────────────────────────────────────────────────────

const settingsPath = resolve(__dirname, '../src/features/settings/SettingsView.vue');
const settingsContent = readFileSync(settingsPath, 'utf8');

// Test 1: Settings uses ThemeToggle component (not bespoke ad-hoc toggle)
console.log('Test 1: Settings uses ThemeToggle component');
assert.ok(
	settingsContent.includes('ThemeToggle'),
	'SettingsView must import and use the ThemeToggle component',
);

// Test 2: Auto-lock preference scope is stated honestly (device-stored,
// backend idle-lock authority independent)
console.log('Test 2: Auto-lock preference states device persistence and backend authority');
assert.ok(
	settingsContent.includes('localStorage') && settingsContent.includes('AEGIS_IDLE_TIMEOUT_MS'),
	'SettingsView must disclose device persistence (localStorage) and the backend idle-lock window',
);
assert.ok(
	!settingsContent.includes('Mock adapter') && !settingsContent.includes('PROTOTYPE'),
	'SettingsView must not claim a mock backend or a prototype mode',
);
assert.ok(
	settingsContent.includes('AUTO_LOCK_OPTIONS') || settingsContent.includes('autoLockTimeout'),
	'SettingsView must expose an auto-lock timeout preference control',
);

// Test 3: Settings has save and reset actions
console.log('Test 3: Settings has save and reset actions');
assert.ok(
	settingsContent.includes('savePreferences') || settingsContent.includes('Save'),
	'SettingsView must include a Save action',
);
assert.ok(
	settingsContent.includes('resetPreferences') || settingsContent.includes('Reset'),
	'SettingsView must include a Reset action',
);

// Test 4: Settings confirmation feedback states where preferences are saved
console.log('Test 4: Save confirmation states the persistence location');
assert.ok(
	settingsContent.includes('saved on this device') || settingsContent.includes('localStorage'),
	'SettingsView save feedback must clarify it is saved on this device',
);

// Test 5: Settings does not expose raw secrets or credential values
console.log('Test 5: Settings view does not render raw secrets');
// Must not directly bind credential secret values; descriptive text about
// "master passphrase" in guidance copy is acceptable and expected.
assert.ok(
	!settingsContent.includes('selectedCredential.secret') &&
		!settingsContent.includes('store.secret'),
	'SettingsView must not render raw credential secret values',
);

// ─── Security View ─────────────────────────────────────────────────────────

const securityPath = resolve(__dirname, '../src/features/security/SecurityView.vue');
const securityContent = readFileSync(securityPath, 'utf8');

// Test 6: Security view uses per-indicator explanations, not a numeric score
console.log('Test 6: Security view uses per-indicator model (no aggregate score)');
assert.ok(securityContent.includes('indicators'), 'SecurityView must define a per-indicator array');
// Ensure no numeric score variable is present
assert.ok(
	!securityContent.includes('securityScore') && !securityContent.includes('security_score'),
	'SecurityView must NOT compute a numeric aggregate security score',
);

// Test 7: Security view scopes indicator honesty (no fake guarantees, no stale
// mock-adapter claims)
console.log('Test 7: Security view makes no false backend claims');
assert.ok(
	!securityContent.includes('mock adapter') && !securityContent.includes('Mock adapter'),
	'SecurityView must not claim a mock adapter backend',
);
assert.ok(
	securityContent.includes('Argon2id'),
	'SecurityView must describe the real backend cryptography',
);

// Test 8: Lock button is present and calls store.lock()
console.log('Test 8: Security view has Lock Now button wired to store.lock()');
assert.ok(
	securityContent.includes('store.lock()'),
	'SecurityView must include a Lock Now button that calls store.lock()',
);

// Test 9: Security view has recovery guidance
console.log('Test 9: Security view has recovery guidance');
assert.ok(
	securityContent.includes('Recovery') || securityContent.includes('recovery'),
	'SecurityView must include recovery key guidance',
);

// Test 10: Auto-lock display distinguishes the device preference from the
// backend's enforced idle-lock window
console.log('Test 10: Auto-lock display states backend enforcement separately');
assert.ok(
	securityContent.includes('AEGIS_IDLE_TIMEOUT_MS') || securityContent.includes('backend enforces'),
	'SecurityView must call out the backend-enforced idle auto-lock window',
);
assert.ok(
	!securityContent.includes('SIM'),
	'SecurityView must not label auto-lock as a simulated ("SIM") value',
);

// ─── AppSidebar ─────────────────────────────────────────────────────────────

const sidebarPath = resolve(__dirname, '../src/components/layout/AppSidebar.vue');
const sidebarContent = readFileSync(sidebarPath, 'utf8');

// Test 11: AppSidebar has mobile collapse toggle
console.log('Test 11: AppSidebar has mobile hamburger toggle');
assert.ok(
	sidebarContent.includes('Menu') || sidebarContent.includes('menu'),
	'AppSidebar must import a Menu icon for the mobile hamburger toggle',
);
assert.ok(
	sidebarContent.includes('mobileOpen') || sidebarContent.includes('mobile-open'),
	'AppSidebar must maintain a mobileOpen state for the drawer',
);

// Test 12: AppSidebar has Escape key close support
console.log('Test 12: AppSidebar closes drawer on Escape key');
assert.ok(
	sidebarContent.includes("'Escape'") || sidebarContent.includes('"Escape"'),
	'AppSidebar must close the mobile drawer when Escape is pressed',
);

// Test 13: AppSidebar has a backdrop for mobile overlay
console.log('Test 13: AppSidebar mobile overlay has a backdrop');
assert.ok(
	sidebarContent.includes('backdrop') || sidebarContent.includes('sidebar-backdrop'),
	'AppSidebar must render a semi-transparent backdrop behind the mobile drawer',
);

// Test 14: AppSidebar uses lg: breakpoint for desktop visibility
console.log('Test 14: AppSidebar uses lg breakpoint for desktop display');
assert.ok(
	sidebarContent.includes('lg:hidden') || sidebarContent.includes('lg:flex'),
	'AppSidebar must use lg breakpoint classes to switch between desktop and mobile layouts',
);

// ─── AppSidebar (SidebarContent checks) ─────────────────────────────────────

const sidebarContentPath = resolve(__dirname, '../src/components/layout/AppSidebar.vue');
const sidebarContentContent = readFileSync(sidebarContentPath, 'utf8');

// Test 15: AppSidebar has brand mark, nav groups and lock button
console.log('Test 15: AppSidebar has brand, navigation, and lock button');
assert.ok(sidebarContentContent.includes('Aegis'), 'AppSidebar must render the Aegis brand mark');
assert.ok(sidebarContentContent.includes('Lock'), 'AppSidebar must render the Lock Vault button');
assert.ok(
	sidebarContentContent.includes('aria-current'),
	'AppSidebar must set aria-current="page" on the active nav item',
);

// ─── SplitLayout ─────────────────────────────────────────────────────────────

const splitLayoutPath = resolve(__dirname, '../src/components/layout/SplitLayout.vue');
const splitLayoutContent = readFileSync(splitLayoutPath, 'utf8');

// Test 16: SplitLayout hides sidebar when credential is selected on mobile
console.log('Test 16: SplitLayout stacks sidebar and detail on mobile');
assert.ok(
	splitLayoutContent.includes('hasSelection'),
	'SplitLayout must use hasSelection to control panel visibility on mobile',
);
assert.ok(
	splitLayoutContent.includes('hidden lg:flex') || splitLayoutContent.includes('hidden lg:'),
	'SplitLayout must hide the sidebar on mobile when a credential is selected',
);

// Test 17: SplitLayout has a mobile back button
console.log('Test 17: SplitLayout has a mobile back-to-list affordance');
assert.ok(
	splitLayoutContent.includes('ArrowLeft') || splitLayoutContent.includes('Back'),
	'SplitLayout must render a back-to-list affordance on mobile',
);

// ─── Grid ─────────────────────────────────────────────────────────────────

const gridPath = resolve(__dirname, '../src/components/layout/Grid.vue');
const gridContent = readFileSync(gridPath, 'utf8');

// Test 18: Grid uses responsive column breakpoints
console.log('Test 18: Grid uses responsive Tailwind column breakpoints');
assert.ok(
	gridContent.includes('sm:grid-cols-2'),
	'Grid must use sm:grid-cols-2 for responsive 2-column layouts',
);
assert.ok(
	gridContent.includes('lg:grid-cols-3'),
	'Grid must use lg:grid-cols-3 for responsive 3-column layouts',
);

// ─── PageContainer ─────────────────────────────────────────────────────────

const pageContainerPath = resolve(__dirname, '../src/components/layout/PageContainer.vue');
const pageContainerContent = readFileSync(pageContainerPath, 'utf8');

// Test 19: PageContainer has responsive padding
console.log('Test 19: PageContainer has responsive horizontal padding');
assert.ok(
	pageContainerContent.includes('sm:px-6') || pageContainerContent.includes('px-4'),
	'PageContainer must use responsive padding that scales with viewport width',
);

// ─── App.vue ─────────────────────────────────────────────────────────────

const appPath = resolve(__dirname, '../src/app/App.vue');
const appContent = readFileSync(appPath, 'utf8');

// Test 20: App.vue provides space for mobile hamburger
console.log('Test 20: App.vue provides top spacing for mobile hamburger button');
assert.ok(
	appContent.includes('pt-12') || appContent.includes('lg:pt-0'),
	'App.vue main element must reserve top space for the mobile hamburger toggle on small screens',
);

console.log('\nAll Phase 4 PR 5 Settings, Security & Responsive Polish tests passed cleanly!\n');
