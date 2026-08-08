import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import { queryClient } from './lib/queryClient';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('root element not found');

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <App />
      </HashRouter>
    </QueryClientProvider>
  </StrictMode>,
);
