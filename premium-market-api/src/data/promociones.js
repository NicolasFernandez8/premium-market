// ── REGLAS DE PRECIO DE LAS PROMOCIONES ──────────────────────────────
// Mismo id que las promos que muestra el front (control/src/app/core/data/promociones.ts).
// Acá solo está lo que hace falta para cobrar; los textos y colores viven en el front.
//
// regla:
//   'reintegro'  → la reintegra el banco: no cambia el total del pedido
//   'porcentaje' → descuento sobre el precio de lista (no se suma a la oferta: gana el mejor)
//   '2x1'        → de cada 2 unidades iguales se cobra 1 (hasta maxUnidades)
//   'segunda'    → la 2da unidad igual lleva "porcentaje" de descuento
//
// Alcance: productos (nombres exactos), categoria o coincide (texto en el nombre).
const PROMOCIONES = [
  {
    id: 'mp-miercoles',
    regla: 'reintegro',
    dias: [3],
  },
  {
    id: 'bna-jueves',
    regla: 'reintegro',
    dias: [4, 5],
  },
  {
    id: 'gaseosas-2x1',
    regla: '2x1',
    maxUnidades: 6,
    dias: [0, 1, 2, 3, 4, 5, 6],
    productos: ['Coca-Cola Original 2.25L', 'Sprite Lima Limón 2.25L', 'Fanta Naranja 1.5L'],
  },
  {
    id: 'lacteos-lunes',
    regla: 'porcentaje',
    porcentaje: 20,
    dias: [1],
    coincide: 'La Serenísima',
  },
  {
    id: 'carnes-sabado',
    regla: 'porcentaje',
    porcentaje: 15,
    dias: [6],
    categoria: 'Carnes',
  },
  {
    id: 'limpieza-martes',
    regla: 'segunda',
    porcentaje: 70,
    dias: [2],
    categoria: 'Limpieza',
  },
];

// ¿La promo alcanza a este producto?
function aplicaA(promo, producto) {
  if (promo.productos?.includes(producto.nombre)) return true;
  if (promo.categoria && producto.categoria === promo.categoria) return true;
  if (promo.coincide && producto.nombre.includes(promo.coincide)) return true;
  return false;
}

module.exports = { PROMOCIONES, aplicaA };
