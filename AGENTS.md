# Guía de desarrollo — TekLease Web

Este documento define las convenciones y buenas prácticas del proyecto. Aplica a todas las personas y asistentes de IA que creen, modifiquen o revisen código en este repositorio.

## Stack principal

- Next.js con App Router.
- React.
- TypeScript.
- Tailwind CSS.

Antes de implementar un cambio, revisar la configuración y las versiones reales declaradas en `package.json`. No asumir APIs de una versión distinta.

## Principios generales

- Priorizar código claro, simple y fácil de mantener.
- Mantener cada cambio enfocado en un único objetivo.
- Reutilizar componentes, utilidades y patrones existentes antes de crear otros nuevos.
- Evitar abstracciones prematuras, duplicación y dependencias innecesarias.
- No modificar archivos ajenos al alcance del cambio.
- Preservar el estilo y la arquitectura existentes.
- Eliminar código muerto, imports sin uso, logs temporales y comentarios obsoletos.
- Documentar el motivo de una decisión compleja; no describir lo que el código ya expresa.

## Organización recomendada

Adaptar esta estructura a las necesidades reales del proyecto:

```text
src/
├── app/          # Rutas, layouts, loading, error y páginas
├── components/   # Componentes reutilizables
│   └── ui/       # Primitivas visuales
├── features/     # Lógica y componentes por dominio
├── hooks/        # Hooks reutilizables del cliente
├── lib/          # Clientes, configuración y utilidades
├── services/     # Acceso a APIs o fuentes de datos
├── styles/       # Estilos globales, si son necesarios
└── types/        # Tipos compartidos
```

- Colocar el código cerca de donde se utiliza.
- Usar carpetas de dominio cuando una funcionalidad crezca.
- Evitar archivos índice (`index.ts`) si ocultan el origen de los imports o generan ciclos.
- Usar alias de importación, por ejemplo `@/`, si están configurados en `tsconfig.json`.

## Next.js y App Router

- Usar Server Components por defecto.
- Añadir `"use client"` únicamente cuando el componente necesite estado, efectos, eventos, APIs del navegador o librerías exclusivas del cliente.
- Mantener los Client Components pequeños y ubicarlos lo más abajo posible en el árbol.
- Realizar la obtención inicial de datos en el servidor cuando sea viable.
- Definir correctamente la estrategia de caché y revalidación; no depender de valores predeterminados sin evaluar su impacto.
- Usar `loading.tsx`, `error.tsx`, `not-found.tsx` y `Suspense` cuando mejoren la experiencia.
- Usar `next/link`, `next/image`, `next/font` y las APIs de metadata de Next.js.
- No acceder directamente a secretos, bases de datos o servicios internos desde componentes cliente.
- Validar y autorizar nuevamente en Server Actions y Route Handlers; la interfaz no es una frontera de seguridad.
- Mantener páginas y layouts ligeros. Extraer lógica de dominio compleja a módulos dedicados.
- Evitar rutas dinámicas, middleware o renderizado en cliente si una solución más simple resuelve el caso.

## React

- Crear componentes pequeños, cohesivos y con una responsabilidad clara.
- Preferir composición sobre componentes con demasiadas variantes o props booleanas.
- No guardar en estado valores que puedan derivarse de props u otro estado.
- Reservar `useEffect` para sincronización con sistemas externos; no usarlo para cálculos derivados ni para flujos que puedan resolverse durante el render.
- Mantener las dependencias de hooks completas y correctas.
- Usar nombres explícitos para handlers: `handleSubmit`, `handleClose`, `handleSearch`.
- Proporcionar `key` estable al renderizar listas; no usar el índice si los elementos pueden cambiar de orden.
- Implementar estados de carga, vacío, error y éxito cuando corresponda.
- Evitar memoización (`useMemo`, `useCallback`, `memo`) sin una razón medible.

## TypeScript

- Mantener el modo estricto habilitado.
- Evitar `any`. Usar `unknown` y hacer narrowing cuando el tipo sea incierto.
- No silenciar errores con `@ts-ignore`; corregir el tipo o justificar excepcionalmente `@ts-expect-error`.
- Tipar explícitamente los límites del sistema: props públicas, respuestas de API, formularios, variables de entorno y funciones exportadas.
- Inferir tipos locales cuando el resultado sea claro.
- Preferir uniones discriminadas para estados mutuamente excluyentes.
- Usar `type` para uniones y composiciones; usar `interface` cuando se necesite extensión o declaración pública.
- Evitar enums si un objeto `as const` o una unión literal resulta más simple.
- Validar datos externos en tiempo de ejecución; los tipos de TypeScript no validan respuestas reales.
- No usar aserciones de tipo (`as`) para ocultar incompatibilidades.

## Tailwind CSS y estilos

- Usar las clases y tokens definidos por el proyecto antes de introducir valores arbitrarios.
- Mantener consistencia en colores, espaciado, tipografía, radios y sombras.
- Diseñar con enfoque responsive, comenzando por pantallas pequeñas.
- Evitar estilos inline salvo valores verdaderamente dinámicos.
- Extraer un componente cuando un patrón visual y semántico se repita.
- No crear componentes solo para reutilizar una cadena de clases una única vez.
- Usar una utilidad como `cn` para combinar clases condicionales, si el proyecto la incluye.
- Mantener estados interactivos coherentes: `hover`, `focus-visible`, `disabled`, `aria-invalid`.
- Comprobar contraste y no comunicar información exclusivamente mediante color.

## Accesibilidad

- Usar HTML semántico antes que elementos genéricos con roles.
- Todos los controles deben ser accesibles mediante teclado.
- Asociar cada campo con su `label`, descripción y mensaje de error.
- Incluir texto alternativo útil en imágenes informativas y `alt=""` en imágenes decorativas.
- Mantener un orden lógico de encabezados.
- Usar `aria-*` solo cuando HTML nativo no sea suficiente.
- Gestionar el foco en diálogos, menús y cambios importantes de interfaz.
- Respetar `prefers-reduced-motion` en animaciones no esenciales.

## Datos, formularios y errores

- Mantener la lógica de acceso a datos separada de la presentación.
- Validar datos tanto en el cliente para mejorar la experiencia como en el servidor para garantizar integridad.
- No exponer mensajes internos, trazas ni datos sensibles al usuario.
- Presentar errores accionables y conservar los datos del formulario cuando sea posible.
- Manejar respuestas incompletas, timeouts y estados vacíos.
- No registrar tokens, contraseñas, información personal ni payloads sensibles.

## Seguridad

- Nunca versionar secretos ni archivos `.env` con credenciales.
- Exponer al navegador solo variables que deban ser públicas y tengan el prefijo requerido por Next.js.
- Sanitizar o evitar HTML proporcionado por usuarios. No usar `dangerouslySetInnerHTML` sin una revisión explícita.
- Validar permisos en el servidor para cada operación protegida.
- Aplicar el principio de mínimo privilegio.
- Revisar enlaces externos, redirecciones, carga de archivos y entradas usadas en consultas.

## Rendimiento

- Evitar enviar JavaScript al cliente cuando el servidor pueda resolver el trabajo.
- Cargar de forma diferida componentes pesados que no sean necesarios en el render inicial.
- Optimizar imágenes con dimensiones correctas y tamaños responsive.
- Evitar solicitudes secuenciales cuando puedan ejecutarse en paralelo.
- Prevenir consultas repetidas y payloads mayores de lo necesario.
- Medir antes de realizar optimizaciones complejas.

## Pruebas y validación

Cada cambio debe verificarse en proporción a su alcance:

1. Ejecutar el formateador, si existe.
2. Ejecutar lint.
3. Ejecutar la comprobación de tipos.
4. Ejecutar las pruebas relacionadas.
5. Ejecutar el build cuando el cambio afecte configuración, rutas, renderizado o integración.
6. Revisar manualmente la interfaz en los tamaños de pantalla relevantes.

No afirmar que una comprobación pasó si no fue ejecutada. Si no se puede ejecutar, indicar la causa.

Las pruebas deben comprobar comportamiento observable y casos límite relevantes. Evitar pruebas acopladas a detalles internos de implementación.

## Dependencias

- Usar el gestor de paquetes indicado por el lockfile existente.
- No instalar una dependencia si la plataforma o el código actual ya resuelven el problema de forma razonable.
- Revisar mantenimiento, tamaño, licencia y compatibilidad antes de añadir paquetes.
- No actualizar dependencias fuera del alcance del cambio.

## Git y commits

- Usar Conventional Commits.
- Formato: `<tipo>(<alcance opcional>): <descripción breve>`.
- Escribir el tipo y la descripción en minúsculas, en modo imperativo y sin punto final.
- Tipos habituales:
  - `feat`: nueva funcionalidad.
  - `fix`: corrección de un error.
  - `refactor`: cambio interno sin alterar comportamiento.
  - `style`: cambios visuales o de formato sin lógica nueva.
  - `test`: creación o ajuste de pruebas.
  - `docs`: documentación.
  - `chore`: mantenimiento, herramientas o configuración.
  - `perf`: mejora de rendimiento.
  - `build`: sistema de compilación o dependencias.
  - `ci`: integración o despliegue continuo.
- Un commit debe representar una unidad lógica y evitar mezclar cambios no relacionados.
- No hacer commit, push ni abrir un pull request salvo solicitud explícita.

Ejemplos:

```text
feat(auth): agrega formulario de inicio de sesión
fix(leases): corrige el cálculo del pago mensual
refactor(ui): simplifica las variantes del botón
docs: agrega guía de buenas prácticas
```

## Entrega de cada cambio

Al finalizar cualquier modificación, la respuesta debe:

1. Resumir brevemente qué cambió.
2. Indicar las comprobaciones realizadas y su resultado.
3. Mencionar cualquier riesgo, limitación o tarea pendiente relevante.
4. Terminar siempre con una sugerencia de commit en este formato exacto:

```text
Commit sugerido: <tipo>(<alcance opcional>): <descripción breve>
```

La sugerencia debe describir únicamente el cambio realizado y cumplir Conventional Commits. Aunque no se haya creado un commit, siempre se debe recomendar un nombre.
