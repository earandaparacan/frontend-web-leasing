# Teklease — Especificación visual para Login UI

Referencia analizada: https://teklease.com.py/

## 1. Identidad visual observada

El lenguaje visual de Teklease se apoya en:

- Contraste fuerte entre negro, blanco y un naranja muy saturado.
- Titulares grandes, geométricos y con poco espacio entre letras.
- Mucho espacio libre y composiciones editoriales.
- Tarjetas y botones con esquinas redondeadas.
- Botones tipo píldora en algunas llamadas a la acción.
- Fotografías o representaciones grandes de dispositivos.
- Superficies blancas y grises muy claras.
- Textos secundarios en gris y negro con transparencias.
- Jerarquía muy clara: Urbanist para títulos e Inter para contenido.

## 2. Paleta

### Valores observados en la web

| Rol | Valor | Uso |
|---|---:|---|
| Naranja principal | `#FF5E2B` | Marca, acciones y acentos |
| Negro | `#000000` | Fondos de alto contraste y botones |
| Blanco | `#FFFFFF` | Superficies y texto invertido |
| Gris de fondo | `#F7F7F7` | Secciones y lienzo |
| Gris alternativo | `#F3F3F3` | Superficies secundarias |
| Gris de texto | `#777777` | Texto secundario |
| Tinta oscura | `#171717` | Texto principal y fondos oscuros suaves |
| Rojo oscuro | `#B30411` | Estados críticos/error |
| Naranja suave | `rgba(255, 94, 43, 0.10)` | Estados, halos y fondos sutiles |
| Negro translúcido | `rgba(23, 23, 23, 0.50)` | Capas y overlays |

### Valores complementarios definidos para el login

| Rol | Valor | Uso |
|---|---:|---|
| Naranja hover | `#E94D1B` | Hover/pressed del botón |
| Borde | `#E1E1E1` | Campos y tarjetas |
| Placeholder | `#AAAAAA` | Texto dentro de campos |
| Disabled | `#E8E8E8` | Fondo de controles deshabilitados |
| Éxito | `#68A56D` | Indicador de seguridad |

## 3. Tipografía

### Tipografías detectadas

- **Urbanist**: titulares, cifras y mensajes de alto impacto.
- **Inter**: párrafos, etiquetas, navegación, botones e interfaz.

### Uso observado en el sitio

| Elemento | Familia | Peso/tamaño observado |
|---|---|---|
| Hero H1 | Urbanist | 700 / 92 px |
| Título H2 | Urbanist | 600 / 36 px |
| Subtítulo H4 | Urbanist | 500 / 28 px |
| Cifras destacadas | Urbanist | 500 / 48 px |
| Cuerpo principal | Inter | 400 / 16 px |
| Cuerpo compacto | Inter Variable | 400 / 15 px |
| Caption | Inter | 400 / 14 px |
| Etiqueta destacada | Inter | 700 / 16 px |

### Estilos creados en Figma

| Estilo | Familia y peso | Tamaño / línea |
|---|---|---|
| `Display/Hero` | Urbanist Bold | 64 / 68 |
| `Heading/H1` | Urbanist SemiBold | 44 / 52 |
| `Heading/H2` | Urbanist SemiBold | 32 / 40 |
| `Heading/H3` | Urbanist SemiBold | 24 / 32 |
| `Body/Large` | Inter Regular | 18 / 28 |
| `Body/Medium` | Inter Regular | 16 / 24 |
| `Body/Small` | Inter Regular | 14 / 20 |
| `Label/Medium` | Inter Medium | 14 / 20 |
| `Button/Medium` | Inter Semi Bold | 16 / 24 |

## 4. Variables creadas en Figma

### `Teklease / Primitives`

- `orange/500` → `#FF5E2B`
- `orange/600` → `#E94D1B`
- `neutral/0` → `#FFFFFF`
- `neutral/50` → `#F7F7F7`
- `neutral/100` → `#F3F3F3`
- `neutral/200` → `#E1E1E1`
- `neutral/500` → `#777777`
- `neutral/900` → `#171717`
- `neutral/1000` → `#000000`
- `red/600` → `#B30411`

### `Teklease / Color`

- `color/bg/canvas`
- `color/bg/surface`
- `color/bg/brand`
- `color/bg/inverse`
- `color/text/primary`
- `color/text/secondary`
- `color/text/on-brand`
- `color/text/inverse`
- `color/border/default`
- `color/border/focus`
- `color/action/primary`
- `color/action/primary-hover`
- `color/action/danger`

Los 13 colores semánticos están enlazados mediante alias a la colección de primitivas.

### `Teklease / Dimensions`

Espaciado:

- `spacing/4`
- `spacing/8`
- `spacing/12`
- `spacing/16`
- `spacing/24`
- `spacing/32`
- `spacing/48`

Radios:

- `radius/8`
- `radius/12`
- `radius/16`
- `radius/full` → 999 px

Todas las variables tienen ámbitos específicos y nombres CSS configurados. No existen alias rotos ni variables con `ALL_SCOPES`.

## 5. Sombra creada

`Shadow/Card`

```text
Tipo: Drop shadow
Offset: 0, 12
Blur: 36
Spread: -8
Color: rgba(0, 0, 0, 0.10)
```

## 6. Composición del login

- Tamaño de referencia: **1440 × 1024 px**.
- Columna de marca: **620 px**.
- Columna del formulario: **820 px**.
- Panel izquierdo negro con acento naranja, dispositivo y mensaje comercial.
- Panel derecho gris `#F7F7F7` con formulario centrado de **460 px** de ancho.
- El formulario usa una barra naranja corta como marcador de marca.
- El contenido está centrado verticalmente y rodeado de mucho espacio libre.

## 7. Medidas de interfaz

| Elemento | Medida |
|---|---:|
| Ancho del formulario | 460 px |
| Altura de campos | 56 px |
| Altura del botón | 56 px |
| Radio de campos y botón | 12 px |
| Borde de campos | 1 px |
| Padding horizontal de campos | 16 px |
| Separación entre campos | 20 px |
| Separación antes del botón | 28 px |
| Iconos de campo | 20 × 20 px |
| Checkbox | 18 × 18 px |
| Focus ring | 3 px, naranja al 12% |

## 8. Estados definidos

### Campo de texto

- **Default:** borde `#E1E1E1`, fondo blanco.
- **Focus:** borde `#FF5E2B` y halo naranja al 12%.
- **Error:** borde y texto `#B30411`.

### Botón principal

- **Default:** fondo `#FF5E2B`, texto blanco.
- **Hover:** fondo `#E94D1B`.
- **Disabled:** fondo `#E8E8E8`, texto gris.

### Checkbox

- Seleccionado: fondo naranja, check blanco y radio de 5 px.

## 9. Textos propuestos

Panel de marca:

- “Tecnología sin complicaciones”
- “Todo lo que necesitás, en un solo plan.”
- “Gestioná tus equipos, tu plan y tu cobertura desde un mismo lugar.”
- “Equipo · Plan móvil · Seguro premium”
- “Acceso seguro para clientes Teklease”

Formulario:

- “Bienvenido de vuelta.”
- “Ingresá a tu cuenta para consultar tus equipos y administrar tu plan.”
- “Correo electrónico”
- “Contraseña”
- “Recordarme”
- “¿Olvidaste tu contraseña?”
- “Ingresar a mi cuenta”
- “Tu información está protegida”

## 10. Accesibilidad y comportamiento

- Mantener contraste alto entre texto y fondo.
- No usar el naranja para párrafos largos.
- Conservar foco visible en todos los campos y botones.
- Objetivos táctiles principales de al menos 44 px.
- Los errores deben expresarse con color y texto, no solamente con color.
- Mantener etiquetas visibles fuera de los campos.

## 11. Estado de los entregables

Archivo Figma de fundamentos:

https://www.figma.com/design/RLD8mXFPFFfaJ0r89XB7FP

Incluye:

- 3 colecciones.
- 34 variables.
- 9 estilos tipográficos.
- 1 estilo de sombra.
- Portada.
- Estructura y documentación inicial de fundamentos.

La pantalla final fue diseñada y validada localmente. Su importación editable quedó pendiente por el límite mensual del plan Starter/View de Figma.
