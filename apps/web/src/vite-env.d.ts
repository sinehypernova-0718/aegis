/// <reference types="vite/client" />

// NOTE: A blanket `declare module '*.vue'` shim would shadow the real SFC
// types that vue-tsc generates (breaking barrel re-exports with TS2305).
// vue-tsc resolves .vue files natively via @vue/language-core, so no shim is
// needed here. Vite handles .vue imports at runtime through @vitejs/plugin-vue.
