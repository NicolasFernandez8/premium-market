// ── ÍCONO DE PRODUCTO ─────────────────────────
// Para los productos sin foto elige un ícono de Material Icons
// que represente al producto en sí (no solo a su categoría).
// Se recorre en orden: gana la primera palabra clave que coincide.
// Si ninguna coincide, se usa el ícono que trae el producto desde la API.

const REGLAS: [RegExp, string][] = [
  // Casos puntuales que tienen que ganarle a las reglas generales de abajo
  [/labial/i, 'face_retouching_natural'],                     // antes que "lápiz"
  [/pringles|twisties|chips|pepas de ma[ií]z/i, 'tapas'],     // antes que "tostadas"
  [/juguete|pelota/i, 'sports_baseball'],
  [/dulce de leche|manteca de man[ií]|mermelada/i, 'breakfast_dining'],
  [/miel/i, 'emoji_nature'],
  [/caf[eé]|cacao/i, 'coffee'],
  [/galletitas|vainillas|alfajor|regaliz/i, 'cookie'],
  [/bud[ií]n/i, 'cake'],
  [/chicle/i, 'bubble_chart'],
  [/arroz/i, 'rice_bowl'],
  [/levadura/i, 'grain'],
  [/hamburguesa/i, 'lunch_dining'],
  [/canelones|ravioles|[nñ]oquis/i, 'dinner_dining'],
  [/spray nasal/i, 'air'],
  [/magnesio/i, 'medication'],
  [/test de embarazo/i, 'pregnant_woman'],
  [/bepanthen/i, 'healing'],
  [/cable/i, 'cable'],
  [/resma|papel a4/i, 'description'],
  [/comp[aá]s/i, 'architecture'],
  [/regla /i, 'straighten'],
  [/s[aá]bana/i, 'bed'],
  [/term[oó]metro/i, 'thermostat'],
  [/monitor de beb[eé]/i, 'videocam'],
  [/bloqueador|protector solar/i, 'wb_sunny'],
  [/m[aá]scara de pesta/i, 'visibility'],
  [/jab[oó]n blanco/i, 'soap'],
  [/lector sd|sd card/i, 'sd_card'],
  [/algod[oó]n/i, 'cloud'],

  // Bebidas
  [/t[oó]nica|agua/i, 'local_drink'],
  [/jugo|tang/i, 'emoji_food_beverage'],

  // Fiambres y carnes
  [/pepperoni|soppressata|longaniza|pastrami|salame|chorizo/i, 'kebab_dining'],

  // Almacén, enlatados y condimentos
  [/at[uú]n|tuna|sardina|caballa/i, 'set_meal'],
  [/caldo|pur[eé]|sopa/i, 'soup_kitchen'],
  [/champi[nñ]on|vegetales|edamame|arveja|manzana|frutas/i, 'eco'],
  [/or[eé]gano|adobo|condimento|chimichurri/i, 'grass'],
  [/maicena|harina/i, 'grain'],
  [/cereales|granola/i, 'rice_bowl'],
  [/mantequilla|tostadas/i, 'breakfast_dining'],

  // Panadería, congelados y golosinas
  [/muffin|torta|mousse/i, 'cake'],
  [/helado/i, 'icecream'],
  [/pan |pan$|scones|espirales|chipa|medialuna|factura/i, 'bakery_dining'],
  [/chupet[ií]n|paleta|blow pop|pica pica/i, 'celebration'],
  [/chocolate|marroc|m&m|chizitos|ganchitos|palomitas|pepas|ritz/i, 'cookie'],

  // Farmacia
  [/curita|venda/i, 'healing'],
  [/tijera/i, 'content_cut'],
  [/suero/i, 'vaccines'],
  [/anti[aá]cido|gaviscon|jarabe/i, 'medication_liquid'],
  [/pastillas|probi[oó]tico|comprimidos/i, 'medication'],

  // Mascotas
  [/shampoo perro/i, 'soap'],
  [/transport[ií]n/i, 'luggage'],
  [/perro|gato|pedigree|dreamies/i, 'pets'],

  // Ferretería y electrónica
  [/malla sombra/i, 'roofing'],
  [/tornillo/i, 'hardware'],
  [/guantes/i, 'pan_tool'],
  [/extensi[oó]n el[eé]ctrica|regleta/i, 'power'],
  [/bater[ií]a/i, 'battery_charging_full'],
  [/l[aá]mpara|ring light/i, 'lightbulb'],
  [/pegamento|loctite|uhu/i, 'construction'],

  // Librería
  [/cuaderno/i, 'menu_book'],
  [/t[eé]mpera|pintura/i, 'palette'],
  [/portafolio|carpeta/i, 'folder'],
  [/lapicera|l[aá]piz|bic/i, 'edit'],

  // Infantil
  [/mamadera/i, 'local_drink'],
  [/ba[nñ]era/i, 'bathtub'],
  [/silla de comer/i, 'chair'],
  [/librito|libro/i, 'auto_stories'],
  [/ropa de cama/i, 'bed'],
  [/cuna/i, 'crib'],
  [/portabeb[eé]/i, 'child_friendly'],
  [/mordedor|sonajero/i, 'toys'],

  // Perfumería
  [/tinte/i, 'brush'],
  [/polvo compacto|maquillaje/i, 'face_retouching_natural'],
  [/perfume|colonia|body splash/i, 'spa'],

  // Textil
  [/zapatillas/i, 'directions_run'],
  [/zapatos|crocs/i, 'beach_access'],
  [/gorra/i, 'sports_baseball'],
  [/bufanda/i, 'ac_unit'],
  [/bikini|ba[nñ]ador/i, 'pool'],
  [/camisa|jean|remera|buzo/i, 'checkroom'],

  // Limpieza
  [/limpiaba[nñ]os|harpic/i, 'wc'],
  [/esponja/i, 'wash'],
  [/papel de cocina|servilleta/i, 'layers'],
  [/limpiapiso|lavandina|detergente/i, 'cleaning_services'],
];

export function iconoProducto(nombre: string, iconoRespaldo: string): string {
  return REGLAS.find(([regla]) => regla.test(nombre))?.[1] ?? (iconoRespaldo || 'shopping_bag');
}
