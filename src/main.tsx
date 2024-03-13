import React from 'react';
import ReactDOM from 'react-dom/client';

import 'antd/dist/reset.css';
import App from './components/App/App';

import './index.css';

import pkg from '../package.json';

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
