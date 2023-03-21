import React from 'react';
import ReactDOM from 'react-dom/client';

import 'antd/dist/reset.css';
import App from './components/App/App';
import './index.css';

import reportWebVitals from './reportWebVitals';

import pkg from '../package.json';

console.log(`Loaded ${pkg.name}@${pkg.version}`);

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
