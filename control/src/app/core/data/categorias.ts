// ── CATEGORÍAS DEL CATÁLOGO ───────────────────
// Lista única de categorías con su ícono de Material Icons.
// La usan la consulta de precios (filtros) y el alta de productos,
// así un producto nuevo siempre cae en una categoría filtrable.

export interface Categoria {
  nombre: string;
  icono: string;
}

export const CATEGORIAS: Categoria[] = [
  { nombre: 'Gaseosas',              icono: 'local_drink'       },
  { nombre: 'Aguas y Jugos',         icono: 'water_drop'        },
  { nombre: 'Bebidas con Alcohol',   icono: 'sports_bar'        },
  { nombre: 'Lácteos',               icono: 'egg'               },
  { nombre: 'Fiambres',              icono: 'lunch_dining'      },
  { nombre: 'Carnes',                icono: 'kebab_dining'      },
  { nombre: 'Congelados',            icono: 'ac_unit'           },
  { nombre: 'Verdulería',            icono: 'eco'               },
  { nombre: 'Panadería',             icono: 'bakery_dining'     },
  { nombre: 'Almacén',               icono: 'storefront'        },
  { nombre: 'Enlatados',             icono: 'inventory_2'       },
  { nombre: 'Aceites y Condimentos', icono: 'oil_barrel'        },
  { nombre: 'Cereales y Legumbres',  icono: 'grass'             },
  { nombre: 'Desayuno y Merienda',   icono: 'free_breakfast'    },
  { nombre: 'Snacks',                icono: 'fastfood'          },
  { nombre: 'Golosinas',             icono: 'cake'              },
  { nombre: 'Limpieza',              icono: 'cleaning_services' },
  { nombre: 'Higiene Personal',      icono: 'soap'              },
  { nombre: 'Perfumería',            icono: 'face_retouching_natural' },
  { nombre: 'Farmacia',              icono: 'local_pharmacy'    },
  { nombre: 'Mascotas',              icono: 'pets'              },
  { nombre: 'Ferretería',            icono: 'hardware'          },
  { nombre: 'Librería',              icono: 'menu_book'         },
  { nombre: 'Electrónica',           icono: 'devices'           },
  { nombre: 'Infantil',              icono: 'child_care'        },
  { nombre: 'Textil',                icono: 'checkroom'         },
];

// Ícono de una categoría (para productos nuevos)
export function iconoDeCategoria(nombre: string): string {
  return CATEGORIAS.find(c => c.nombre === nombre)?.icono ?? 'shopping_bag';
}
