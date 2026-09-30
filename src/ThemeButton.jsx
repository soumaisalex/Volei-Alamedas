import { useState } from 'react';
import { MODES, getMode, applyMode } from './theme.js';

const ICON = { auto: '◐', light: '☀', dark: '☾' };
const SHORT = { auto: 'Auto', light: 'Claro', dark: 'Escuro' };
const LONG = { auto: 'Tema automático', light: 'Tema claro', dark: 'Tema escuro' };

export default function ThemeButton() {
  const [mode, setMode] = useState(getMode);
  const next = () => {
    const m = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
    applyMode(m);
    setMode(m);
  };
  return (
    <button className="btn ghost small" onClick={next} aria-label={`${LONG[mode]}. Toque para trocar.`}>
      {ICON[mode]} {SHORT[mode]}
    </button>
  );
}
