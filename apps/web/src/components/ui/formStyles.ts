/**
 * Shared form-control visual recipe (single source of truth).
 *
 * AppInput / AppPasswordInput consume this; no styling logic is duplicated.
 * Every value resolves through semantic tokens so both themes and the
 * animated theme switch work automatically.
 */

export const controlBaseClass = 'w-full rounded-md border outline-none transition-all' as const;

export const controlSizeClasses = {
	sm: 'px-2.5 py-1.5 text-[13px]',
	md: 'px-3 py-2 text-[14px]',
} as const;

export type ControlSize = keyof typeof controlSizeClasses;

export const controlStyle = {
	background: 'var(--surface-input)',
	borderColor: 'var(--border-default)',
	color: 'var(--text-primary)',
	boxShadow: 'var(--specular-rim-subtle)',
} as const;

export const controlHoverStyle = {
	borderColor: 'var(--border-strong)',
} as const;

export const focusStyle = {
	borderColor: 'var(--border-focus)',
	boxShadow: 'var(--focus-ring-glow)',
	background: 'var(--surface-primary)',
} as const;

export const focusGoldStyle = {
	borderColor: 'var(--gold)',
	boxShadow: '0 0 0 3px var(--gold-muted), var(--shadow-gold)',
	background: 'var(--surface-primary)',
} as const;

export const disabledStyle = {
	opacity: 0.5,
	cursor: 'not-allowed',
} as const;

export const errorStyle = {
	borderColor: 'var(--danger)',
	boxShadow: '0 0 0 3px var(--danger-muted)',
} as const;

/** Placeholder + caret treatment shared by all text controls. */
export const controlPlaceholderStyle = {
	caretColor: 'var(--accent-primary)',
} as const;
