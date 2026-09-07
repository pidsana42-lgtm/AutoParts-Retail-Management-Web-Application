import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { AuthProvider } from './contexts/AuthContexts';
import { NotificationProvider } from './contexts/NotificationContext';
import { ToastProvider } from "./components/elements/toast";
import { AlertDialogProvider } from "./components/elements/alert_dialog";

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider position="top-center" maxToasts={5}>
          <AlertDialogProvider>
            <NotificationProvider>
              <App />
            </NotificationProvider>
          </AlertDialogProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
