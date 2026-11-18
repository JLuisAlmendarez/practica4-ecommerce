# Práctica 4 · Anime Store: Front-End conectado a la API

Tienda **Anime Store** con catálogo paginado y carrito interactivo. Une las interfaces de la Práctica 1 (HTML, CSS y Bootstrap) con la API REST de la Práctica 3 (Node.js y Express). El navegador consulta y modifica los datos con `fetch` y `async/await`, construye la vista con el DOM y guarda en `sessionStorage` una copia del último carrito que confirmó el servidor.

**Autor:** José Luis Almendarez González · **Materia:** Diseño de aplicaciones y servicios web · **Profesor:** Uriel Robles Gil

## Requisitos

- Node.js 20 o superior y npm.
- Un navegador moderno. Las páginas se abren desde el servidor de Express, no con `file://`.
- Opcional: Visual Studio Code con la extensión **REST Client** para `test/requests.http`.

## Instalación e inicio

```bash
cd practica4-ecommerce
npm install
npm start
```

| Dato | Valor |
|---|---|
| Archivo de inicio | `src/server.js` (importa la aplicación de `src/app.js`) |
| Puerto | `3000`; se cambia con la variable `PORT` (ver `.env.example`) |
| URL local | <http://localhost:3000> |
| Modo desarrollo | `npm run dev` (nodemon; ignora `data/`, `test/` y `public/`) |
| Pruebas automáticas | `npm test` |
| Restaurar datos iniciales | `npm run reset-data` |
| Usuario de prueba del carrito | `ana` (header `x-user: ana`) |

Páginas:

| Página | URL | Contenido |
|---|---|---|
| Catálogo | `/` o `/index.html` | Carrusel, catálogo paginado de 4 en 4, modal de cantidad |
| Carrito | `/shopping-cart.html` | Entradas, edición, eliminación, subtotales y total |
| Mis pedidos | `/orders.html` | Pantalla de la Práctica 1 (sin cambios funcionales) |
| Administración (opcional) | `/admin.html` | CRUD de productos |

Bootstrap 5.3.8 y Font Awesome 6.7.2 se instalan con npm y Express los sirve en `/vendor/...`, así la interfaz no depende de un CDN.

## Dónde se guardan los datos

- **Servidor (fuente oficial):** `data/products.json` y `data/carts.json`, que escriben los repositorios de la Práctica 3 con `fs/promises`. `data/seed/` guarda la copia inicial que restaura `npm run reset-data`.
- **Navegador (copia temporal):** `sessionStorage`, con la clave `ecommerce.cart.ana`.

### Cómo opera sessionStorage

1. Después de cada `POST`, `PATCH` o `DELETE` confirmado, el navegador vuelve a consultar `GET /api/cart` y guarda **esa respuesta** con `JSON.stringify`.
2. Al abrir o recargar `shopping-cart.html`, muestra primero la copia local (si existe) con las acciones bloqueadas y vuelve a consultar `GET /api/cart`. La respuesta del servidor reemplaza la copia y la vista.
3. `readCart()` usa `JSON.parse` dentro de `try/catch`. Una clave ausente, un JSON dañado o un objeto con otra forma regresan `null` y no detienen la página.
4. Si el servidor no responde y hay copia, se muestra con el aviso **Datos sin actualizar**, las modificaciones se deshabilitan y aparece **Reintentar**. La copia nunca se envía al servidor ni reemplaza su carrito.
5. `sessionStorage` sobrevive a recargas de la misma pestaña. Al cerrarla se pierde, pero el carrito sigue en el servidor.

## Organización del Front-End

```
public/
├── index.html · shopping-cart.html · orders.html · admin.html
├── css/estilos.css        Estilos de la Práctica 1 y ajustes nuevos
├── img/sin-imagen.svg     Imagen local cuando una URL remota no carga
└── js/
    ├── api.js             Solo HTTP: fetch, response.ok, 204, ApiError, describeError
    ├── storage.js         Solo sessionStorage: saveCart, readCart, clearCart
    ├── validation.js      Validaciones puras (cantidades, totales)
    ├── ui.js              Helpers del DOM: el(), textContent, formato MXN, toasts, modal de confirmación
    ├── cart-sync.js       GET /api/cart → sessionStorage → indicador; enlaces del carrito
    ├── common.js          Inicio común de las páginas (navbar, buscador, formularios)
    ├── catalog.js         Catálogo, paginación y modal de cantidad
    ├── cart.js            Vista del carrito, edición y eliminación
    ├── admin.js           CRUD opcional de productos
    └── orders.js          Inicio de la página de pedidos
```

Las funciones que llaman a la API (`api.js`) están separadas de las que modifican el DOM. Las listas usan **delegación de eventos**: hay un solo listener por contenedor, así volver a dibujar las tarjetas no registra eventos repetidos. Todo el texto del servidor se inserta con `textContent`.

## Endpoints que consume la interfaz

| Acción | Solicitud | Datos |
|---|---|---|
| Catálogo | `GET /api/products?page=N&limit=4` | `data`, `pagination`, `total` |
| Consultar carrito | `GET /api/cart` | header `x-user: ana` |
| Agregar | `POST /api/cart/items` | `{ productId, quantity }` |
| Cambiar cantidad | `PATCH /api/cart/items/:productId` | `{ quantity }` |
| Eliminar | `DELETE /api/cart/items/:productId` | sin body |
| Administración | `POST`, `PUT`, `DELETE /api/products[/:id]` | campos del producto |

El navegador nunca envía precios, subtotales ni totales: solo `productId` y `quantity`.

| Respuesta | Comportamiento de la interfaz |
|---|---|
| 200 / 201 | Procesa la respuesta, consulta el carrito y actualiza la vista |
| 204 | Confirma sin leer JSON (`DELETE /api/products/:id`) |
| 400 | «Dato inválido: …» junto al campo; permite corregir |
| 404 | «El producto ya no existe»; botón **Actualizar catálogo** |
| 409 | «No hay existencias suficientes: solo quedan N»; conserva el estado confirmado |
| Red / 5xx | Mensaje y botón **Reintentar** |

## Pruebas

- `npm test`: 16 pruebas con `node:test`. Prueban la API (paginación 4/4/1, x-user, POST que incrementa, 400/404/409, PATCH, PATCH 0 y DELETE) y los módulos del navegador sin DOM (`storage.js`, `api.js` y `validation.js`). La API usa una copia temporal de los datos (`DATA_DIR`), así `data/` no cambia.
- `test/requests.http`: 49 solicitudes para REST Client. Las 1–34 son las de la Práctica 3, adaptadas al catálogo de la tienda. Las 35–49 recorren los endpoints de la interfaz en el mismo orden que el navegador. Conviene ejecutarlas en orden después de `npm run reset-data`.

---

## Entrega individual · Práctica 4

### Requerimientos

| # | Requerimiento | Cumplido | Dónde |
|---|---|---|---|
| 1 | Catálogo desde el servidor con `fetch`, tarjetas por DOM y estados de carga, vacío y error | Sí | `catalog.js` · `loadPage`, `productCard` |
| 2 | Paginación de 4 productos (backend `page`/`limit` y frontend con límites) | Sí | `catalog.js` · `renderPagination` |
| 3 | Modal de cantidad con validación de entero y stock, sin envíos repetidos | Sí | `catalog.js` · `submitQuantity`, `validation.js` |
| 4 | Entradas con ID, nombre, precio, cantidad, subtotales y total del servidor | Sí | `cart.js` · `cartLine`, `renderSummary` |
| 5 | Navegar o abrir el carrito consulta `GET /api/cart`; estado vacío | Sí | `cart-sync.js`, `cart.js` · `loadCart` |
| 6 | Editar con Confirmar/Cancelar, `PATCH`, 0 con confirmación, inválidos y 409 | Sí | `cart.js` · `confirmEdit` |
| 7 | Eliminar con confirmación y `DELETE`; conserva la entrada si falla | Sí | `cart.js` · `deleteLine`, `mutate` |
| 8 | `sessionStorage` con JSON, cache ausente o dañado, sincronización y modo sin conexión | Sí | `storage.js`, `cart.js` |
| Opc. | Administración con CRUD de productos | Sí | `admin.js`, `admin.html` |

### Pasos para reproducir

```bash
npm install
npm run reset-data
npm test
npm start
```

1. Abre <http://localhost:3000>: la página 1 muestra 4 productos; **Siguiente** lleva a la 2 (4) y a la 3 (1, la Máscara kitsune sin existencias).
2. **Agregar al carrito** en Figura de Asuka → cantidad `2` → Confirmar. Repite con `1`: la entrada sube a 3.
3. En la página 2 agrega 3 **Pases para convención** y luego intenta 1 más: aparece el mensaje del 409.
4. Pulsa el ícono del carrito: total `$8,037.00 MXN`. **Editar** la figura → 4 → Confirmar: `$9,936.00 MXN`.
5. Prueba Cancelar, `-1`, `1.5`, `99` y `0` en la edición; después **Eliminar** con confirmación.
6. En DevTools → Application → Session Storage, borra `ecommerce.cart.ana` y recarga: el carrito se reconstruye desde `GET /api/cart`.
7. Detén el servidor y recarga el carrito: aparece **Datos sin actualizar** con las acciones bloqueadas. Arráncalo y pulsa **Reintentar**.

### Resultados

| Verificación | Resultado |
|---|---|
| `npm test` (API y módulos del navegador) | 16/16 |
| `test/requests.http` en orden, sobre datos iniciales | 49/49 con el código esperado |
| Recorrido automático en Chrome (criterios 1–8 y administración) | 54/54 |
| Errores de JavaScript en consola durante el recorrido | 0 |
| Archivos `.env` o secretos en el proyecto | Ninguno (solo `.env.example`) |

### Publicación en línea

| Dato | Valor |
|---|---|
| URL pública | <https://practica4-ecommerce-jlalmendarez.onrender.com> |
| Repositorio | <https://github.com/JLuisAlmendarez/practica4-ecommerce> |
| Servicio | Render · Web Service · plan Free · Oregon · desde "Public Git Repository" |
| Build / Start / Health | `npm ci` · `npm start` · `/health` |
| Variables | `NODE_ENV=production`, `CORS_ORIGIN=<URL del servicio>` |

Esta práctica no usa base de datos ni JWT (la persistencia sigue en JSON y la autenticación está fuera del alcance), así que no hay secretos que configurar. El disco de Render no es persistente: al reiniciar o volver a desplegar, `data/` vuelve al estado del repositorio. El plan Free suspende el servicio tras un rato sin uso, así que la primera visita puede tardar unos segundos.

### Explicaciones

- **Una sola fuente de verdad.** El carrito oficial vive en el servidor. Después de cada cambio se vuelve a pedir `GET /api/cart` aunque `POST`/`PATCH`/`DELETE` ya regresen el carrito: así el DOM, el indicador y `sessionStorage` siempre reflejan la misma respuesta.
- **Validación en dos lados.** El navegador valida para dar retroalimentación inmediata (enteros, stock, campos del producto), pero el servidor es la autoridad. Si rechaza el cambio (por ejemplo, un 409), la interfaz restaura el valor confirmado.
- **Catálogo de la tienda.** `data/products.json` ahora tiene los 8 productos de la Práctica 1 más la Máscara kitsune (stock 0). Así hay 9 productos y 3 páginas, y se puede probar *Sin existencias*. Se conservaron los campos del contrato de la Práctica 3.
- **Imágenes.** Se conservan las URL reales de la Práctica 1. Si alguna no carga (hotlinking bloqueado o sin red), `img/sin-imagen.svg` la sustituye para no dejar una imagen rota.
- **Administración opcional.** Usa los endpoints de productos de la Práctica 3, que no tienen autenticación. Ocultar la página no la protegería, así que se documenta como herramienta de práctica.
