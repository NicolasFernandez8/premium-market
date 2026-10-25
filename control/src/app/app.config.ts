// ── IMPORTS ──────────────────────────────────
import { ApplicationConfig, LOCALE_ID } from '@angular/core';     // Configuración principal
import { registerLocaleData } from '@angular/common';               // Formatos regionales
import localeEsAr from '@angular/common/locales/es-AR';             // Español de Argentina
import { provideRouter, withInMemoryScrolling } from '@angular/router'; // Proveedor del router
import { provideHttpClient, withInterceptors } from '@angular/common/http'; // HttpClient para la API REST
import { authInterceptor } from './core/interceptors/auth.interceptor';      // Headers de auditoría
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async'; // Animaciones de Angular Material

import { routes } from './app.routes'; // Nuestras rutas definidas en app.routes.ts

// Fechas y precios con formato argentino: "sábado 24 oct", "$ 1.823"
registerLocaleData(localeEsAr);

// ── CONFIGURACIÓN PRINCIPAL ───────────────────
// Registra todos los servicios globales de Premium Market
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' })), // Rutas; cada pantalla arranca arriba (o en el #ancla)
    provideHttpClient(withInterceptors([authInterceptor])), // Habilita HttpClient para la API REST
    provideAnimationsAsync(),     // Habilita animaciones de Angular Material
    { provide: LOCALE_ID, useValue: 'es-AR' }, // Pipes de fecha y moneda en español
  ]
};
