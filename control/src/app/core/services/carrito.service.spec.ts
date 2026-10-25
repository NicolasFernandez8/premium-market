import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { CarritoService } from './carrito.service';
import { Producto } from '../models/producto.model';

const producto = (nombre: string, stock = 10): Producto => ({
  _id: nombre, nombre, categoria: 'Almacén', precio: 1000, stock,
  descripcion: '', icono: 'shopping_bag', oferta: false, descuento: 0,
});

describe('CarritoService', () => {
  let service: CarritoService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(CarritoService);
  });

  it('no deja agregar más unidades que el stock', () => {
    const yerba = producto('Yerba', 3);
    service.agregar(yerba, 2);
    expect(service.agregar(yerba, 5)).toBe(3);
    expect(service.cantidadDe(yerba)).toBe(3);
  });

  it('un producto sin stock no entra al carrito', async () => {
    expect(service.agregar(producto('Agotado', 0))).toBe(0);
    expect(await firstValueFrom(service.cantidadTotal$)).toBe(0);
  });

  it('si la API informa menos stock, recorta la cantidad o quita el renglón', () => {
    service.agregar(producto('Leche'), 6);
    service.actualizarStock('Leche', 4);
    expect(service.items[0].cantidad).toBe(4);
    service.actualizarStock('Leche', 0);
    expect(service.items.length).toBe(0);
  });

  it('a la API solo le manda id y cantidad, sin precios', () => {
    service.agregar(producto('Arroz'), 2);
    expect(service.paraApi()).toEqual([{ producto: 'Arroz', cantidad: 2 }]);
  });

  it('el carrito sobrevive a una recarga (LocalStorage)', () => {
    service.agregar(producto('Fideos'), 2);
    const otro = new CarritoService();
    expect(otro.items[0].cantidad).toBe(2);
  });
});
