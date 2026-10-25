// ── CONFIGURACIÓN DE ENTORNO ──────────────────
// URL base de la API REST (premium-market-api).
// Apunta a la API local con su propia base MongoDB (premium_market):
// esta app no usa la base de producción del proyecto original.
// Usa el mismo host que abrió la página: así el celular que escanea el QR
// (entrando por la IP de la compu) también llega a la API en el puerto 3000.
// Todos los servicios HTTP arman sus endpoints a partir de acá.
export const environment = {
  apiUrl: `${location.protocol}//${location.hostname}:3000/api`,
};
