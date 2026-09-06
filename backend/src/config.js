import path from "path"
import { fileURLToPath } from "url"
import dotenv from "dotenv"

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function resolveConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || "development"
  const isProduction = nodeEnv === "production"
  const isTest = nodeEnv === "test"

  const envDbPath = env.DB_PATH && String(env.DB_PATH).trim()
  const envStorageDir = env.STORAGE_DIR && String(env.STORAGE_DIR).trim()

  let dbPath = ""
  let storageRoot = ""

  if (envStorageDir) {
    storageRoot = path.resolve(envStorageDir)
    dbPath = envDbPath ? path.resolve(envDbPath) : path.join(storageRoot, "data.db")
  } else if (envDbPath) {
    dbPath = path.resolve(envDbPath)
    storageRoot = path.dirname(dbPath)
  } else {
    storageRoot = path.join(__dirname, "..", "storage")
    dbPath = path.join(storageRoot, "data.db")
  }

  const envProformaDir = env.PROFORMA_DIR && String(env.PROFORMA_DIR).trim()
  const proformaDir = envProformaDir ? path.resolve(envProformaDir) : path.join(storageRoot, "proformas")

  const envBackupDir = env.BACKUP_DIR && String(env.BACKUP_DIR).trim()
  const backupDir = envBackupDir ? path.resolve(envBackupDir) : path.join(storageRoot, "backups")

  const port = env.PORT || 4000
  const jwtSecret = env.JWT_SECRET
  const corsOrigin = env.CORS_ORIGIN ? String(env.CORS_ORIGIN).trim() : ""

  let trustProxy = false
  if (env.TRUST_PROXY !== undefined && env.TRUST_PROXY !== "") {
    const rawVal = String(env.TRUST_PROXY).trim().toLowerCase()
    if (rawVal === "true" || rawVal === "1") {
      trustProxy = true
    } else if (rawVal === "false" || rawVal === "0") {
      trustProxy = false
    } else if (!isNaN(Number(rawVal))) {
      trustProxy = Number(rawVal)
    } else {
      trustProxy = String(env.TRUST_PROXY).trim()
    }
  }

  if (isProduction) {
    const missing = []
    if (!jwtSecret) missing.push("JWT_SECRET")
    if (!corsOrigin) missing.push("CORS_ORIGIN")
    if (!envDbPath) missing.push("DB_PATH")
    if (!envStorageDir) missing.push("STORAGE_DIR")
    if (missing.length > 0) {
      throw new Error(
        `Configuración de producción incompleta. Faltan las variables obligatorias: ${missing.join(", ")}. DB_PATH y STORAGE_DIR deben apuntar a un volumen persistente.`
      )
    }
  }

  return {
    nodeEnv,
    isProduction,
    isTest,
    port: Number(port),
    jwtSecret: jwtSecret || "dev_jwt_secret_lolo_2026_fallback",
    corsOrigin,
    trustProxy,
    storageRoot,
    dbPath,
    proformaDir,
    backupDir,
    adminEmail: env.ADMIN_EMAIL || "admin@lolo",
    adminPassword: env.ADMIN_PASSWORD || null
  }
}

export const config = resolveConfig()
export default config
