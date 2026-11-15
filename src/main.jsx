import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { applyTheme, getTheme } from './theme.js';

applyTheme(getTheme());
createRoot(document.getElementById('root')).render(<App />);
