export const colors = {
  // Base Gym Dark Foundation
  background: '#0F172A', // slate-900: Sfondo globale ad alto contrasto
  backgroundElevated: '#1E293B', // slate-800: Card, contenitori e header
  backgroundSubtle: '#334155', // slate-700: Bordi, divisori e input background

  // Brand Primaries & Accents
  primary: '#1E293B', // Colore primario strutturale
  accent: '#0EA5E9', // sky-500: Accento visivo primario (alta visibilità in palestra)
  accentHover: '#0284C7', // sky-600
  accentMuted: 'rgba(14, 165, 233, 0.15)', // pillole e sfondi badge accento

  // Emerald Brand (Progress & Health)
  emerald: '#10B981',
  emeraldDark: '#059669',
  emeraldMuted: 'rgba(16, 185, 129, 0.15)',

  // High Contrast Text Hierarchy
  text: '#F8FAFC', // slate-50: Testo titoli e valori principali
  textSecondary: '#94A3B8', // slate-400: Sottotitoli, etichette e note
  textMuted: '#64748B', // slate-500: Placeholder e testo disabilitato

  // Functional & Semantic Colors
  border: '#334155', // slate-700
  borderLight: '#475569', // slate-600
  success: '#10B981', // emerald-500
  warning: '#F59E0B', // amber-500
  danger: '#EF4444', // rose-500
  info: '#38BDF8', // sky-400
  volume: '#A855F7', // purple-500: Sezione volume & tonnellaggio

  // Overlay & Shadows
  overlay: 'rgba(15, 23, 42, 0.75)',
  surface: '#1E293B',
  white: '#FFFFFF',
} as const;

export type Colors = typeof colors;
