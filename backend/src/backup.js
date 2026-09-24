import fs from "fs"
import path from "path"
import Database from "better-sqlite3"
import { config } from "./config.js"
import { logActivity, logError } from "./utils/logger.js"

export function pruneOldBackups(dstDir = config.backupDir, maxKeep = 30) {
  if (!fs.existsSync(dstDir)) return []
  const files = fs
    .readdirSync(dstDir)
    .filter((f) => f.endsWith(".db"))
    .map((f) => {
      const fullPath = path.join(dstDir, f)
      const stat = fs.statSync(fullPath)
      return { file: f, path: fullPath, mtime: stat.mtimeMs }
    })
    .sort((a, b) => b.mtime - a.mtime)

  const deleted = []
  if (files.length > maxKeep) {
    const toDelete = files.slice(maxKeep)
    for (const item of toDelete) {
      try {
        fs.unlinkSync(item.path)
        deleted.push(item.file)
      } catch (err) {
        logError("BACKUP_PRUNE_ERROR", err)
      }
    }
  }
  return deleted
}

async function runBackup(options = {}) {
  const srcDbPath = options.srcDbPath || config.dbPath
  const dstDir = options.dstDir || config.backupDir
  const maxKeep = options.maxKeep || 30

  if (!fs.existsSync(srcDbPath)) {
    throw new Error(`Base de datos origen no encontrada en: ${srcDbPath}`)
  }

  fs.mkdirSync(dstDir, { recursive: true })

  const d = new Date()
  const pad = (n) => String(n).padStart(2, "0")
  const dateStamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const timeStamp = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  const fileName = options.fileName || `data-${dateStamp}-${timeStamp}.db`
  const dstPath = path.join(dstDir, fileName)

  if (!options.silent) {
    console.log(`Iniciando respaldo seguro de SQLite desde '${srcDbPath}' hacia '${dstPath}'...`)
  }

  // Open source DB explicitly in readonly mode, without executing any CREATE TABLE, seeds, or migrations
  let srcDb = null
  try {
    srcDb = new Database(srcDbPath, { readonly: true, fileMustExist: true })

    if (typeof srcDb.backup !== "function") {
      throw new Error("API de respaldo consistente de better-sqlite3 no disponible.")
    }

    await srcDb.backup(dstPath)
  } finally {
    if (srcDb) {
      try {
        srcDb.close()
      } catch {}
    }
  }

  if (!fs.existsSync(dstPath)) {
    throw new Error(`El archivo de respaldo no fue generado en: ${dstPath}`)
  }

  const stat = fs.statSync(dstPath)
  if (stat.size === 0) {
    throw new Error(`El respaldo generado está vacío: ${dstPath}`)
  }

  // Verify backup DB integrity
  let dstDb = null
  try {
    dstDb = new Database(dstPath, { readonly: true, fileMustExist: true })
    const check = dstDb.prepare("PRAGMA quick_check").get()
    if (!check || check.quick_check !== "ok") {
      throw new Error(`Integridad de respaldo fallida: PRAGMA quick_check no devolvió ok (${JSON.stringify(check)})`)
    }
  } finally {
    if (dstDb) {
      try {
        dstDb.close()
      } catch {}
    }
  }

  // Prune old backups keeping only the last maxKeep (default 30)
  const deletedOld = pruneOldBackups(dstDir, maxKeep)
  logActivity("RESPALDO_CREADO", { dstPath, size: stat.size, deletedOldBackups: deletedOld })

  if (!options.silent) {
    console.log(`Respaldo verificado exitosamente: ${dstPath} (${stat.size} bytes)`)
  }

  return dstPath
}

if (process.argv[1] && process.argv[1].endsWith("backup.js")) {
  runBackup().catch((err) => {
    console.error("Error durante el respaldo:", err.message)
    process.exit(1)
  })
}

export { runBackup }

