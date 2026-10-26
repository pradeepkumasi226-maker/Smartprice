import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Import CSS Design System Modules
import './styles/index.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/charts.css';
import './styles/pages.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
