import { useEffect } from 'react';
import { tintaSobre, type Tema } from '@pato/shared';

/** Cambia el color de la barra del navegador y el fondo del body según la pantalla. */
export function useTemaNavegador(color: string, vista: '' | 'fortuna' | 'menu' = '') {
  useEffect(() => {
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', color);
    document.body.dataset.vista = vista;
  }, [color, vista]);
}

/**
 * Pinta la aplicación con los colores del sorteo (botones, bordes, etiquetas, fondo).
 * Las variables se leen en formal.css bajo html.tema-sorteo, en tema claro y oscuro.
 */
export function useTemaSorteo(t: Tema | null) {
  useEffect(() => {
    if (!t) return;
    const raiz = document.documentElement;
    const vars: Record<string, string> = {
      '--t-c1': t.c1,
      '--t-c2': t.c2,
      '--t-neon': t.neon,
      '--t-tinta1': tintaSobre(t.c1),
      '--t-tinta2': tintaSobre(t.c2),
    };
    Object.entries(vars).forEach(([k, v]) => raiz.style.setProperty(k, v));
    raiz.classList.add('tema-sorteo');
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', t.c2);
    return () => {
      raiz.classList.remove('tema-sorteo');
      Object.keys(vars).forEach((k) => raiz.style.removeProperty(k));
    };
  }, [t?.c1, t?.c2, t?.neon]); // eslint-disable-line react-hooks/exhaustive-deps
}
