import '@pato/ui/fuentes';
import '@pato/ui/estilos.css';
import '@pato/ui/formal.css';
import './extra.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Aviso, Sprite } from '@pato/ui';
import { FalloApi } from './api/cliente.ts';
import { Protegido } from './componentes/Marco.tsx';
import { PaginaLogin } from './paginas/Login.tsx';
import { PaginaSorteos } from './paginas/Sorteos.tsx';
import { PaginaEditor } from './paginas/Editor.tsx';
import { PaginaGestion } from './paginas/Gestion.tsx';
import { PaginaContactos } from './paginas/Contactos.tsx';
import { PaginaRuleta, PaginaProbarRuleta } from './paginas/Ruleta.tsx';
import { PaginaDiseno } from './paginas/Diseno.tsx';
import { PaginaAjustes } from './paginas/Ajustes.tsx';
import { PaginaSeguridad } from './paginas/Seguridad.tsx';

const cliente = new QueryClient({
  defaultOptions: {
    queries: { retry: (n, e) => !(e instanceof FalloApi && e.status < 500) && n < 1, refetchOnWindowFocus: false, staleTime: 0 },
  },
});

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <QueryClientProvider client={cliente}>
      <BrowserRouter>
        <Sprite />
        <Routes>
          <Route path="/login" element={<PaginaLogin />} />
          <Route path="/ruleta/probar" element={<Protegido sinMarco><PaginaProbarRuleta /></Protegido>} />
          <Route element={<Protegido />}>
            <Route path="/sorteos" element={<PaginaSorteos />} />
            <Route path="/sorteos/nuevo" element={<PaginaEditor />} />
            <Route path="/sorteos/:id/editar" element={<PaginaEditor />} />
            <Route path="/sorteos/:id" element={<PaginaGestion />} />
            <Route path="/contactos" element={<PaginaContactos />} />
            <Route path="/ruleta" element={<PaginaRuleta />} />
            <Route path="/diseno" element={<PaginaDiseno />} />
            <Route path="/seguridad" element={<PaginaSeguridad />} />
            <Route path="/ajustes" element={<PaginaAjustes />} />
          </Route>
          <Route path="*" element={<Navigate to="/sorteos" replace />} />
        </Routes>
        <Aviso />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
