import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import { AvisoProvider } from './componentes/Aviso';
import './estilos/prototipo.css';
import './estilos/app.css';

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AvisoProvider>
          <App />
        </AvisoProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
