import { createContext, useContext, useCallback, useLayoutEffect, useState } from 'react';

const STORAGE_KEY = 'nimbus.primaryColor';

// Each preset defines the primary hue as an HSL triplet (matching the format
// used by the CSS variables in index.css). The accent/ring values are derived
// from the same hue so the whole palette stays consistent.
export const COLOR_PRESETS = [
  { id: 'sky', name: 'Sky', primary: '199 89% 56%' },
  { id: 'blue', name: 'Blue', primary: '217 91% 60%' },
  { id: 'indigo', name: 'Indigo', primary: '243 75% 59%' },
  { id: 'violet', name: 'Violet', primary: '262 83% 58%' },
  { id: 'teal', name: 'Teal', primary: '173 80% 36%' },
  { id: 'emerald', name: 'Emerald', primary: '160 84% 39%' },
  { id: 'amber', name: 'Amber', primary: '38 92% 50%' },
  { id: 'orange', name: 'Orange', primary: '25 95% 53%' },
  { id: 'rose', name: 'Rose', primary: '346 77% 50%' },
];

const DEFAULT_ID = 'sky';

function presetById(id) {
  return COLOR_PRESETS.find((p) => p.id === id) || COLOR_PRESETS.find((p) => p.id === DEFAULT_ID);
}

// Apply a preset by writing the CSS variables that Tailwind reads. Accent is a
// light tint of the hue; ring matches the primary.
function applyPreset(preset) {
  const [h, s] = preset.primary.split(' ');
  const sat = s; // e.g. "89%"
  const root = document.documentElement.style;
  root.setProperty('--primary', preset.primary);
  root.setProperty('--ring', preset.primary);
  root.setProperty('--accent', `${h} ${sat} 94%`);
  root.setProperty('--accent-foreground', `${h} ${sat} 30%`);
}

export function readStoredColorId() {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_ID;
  } catch {
    return DEFAULT_ID;
  }
}

// Apply the persisted color as early as possible (called from main.jsx before
// React renders) to avoid a flash of the default color.
export function applyStoredTheme() {
  applyPreset(presetById(readStoredColorId()));
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [colorId, setColorId] = useState(readStoredColorId);

  useLayoutEffect(() => {
    applyPreset(presetById(colorId));
  }, [colorId]);

  const setColor = useCallback((id) => {
    setColorId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore persistence errors (e.g. private mode) */
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ colorId, setColor, presets: COLOR_PRESETS }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
