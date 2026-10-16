import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './team-workspace.css';
import './clear-finder.css';
import './planner-clinic.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
