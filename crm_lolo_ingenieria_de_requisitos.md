# CRM LOLO — Ingeniería de Requisitos

> **Versión:** 1.0
> **Fecha:** 2025-12-01
> **Autor:** Equipo de desarrollo (entrega provisional)

---

## 1. Visión general

Construir una **aplicación web** para gestionar clientes, pedidos, proformas y stock para la microempresa LOLO (módulos de estacionarias para moto). El objetivo es reemplazar la solución basada en Google Sheets por una aplicación independiente, segura y escalable, con la misma funcionalidad actual y mejoras orientadas a usabilidad, trazabilidad y automatización.

### Objetivos principales
- Registrar y gestionar clientes con precios personalizados.
- Registrar pedidos, estados y métodos de pago.
- Generar proformas en PDF y enviarlas por correo.
- Controlar stock y alertas de stock bajo.
- Dashboard con KPIs y gráficos interactivos.
- Permitir roles: Admin / Operador / Consulta.

---

## 2. Actores

- **Administrador (Admin):** configura empresa, gestiona usuarios, revisa y exporta datos.
- **Operador / Vendedor:** registra clientes, pedidos, genera proformas, actualiza estados.
- **Contabilidad / Finanzas:** consulta ventas, exporta reportes y realiza conciliaciones.
- **Cliente (externo, opcional):** recibe proformas por correo; no accede a la app.

---

## 3. Requisitos funcionales (RF)

### RF-01: Gestión de Clientes
- RF-01.1: Crear cliente con campos: nombre/razón social, contacto, teléfono, email, dirección, precio personalizado (COP entre 25.000 y 50.000), notas.
- RF-01.2: Generar ID único auto-incremental.
- RF-01.3: Registrar fecha de alta (timestamp, inmutable).
- RF-01.4: Editar y desactivar clientes.
- RF-01.5: Búsqueda y filtros (por nombre, email, rango de precio).

### RF-02: Gestión de Productos
- RF-02.1: Registrar producto con nombre, descripción, precio mínimo, precio máximo, stock actual, stock mínimo, última actualización.
- RF-02.2: Ajustar stock manualmente y registrar historial de movimientos (entrada/salida, motivo, referencia, usuario, fecha).

### RF-03: Pedidos
- RF-03.1: Crear pedido con: ID pedido (auto-incremental), fecha (timestamp), cliente (referencia), cantidad, precio unitario (se sugiere precio personalizado si existe), total, estado (Pendiente, Completado, Cancelado), método de pago, notas.
- RF-03.2: Validaciones: cantidad > 0; si cantidad > stock → advertencia y bloqueo opcional según permiso.
- RF-03.3: Cambio de estado con registro de auditoría (usuario, fecha, observación).
- RF-03.4: Al marcar Completado → descontar stock (registrar movimiento) y enviar notificación interna.

### RF-04: Proformas / PDF
- RF-04.1: Generar proforma PDF a partir de pedido seleccionado (descargable y guardada en sistema).
- RF-04.2: Guardar registro de proforma (ID pedido, fecha, cliente, total, URL/archivo).
- RF-04.3: Enviar proforma por correo al email del cliente con asunto y cuerpo configurable.

### RF-05: Dashboard y Reportes
- RF-05.1: KPIs: Total ventas (periodo), Nº pedidos completados, Stock actual vs mínimo, Ticket promedio, Clientes nuevos por mes.
- RF-05.2: Gráficos: ventas mensuales, ventas diarias, top 10 clientes, métodos de pago (pie), estado de pedidos (donut), comparativo ventas vs pedidos.
- RF-05.3: Exportar reportes a CSV/PDF por periodo.

### RF-06: Configuración
- RF-06.1: Datos de la empresa (nombre, dirección, teléfono, email, RUC/NIT, IVA, plazo validez proforma, tiempo estimado de entrega).
- RF-06.2: Lista parametrizable de métodos de pago y estados.
- RF-06.3: Gestión de usuarios y roles.

### RF-07: Notificaciones y automatizaciones
- RF-07.1: Alerta por email cuando stock < stock mínimo (destinatario configurado).
- RF-07.2: Recordatorios automáticos (trigger diario) para pedidos pendientes > X días.

---

## 4. Requisitos no funcionales (RNF)

- RNF-01: Autenticación: login con email/contraseña; soporte Google Sign-In (opcional).
- RNF-02: Autorización: RBAC (roles: Admin, Operador, Contabilidad).
- RNF-03: Rendimiento: tiempos de respuesta < 300 ms para operaciones CRUD simples.
- RNF-04: Disponibilidad: 99% uptime (según hosting elegido).
- RNF-05: Seguridad: comunicaciones HTTPS, hashing de contraseñas (bcrypt/argon2), protección contra CSRF/SQL injection.
- RNF-06: Backup: exportación automática diaria de base de datos (dump) y copia de archivos esenciales.
- RNF-07: Internacionalización: soporte para moneda COP y formato de fechas DD/MM/YYYY.

---

## 5. Casos de uso / Historias de usuario (ejemplos)

### HU-01: Como operador, quiero registrar un cliente nuevo para poder venderle.
**Criterios de aceptación:** ID generado, fecha de registro estampada, validación email, precio entre límite.

### HU-02: Como operador, quiero crear un pedido para un cliente y generar la proforma en PDF.
**Criterios de aceptación:** total calculado, proforma generada y guardada, email enviado al cliente.

### HU-03: Como admin, quiero ver alertas de stock bajo para reabastecer.
**Criterios de aceptación:** alerta visible en dashboard y email al responsable.

### HU-04: Como contabilidad, quiero descargar el informe mensual de ventas en CSV.
**Criterios de aceptación:** archivo CSV con columnas: fecha, id_pedido, cliente, total, estado, método_pago.

---

## 6. Modelo de datos (resumen)

- **Cliente**(id_cliente PK, fecha_registro, nombre, contacto, telefono, email, direccion, precio_personalizado, notas, activo)
- **Producto**(id_producto PK, nombre, descripcion, precio_min, precio_max, stock_actual, stock_min, ultima_actualizacion)
- **Pedido**(id_pedido PK, fecha, id_cliente FK, cantidad, precio_unitario, total, estado, metodo_pago, notas, usuario_creador)
- **Proforma**(id_proforma PK, id_pedido FK, fecha_generacion, total, url_archivo, enviado_email BOOL)
- **MovimientoStock**(id, id_producto FK, tipo_{entrada|salida}, cantidad, referencia, motivo, fecha, usuario)
- **Usuario**(id_usuario, nombre, email, password_hash, rol, activo)
- **Configuracion**(clave, valor)

---

## 7. Endpoints API (propuesta REST)

> Base URL: `https://api.tu-dominio.com/v1`

### Autenticación
- `POST /auth/login` → {email,password} → token JWT
- `POST /auth/logout`

### Clientes
- `GET /clientes` (filtros: q, minPrice, maxPrice)
- `POST /clientes` → crear
- `GET /clientes/{id}`
- `PUT /clientes/{id}`
- `DELETE /clientes/{id}` (soft delete)

### Productos
- `GET /productos`
- `POST /productos`
- `PUT /productos/{id}`
- `PATCH /productos/{id}/stock` → {cantidad, tipo, referencia}

### Pedidos
- `GET /pedidos` (filtros por cliente, fecha, estado)
- `POST /pedidos` → crear
- `GET /pedidos/{id}`
- `PUT /pedidos/{id}` → actualizar (estado incluido)
- `POST /pedidos/{id}/proforma` → generar proforma (devuelve URL)

### Proformas
- `GET /proformas`
- `GET /proformas/{id}`

### Dashboard / Reportes
- `GET /reportes/ventas?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /reportes/top-clientes?limit=10`

---

## 8. Diseño de interfaz (pantallas principales)

- **Login**
- **Dashboard**: KPIs y gráficos (Ventas mensuales, Pedidos completados, Stock, Top clientes)
- **Clientes**: tabla, buscar, crear/editar, exportar
- **Productos**: detalle, ajustar stock, historial
- **Pedidos**: crear pedido (selector cliente), ver, cambiar estado, generar proforma
- **Proformas**: listado y visor de PDFs
- **Configuración**: datos empresa, lista métodos de pago, usuarios
- **Reportes**: export CSV/PDF, filtros por fecha

---

## 9. Reglas de negocio importantes

- Si un cliente tiene `precio_personalizado` > 0, usarlo como precio por defecto en la creación del pedido; si no, usar `producto.precio_min`.
- Un pedido no puede marcarse como Completado si no hay stock suficiente (salvo override por Admin).
- Proforma generada queda registrada inmutable (fecha, total, url).
- ID's auto-incrementales no deben cambiar (persistencia segura en BD).

---

## 10. Seguridad y privacidad

- Almacenar contraseñas con hash y salt (bcrypt/argon2).
- Enviar correos mediante servicio seguro (SendGrid / Mailgun / SMTP con TLS).
- Backup diario y permisos mínimos por rol.
- Logs de auditoría para cambios críticos (estado pedido, ajuste stock, creación usuario).

---

## 11. Pruebas y aceptación

- **Unit tests**: para lógica de cálculo de totales, ajustes de stock, generación de IDs.
- **Integration tests**: endpoints API / generación de PDF / envío de email.
- **E2E tests**: flujos principales (crear cliente → crear pedido → generar proforma → completar pedido).
- **Pruebas de carga**: 1000 pedidos concurrentes simulados (benchmark básico).

Criterios de aceptación final: todas las historias principales aprobadas por el cliente y sin errores bloqueantes.

---

## 12. Tecnología propuesta y stack sugerido

- Frontend: React (Next.js opcional) + Tailwind CSS
- Backend: Node.js + Express o NestJS
- Base de datos: PostgreSQL (Cloud SQL / ElephantSQL) o Firebase Firestore si se prefiere sin servidor
- Almacenamiento de archivos: Google Drive API o AWS S3
- Autenticación: JWT + OAuth (Google Sign-In)
- Infra / Hosting: Vercel (frontend) + Render/Heroku/GCP (backend) o Firebase Hosting + Cloud Functions

---

## 13. Plan mínimo de entrega (MVP) — estimación de trabajo

- Análisis y diseño: 2–3 días
- Backend básico (API + BD): 5–7 días
- Frontend CRUD básico (Clientes, Pedidos, Productos): 7–10 días
- PDF/Proformas + envío email: 2–3 días
- Dashboard y gráficos: 3–4 días
- Tests y ajustes: 3–4 días
- Despliegue y documentación: 2 días

**Total estimado MVP:** 22–33 días (dependiendo de disponibilidad y alcance fino).

---

## 14. Entregables

- Código fuente (repositorio Git).
- Infraestructura (scripts de despliegue / Dockerfile si aplica).
- Documentación técnica (.MD): arquitectura, API spec, modelo de datos.
- Manual de usuario (PDF).
- Copia del Google Sheet original (por referencia).

---

## 15. Próximos pasos propuestos

1. Aceptación del documento de requisitos por parte del cliente.
2. Priorización de historias (MVP vs backlog).
3. Preparar repositorio y entorno de desarrollo.
4. Implementación iterativa (sprints de 1 semana).

---

Gracias — si quieres que además te genere el archivo `README.md` del repositorio con instrucciones para desarrolladores (instalación, ejecución local, variables de entorno), lo preparo y lo añado al mismo documento o como archivo separado.


