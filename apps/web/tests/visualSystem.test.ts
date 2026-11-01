import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');

console.log('--- Starting Aegis Phase 4 PR 1: Visual Identity & Interactive Surfaces Tests ---');

// 1. Verify CSS Tokens
const tokensPath = resolve(__dirname, '../src/styles/tokens.css');
const tokensCss = readFileSync(tokensPath, 'utf8');

// Test 1: Dark theme golden tokens & specular rim
console.log('Test 1: Dark theme golden tokens & specular rim presence');
assert.ok(
	tokensCss.includes('--gradient-gold:'),
	'tokens.css must define --gradient-gold in dark theme',
);
assert.ok(tokensCss.includes('--gold-border-focus:'), 'tokens.css must define --gold-border-focus');
assert.ok(tokensCss.includes('--gold-surface:'), 'tokens.css must define --gold-surface');
assert.ok(
	tokensCss.includes('--shadow-gold-elevated:'),
	'tokens.css must define --shadow-gold-elevated',
);
assert.ok(tokensCss.includes('--specular-rim:'), 'tokens.css must define --specular-rim');
assert.ok(tokensCss.includes('--text-on-gold:'), 'tokens.css must define --text-on-gold');

// Test 2: Light theme golden tokens & specular rim
console.log('Test 2: Light theme golden tokens & specular rim presence');
const lightThemeIndex = tokensCss.indexOf('[data-theme="light"]');
assert.ok(lightThemeIndex !== -1, 'tokens.css must define [data-theme="light"]');
const lightSection = tokensCss.slice(lightThemeIndex);
assert.ok(lightSection.includes('--gradient-gold:'), 'light theme must define --gradient-gold');
assert.ok(lightSection.includes('--gold-surface:'), 'light theme must define --gold-surface');
assert.ok(
	lightSection.includes('--shadow-gold-elevated:'),
	'light theme must define --shadow-gold-elevated',
);
assert.ok(lightSection.includes('--specular-rim:'), 'light theme must define --specular-rim');
assert.ok(lightSection.includes('--text-on-gold:'), 'light theme must define --text-on-gold');

// Test 3: Glass recipes in global.css
console.log('Test 3: Glass recipes and interactive elevation in global.css');
const globalPath = resolve(__dirname, '../src/styles/global.css');
const globalCss = readFileSync(globalPath, 'utf8');
assert.ok(globalCss.includes('.a-glass {'), 'global.css must define base .a-glass');
assert.ok(globalCss.includes('.a-glass--elevated'), 'global.css must define .a-glass--elevated');
assert.ok(globalCss.includes('.a-glass--gold'), 'global.css must define .a-glass--gold');
assert.ok(
	globalCss.includes('.a-glass--interactive'),
	'global.css must define .a-glass--interactive',
);
assert.ok(globalCss.includes('var(--specular-rim)'), 'global.css must utilize var(--specular-rim)');

// Test 4: AppButton exports and gold variant support
console.log('Test 4: AppButton variant definitions and focus states');
const appButtonPath = resolve(__dirname, '../src/components/ui/AppButton.vue');
const appButtonContent = readFileSync(appButtonPath, 'utf8');
assert.ok(appButtonContent.includes("'gold'"), 'AppButton must support gold variant');
assert.ok(
	appButtonContent.includes('var(--gradient-gold)'),
	'AppButton must use --gradient-gold for gold variant',
);
assert.ok(
	appButtonContent.includes('var(--specular-rim-gold)'),
	'AppButton must use --specular-rim-gold',
);
assert.ok(
	appButtonContent.includes('var(--shadow-gold-elevated)'),
	'AppButton must use --shadow-gold-elevated',
);
assert.ok(
	appButtonContent.includes('focus-visible:ring-'),
	'AppButton must configure focus-visible ring',
);

// Test 5: Card glassmorphism & elevation support
console.log('Test 5: Card glassmorphism & elevation support');
const cardPath = resolve(__dirname, '../src/components/ui/Card.vue');
const cardContent = readFileSync(cardPath, 'utf8');
assert.ok(cardContent.includes('a-glass--standard'), 'Card must support standard glass tier');
assert.ok(cardContent.includes('a-glass--elevated'), 'Card must support elevated glass tier');
assert.ok(cardContent.includes('a-glass--gold'), 'Card must support gold glass tier');
assert.ok(
	cardContent.includes('a-glass--interactive'),
	'Card must support interactive hover elevation',
);

// Test 6: AppBadge gold tone support
console.log('Test 6: AppBadge gold tone support');
const badgePath = resolve(__dirname, '../src/components/ui/AppBadge.vue');
const badgeContent = readFileSync(badgePath, 'utf8');
assert.ok(
	badgeContent.includes('var(--gradient-gold)'),
	'AppBadge solid gold must use --gradient-gold',
);
assert.ok(
	badgeContent.includes('var(--text-on-gold)'),
	'AppBadge solid gold must use --text-on-gold',
);

// Test 7: Authenticated UI uses elevated surfaces & gold highlights
console.log('Test 7: Authenticated views utilize refined visual system');
const sidebarPath = resolve(__dirname, '../src/components/layout/AppSidebar.vue');
const sidebarContent = readFileSync(sidebarPath, 'utf8');
assert.ok(
	sidebarContent.includes('var(--gold-surface)'),
	'AppSidebar brand must use var(--gold-surface)',
);
assert.ok(sidebarContent.includes('var(--gold)'), 'AppSidebar brand must use var(--gold)');
assert.ok(sidebarContent.includes('AppButton'), 'AppSidebar must use AppButton for lock action');

const overviewPath = resolve(__dirname, '../src/features/overview/OverviewView.vue');
const overviewContent = readFileSync(overviewPath, 'utf8');
assert.ok(
	overviewContent.includes('a-glass--interactive'),
	'Overview stat cards must use a-glass--interactive',
);
assert.ok(overviewContent.includes('AppButton'), 'Overview must use AppButton for primary action');
assert.ok(
	overviewContent.includes('variant="gold"'),
	'Overview action button must use gold variant',
);

console.log('\nAll PR 1 Visual System & Interactive Surface tests passed cleanly!\n');
