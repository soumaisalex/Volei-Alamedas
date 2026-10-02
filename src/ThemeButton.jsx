import { useState } from 'react';
import { MODES, getMode, applyMode } from './theme.js';
import { Icon } from './icons.jsx';

const ICON = { auto: 'auto', light: 'sun', dark: 'moon' };
const LONG = { auto: 'Tema automático', light: 'Tema claro', dark: 'Tema escuro' };

// Só o ícone do modo atual (auto, claro ou escuro); cada toque troca para o próximo.
export default function ThemeButton() {
  const [mode, setMode] = useState(getMode);
  const next = () => {
    const m = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
    applyMode(m);
    setMode(m);
  };
  return (
    <button className="btn ghost small icon" onClick={next} aria-label={`${LONG[mode]}. Toque para trocar.`} title={LONG[mode]}>
      <Icon name={ICON[mode]} />
    </button>
  );
}
