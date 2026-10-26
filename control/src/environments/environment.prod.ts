// ── CONFIGURACIÓN DE PRODUCCIÓN ───────────────
// En Vercel la API se publica en el mismo dominio que la web, bajo /api
// (ver api/index.js y vercel.json en la raíz del repositorio).
// Reemplaza a environment.ts en el build de producción (angular.json).
export const environment = {
  apiUrl: '/api',
};
