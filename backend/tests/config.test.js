import test from "node:test"
import assert from "node:assert/strict"
import path from "path"
import { resolveConfig } from "../src/config.js"

test("Configuración de desarrollo por defecto", () => {
  const cfg = resolveConfig({ NODE_ENV: "development" })
  assert.equal(cfg.nodeEnv, "development")
  assert.ok(cfg.dbPath.endsWith(path.join("storage", "data.db")))
  assert.ok(cfg.proformaDir.endsWith(path.join("storage", "proformas")))
  assert.ok(cfg.backupDir.endsWith(path.join("storage", "backups")))
})

test("Configuración solo con DB_PATH (STORAGE_DIR derivado de dirname)", () => {
  const customDb = path.resolve("/tmp/custom/location/data.db")
  const cfg = resolveConfig({ NODE_ENV: "development", DB_PATH: customDb })
  assert.equal(cfg.dbPath, customDb)
  assert.equal(cfg.storageRoot, path.resolve("/tmp/custom/location"))
  assert.equal(cfg.proformaDir, path.resolve("/tmp/custom/location/proformas"))
  assert.equal(cfg.backupDir, path.resolve("/tmp/custom/location/backups"))
})

test("Configuración con DB_PATH y STORAGE_DIR explícitos", () => {
  const customStorage = path.resolve("/var/storage")
  const customDb = path.resolve("/var/db/app.db")
  const cfg = resolveConfig({
    NODE_ENV: "development",
    STORAGE_DIR: customStorage,
    DB_PATH: customDb
  })
  assert.equal(cfg.storageRoot, customStorage)
  assert.equal(cfg.dbPath, customDb)
})

test("Configuración en producción con variables faltantes lanza error explícito", () => {
  assert.throws(
    () => {
      resolveConfig({ NODE_ENV: "production" })
    },
    (err) => {
      return (
        err instanceof Error &&
        err.message.includes("Configuración de producción incompleta") &&
        err.message.includes("JWT_SECRET") &&
        err.message.includes("CORS_ORIGIN") &&
        err.message.includes("DB_PATH") &&
        err.message.includes("STORAGE_DIR")
      )
    }
  )
})
