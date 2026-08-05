# TekLease Web

Portal interno de TekLease para la operación del equipo: autenticación de personal, consulta de dispositivos, acciones MDM y módulos administrativos.

Está construido con Next.js (App Router), React, TypeScript y Tailwind CSS. El frontend no accede a los servicios internos desde el navegador: sus Route Handlers actúan como BFF y se comunican con el backend Django.

## Requisitos

- Node.js 24 o superior.
- pnpm 11.18.0 (se habilita mediante Corepack).
- Un backend Django de TekLease disponible, por defecto en `http://127.0.0.1:8000`.

## Inicio rápido

1. Habilitá Corepack e instalá las dependencias:

   ```bash
   corepack enable
   pnpm install --frozen-lockfile
   ```

2. Creá el archivo de entorno local:

   ```bash
   Copy-Item .env.example .env
   ```

   En macOS o Linux:

   ```bash
   cp .env.example .env
   ```

3. Confirmá que `BACKEND_URL` apunte al backend Django y ejecutá la aplicación:

   ```bash
   pnpm dev
   ```

4. Abrí [http://localhost:3000](http://localhost:3000).

Para desarrollo local sin HTTPS, configurá `AUTH_COOKIE_SECURE=false` en `.env`; en producción debe permanecer en `true`.

## Variables de entorno

| Variable | Requerida | Descripción |
| --- | --- | --- |
| `BACKEND_URL` | Sí | URL privada del backend Django. Predeterminada: `http://127.0.0.1:8000`. |
| `DOCKER_BACKEND_URL` | Con Docker | URL del backend vista desde el contenedor. Usá `http://backend:8000` si ambos servicios comparten una red de Compose. |
| `WEB_PORT` | No | Puerto publicado por Docker Compose. Predeterminado: `3000`. |
| `AUTH_COOKIE_SECURE` | Sí en producción | Define si las cookies de sesión requieren HTTPS. Predeterminado: `true`. |
| `MDM_BACKEND_URL` | No | Servicio MDM alternativo para las consultas y acciones legacy. Si no se define, se utiliza el backend Django. |
| `MDM_QUERY_PATH` | No | Ruta de consulta MDM cuando se configura un servicio MDM alternativo. |
| `MDM_ACTION_PATH` | No | Ruta de acciones MDM cuando se configura un servicio MDM alternativo. |
| `MDM_BACKEND_USER` | No | Usuario para autenticación Basic ante el servicio MDM alternativo. |
| `MDM_BACKEND_PASSWORD` | No | Contraseña para autenticación Basic ante el servicio MDM alternativo. |

Nunca expongas estas variables con el prefijo `NEXT_PUBLIC_` ni subas `.env` al repositorio.

## Comandos

| Comando | Uso |
| --- | --- |
| `pnpm dev` | Inicia el servidor de desarrollo. |
| `pnpm lint` | Ejecuta ESLint. |
| `pnpm typecheck` | Verifica TypeScript sin emitir archivos. |
| `pnpm build` | Genera la compilación de producción. |
| `pnpm start` | Inicia la aplicación compilada. |

## Docker

Construí y ejecutá la imagen de producción:

```bash
docker compose up --build
```

Para desarrollo en contenedor, con montaje del código fuente y recarga en caliente:

```bash
docker compose -f compose.yaml -f compose.dev.yaml up --build
```

El contenedor expone el puerto `3000` y utiliza una compilación standalone de Next.js. Desde Docker, la URL del backend se controla con `DOCKER_BACKEND_URL`.

## Arquitectura e integración

El backend que implementa este contrato está en `D:\dev\backend-leasing`.

- `src/app`: páginas, layouts y Route Handlers de Next.js.
- `src/features`: componentes y lógica por dominio (`auth`, `mdm` y `workspace`).
- `src/lib`: acceso del servidor al backend, sesión del personal y datos administrativos.
- `src/app/api`: BFF interno; conserva las cookies de sesión como cookies `httpOnly` y reenvía solicitudes autenticadas al backend.

El backend gestiona la autenticación, autorización, datos administrativos y operaciones MDM. El contrato específico de trabajos de mensajería está en [docs/mdm-message-jobs.md](docs/mdm-message-jobs.md).

## Verificación

Antes de integrar cambios, ejecutá:

```bash
pnpm lint
pnpm typecheck
pnpm build
```
