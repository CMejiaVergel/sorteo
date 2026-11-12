import '@pato/ui/fuentes';
import '@pato/ui/estilos.css';
import '@pato/ui/formal.css';
import './extra.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Aviso, Sprite } from '@pato/ui';
import { PaginaRuleta } from './paginas/Ruleta.tsx';
import { PaginaSorteos } from './paginas/Sorteos.tsx';
import { PaginaSorteo } from './paginas/Sorteo.tsx';
import { PaginaMisNumeros } from './paginas/MisNumeros.tsx';

/** Al cambiar de pantalla, empezar siempre desde arriba. */
function ArribaAlCambiar() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

const cliente = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 10_000, refetchOnWindowFocus: false } },
});

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <QueryClientProvider client={cliente}>
      <BrowserRouter>
        <Sprite />
        <ArribaAlCambiar />
        <Routes>
          <Route path="/" element={<PaginaRuleta />} />
          <Route path="/sorteos" element={<PaginaSorteos />} />
          <Route path="/sorteo/:id" element={<PaginaSorteo />} />
          <Route path="/mis-numeros" element={<PaginaMisNumeros />} />
          <Route path="*" element={<Navigate to="/sorteos" replace />} />
        </Routes>
        <Aviso />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
