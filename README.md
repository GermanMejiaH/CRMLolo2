# CRM LOLO

- Aplicación web para gestionar clientes, productos, pedidos y proformas.
- Stack: React + Tailwind (frontend), Node.js + Express (backend).

## Instalación

- Requisitos: Node 18+, npm.
- Backend:
  - `cd backend`
  - `cp .env.example .env`
  - Edita `JWT_SECRET` y SMTP si se usará correo.
  - `npm install`
  - `npm run dev`
- Frontend:
  - En otra terminal: `cd frontend`
  - `npm install`
  - `npm run dev`

## Desarrollo local

- Backend en `http://localhost:4000`.
- Frontend en `http://localhost:5173`.
- Login de prueba: email `admin@lolo`, contraseña `admin123`.

## Endpoints principales

- `POST /auth/login`
- `GET /clientes`, `POST /clientes`, `PUT /clientes/{id}`, `POST /clientes/{id}/desactivar`
- `GET /productos`, `POST /productos`, `POST /productos/{id}/ajustar`
- `GET /pedidos`, `GET /pedidos/{id}`, `POST /pedidos`, `PUT /pedidos/{id}`
- `POST /pedidos/{id}/proforma` devuelve `url` al PDF
- `GET /config/options`

## Funcionalidad incluida

- Gestión básica de clientes con validaciones de email y precio personalizado (COP 25.000–50.000).
- Gestión de productos con stock y historial de movimientos.
- Pedidos con cálculo de total, estados y auditoría.
- Generación de proformas en PDF y envío por correo si SMTP está configurado.
- Autenticación JWT y RBAC simple (Admin, Operador).

## Variables de entorno (backend)

- `PORT` puerto del servidor.
- `JWT_SECRET` secreto para JWT.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` para correo.

## Notas

- El almacenamiento es en memoria para desarrollo.
- Los PDFs se guardan en `backend/storage/proformas` y se sirven en `http://localhost:4000/static/proformas/...`.
