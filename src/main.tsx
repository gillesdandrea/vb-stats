import React from 'react';
import ReactDOM from 'react-dom/client';

import pkg from '../package.json';

import App from './App';

import 'antd/dist/reset.css';
import './index.css';

console.log(`Loaded ${pkg.name}@${pkg.version}`);

const rootElement = document.getElementById('root')!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
