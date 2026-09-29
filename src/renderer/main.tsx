import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const root = createRoot(document.getElementById('root')!);
if (import.meta.env.DEV && new URLSearchParams(location.search).get('view') === 'rig-preview') {
  void import('./rig/rig-preview').then(({ RigPreview }) => root.render(<React.StrictMode><RigPreview /></React.StrictMode>));
} else root.render(<React.StrictMode><App /></React.StrictMode>);
