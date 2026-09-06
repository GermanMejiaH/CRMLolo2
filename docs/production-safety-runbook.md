# Manual de Seguridad y Operaciones en Producción (Runbook) - CRM LOLO

Este documento describe los procedimientos manuales estrictos para mantenimiento, respaldos, verificación de integridad, rotación de secretos, protección de archivos y despliegues en el entorno de producción de CRM LOLO.

---

## 1. Procedimiento Manual de Respaldo de Base de Datos y Proformas

### 1.1 Respaldo de Base de Datos SQLite (`data.db`)
El respaldo debe realizarse utilizando la herramienta CLI `sqlite3` o el script seguro de Node.js `npm run backup` para garantizar consistencia incluso durante escritura (WAL).

**Opción A: Mediante CLI de Node.js (Recomendado)**
```bash
cd backend
npm run backup
```
Esto generará un archivo con marca de tiempo en `STORAGE_DIR/backups/data-YYYY-MM-DD-HHmmss.db`.

**Opción B: Mediante herramienta `sqlite3` en servidor**
```bash
sqlite3 /var/lib/crm-lolo/storage/data.db ".backup '/var/lib/crm-lolo/storage/backups/manual-data-$(date +%Y%m%d%H%M%S).db'"
```

### 1.2 Respaldo de Almacenamiento de Proformas PDF
Copiar el directorio de archivos PDF a la ubicación de almacenamiento secundario:
```bash
tar -czvf /var/lib/crm-lolo/storage/backups/proformas-$(date +%Y%m%d).tar.gz /var/lib/crm-lolo/storage/proformas/
```

---

## 2. Verificación de Integridad de Copias de Seguridad

Antes de proceder con cualquier despliegue o mantenimiento, verificar el archivo de respaldo creado:

1. **Comprobar tamaño y firma SQLite:**
   ```bash
   ls -lh /var/lib/crm-lolo/storage/backups/
   ```
2. **Verificar integridad del archivo de base de datos:**
   ```bash
   sqlite3 /var/lib/crm-lolo/storage/backups/manual-data-XXXX.db "PRAGMA quick_check;"
   ```
   *El comando debe responder `ok`.*
3. **Verificar conteo de tablas críticas:**
   ```bash
   sqlite3 /var/lib/crm-lolo/storage/backups/manual-data-XXXX.db "SELECT count(*) FROM users; SELECT count(*) FROM clients; SELECT count(*) FROM products;"
   ```

---

## 3. Procedimiento de Despliegue Seguro

1. **Paso 1: Notificación y Ventana de Mantenimiento**
   Coordinar ventana de bajo tráfico.

2. **Paso 2: Generar Respaldo Manual Completo**
   Ejecutar las instrucciones de la sección 1 y validar integridad según la sección 2.

3. **Paso 3: Validar Variables de Entorno en Servidor de Producción**
   Asegurarse de que en el entorno de producción estén definidas:
   - `NODE_ENV=production`
   - `PORT=4000`
   - `JWT_SECRET` (cadena aleatoria de 32+ caracteres)
   - `CORS_ORIGIN` (dominio(s) del frontend autorizados)
   - `STORAGE_DIR` (ruta absoluta persistente)
   - `DB_PATH` (ruta absoluta al archivo `data.db` activo)

4. **Paso 4: Actualización de Código**
   Desplegar el código verificado y aprobado.
   ```bash
   git pull origin main
   cd backend && npm ci --production
   cd ../frontend && npm ci && npm run build
   ```

5. **Paso 5: Reinicio de Servicios**
   Reiniciar el proceso backend usando PM2 o el gestor de servicios correspondiente:
   ```bash
   pm2 reload crm-lolo-backend
   ```

6. **Paso 6: Verificación Post-Despliegue**
   - Verificar salud mediante endpoint HTTP.
   - Probar inicio de sesión con cuenta administradora.

---

## 4. Plan de Rollback ante Emergencias

Si se detecta alguna anomalía o fallo crítico en producción:

1. **Detener el servicio inmediatamente:**
   ```bash
   pm2 stop crm-lolo-backend
   ```
2. **Restaurar el código previo:**
   ```bash
   git checkout <tag_o_commit_anterior_estable>
   ```
3. **Restaurar la base de datos desde el último respaldo verificado:**
   ```bash
   cp /var/lib/crm-lolo/storage/backups/manual-data-XXXX.db /var/lib/crm-lolo/storage/data.db
   ```
4. **Reiniciar el servicio:**
   ```bash
   pm2 start crm-lolo-backend
   ```

---

## 5. Procedimiento Manual para Rotación de Secretos

### 5.1 Rotación de `JWT_SECRET`
> **Nota:** La rotación de `JWT_SECRET` invalidará los tokens JWT activos, requiriendo que los usuarios inicien sesión nuevamente.

1. Generar una nueva clave segura (por ejemplo, con `openssl rand -hex 32`).
2. Actualizar la variable `JWT_SECRET` en el archivo de entorno del servidor.
3. Reiniciar la aplicación backend.

### 5.2 Rotación de Contraseña de Administrador
1. Definir temporalmente en la variable de entorno `ADMIN_PASSWORD` la nueva contraseña deseada.
2. Iniciar el servicio. La aplicación actualizará automáticamente el hash de la cuenta administradora con `bcrypt`.
3. Retirar la variable `ADMIN_PASSWORD` del entorno y reiniciar el servicio para evitar reescrituras innecesarias.

---

## 6. Procedimiento para Remover Secretos del Historial Git (No ejecutar en desarrollo)

Si en el pasado se comprometieron secretos reales o archivos de base de datos en repositorios Git públicos/privados:

1. **Crear un clon espejo de respaldo separado:**
   ```bash
   git clone --mirror git@github.com:Organizacion/CRMLolo2.git repo-mirror-backup.git
   ```
2. **Utilizar `git-filter-repo` (Herramienta oficial recomendada):**
   ```bash
   pip install git-filter-repo
   # Eliminar base de datos o archivos con secretos del historial
   git filter-repo --invert-paths --path backend/storage/data.db --path backend/backend/storage/data.db
   ```
3. **Forzar push únicamente tras revisión minuciosa y aprobación del equipo:**
   ```bash
   git push origin --force --all
   ```

---

## 7. Protección y Restricción de Archivos PDF de Proformas

En producción, se recomienda restringir el acceso directo por URL estática a las proformas generadas:

1. **Acceso Autenticado en Express:**
   En lugar de servir `/static/proformas` con `express.static` abierto a todo el público, dirigir las descargas mediante una ruta protegida con middleware `auth`:
   ```javascript
   app.get('/proformas/download/:filename', auth, (req, res) => {
     const safeName = path.basename(req.params.filename);
     const filePath = path.join(config.proformaDir, safeName);
     if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'not_found' });
     res.sendFile(filePath);
   });
   ```
2. **Reglas de Servidor Web (Nginx / Cloudflare):**
   Asegurar que el directorio de almacenamiento directo no sea indexado ni accesible públicamente sin token de autorización.
