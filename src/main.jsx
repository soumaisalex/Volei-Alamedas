import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { applyMode, getMode } from './theme.js';

applyMode(getMode());

createRoot(document.getElementById('root')).render(<App />);
