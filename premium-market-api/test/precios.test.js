const test   = require('node:test');
const assert = require('node:assert/strict');
const { cotizar, diaArgentina } = require('../src/services/precios');

// Fechas fijas a las 15 h de Argentina (18 h UTC) para cada día de la semana
const LUNES   = new Date('2026-10-26T18:00:00Z');
const MARTES  = new Date('2026-10-27T18:00:00Z');
const JUEVES  = new Date('2026-10-29T18:00:00Z');

const producto = (datos) => ({ _id: datos.nombre, categoria: 'Almacén', icono: 'x', stock: 50, oferta: false, descuento: 0, ...datos });

test('día de la semana en hora argentina aunque en UTC ya sea otro día', () => {
  // Lunes 23:30 en Argentina = martes 02:30 UTC
  assert.equal(diaArgentina(new Date('2026-10-27T02:30:00Z')), 1);
  assert.equal(diaArgentina(JUEVES), 4);
});

test('precio de lista sin oferta ni promo', () => {
  const r = cotizar([{ producto: producto({ nombre: 'Arroz', precio: 1000 }), cantidad: 3 }], 'invitado', JUEVES);
  assert.equal(r.subtotalLista, 3000);
  assert.equal(r.total, 3000);
  assert.deepEqual(r.promosAplicadas, []);
});

test('oferta de góndola y descuento de cliente en cascada', () => {
  const p = producto({ nombre: 'Arroz', precio: 1000, oferta: true, descuento: 10 });
  const r = cotizar([{ producto: p, cantidad: 2 }], 'cliente', JUEVES);
  assert.equal(r.ahorroOfertas, 200);   // 2000 → 1800
  assert.equal(r.ahorroCliente, 90);    // 5 % de 1800
  assert.equal(r.total, 1710);
});

test('mayorista tiene más descuento que cliente', () => {
  const linea = [{ producto: producto({ nombre: 'Arroz', precio: 1000 }), cantidad: 10 }];
  assert.equal(cotizar(linea, 'mayorista', JUEVES).total, 8500);
  assert.equal(cotizar(linea, 'cliente', JUEVES).total, 9500);
});

test('2x1 en gaseosas con tope de 6 unidades', () => {
  const coca = producto({ nombre: 'Coca-Cola Original 2.25L', categoria: 'Gaseosas', precio: 3000 });
  const r = cotizar([{ producto: coca, cantidad: 9 }], 'invitado', JUEVES);
  assert.equal(r.ahorroPromos, 9000);   // 3 gratis dentro de las primeras 6
  assert.equal(r.total, 18000);
  assert.deepEqual(r.promosAplicadas, ['gaseosas-2x1']);
});

test('porcentaje de categoría reemplaza a la oferta solo si es mejor', () => {
  const leche = producto({ nombre: 'Leche La Serenísima Entera 1L', categoria: 'Lácteos', precio: 1000, oferta: true, descuento: 10 });
  const r = cotizar([{ producto: leche, cantidad: 1 }], 'invitado', LUNES);
  assert.equal(r.ahorroOfertas, 0);
  assert.equal(r.ahorroPromos, 200);    // 20 % del lunes lácteo gana al 10 %
  assert.equal(r.total, 800);

  const conMejorOferta = { ...leche, descuento: 30 };
  const r2 = cotizar([{ producto: conMejorOferta, cantidad: 1 }], 'invitado', LUNES);
  assert.equal(r2.total, 700);
  assert.deepEqual(r2.promosAplicadas, []);
});

test('segunda unidad al 70 % los martes de limpieza', () => {
  const skip = producto({ nombre: 'Jabón en Polvo Skip 3kg', categoria: 'Limpieza', precio: 10000 });
  const r = cotizar([{ producto: skip, cantidad: 3 }], 'invitado', MARTES);
  assert.equal(r.ahorroPromos, 7000);   // un par → 70 % de una unidad
  assert.equal(r.total, 23000);
});

test('las promos bancarias se informan pero no cambian el total', () => {
  const r = cotizar([{ producto: producto({ nombre: 'Arroz', precio: 1000 }), cantidad: 1 }], 'invitado', JUEVES);
  assert.deepEqual(r.promosReintegro, ['bna-jueves']);
  assert.equal(r.total, 1000);
});
