import test from "node:test"
import assert from "node:assert/strict"
import fs from "fs"
import path from "path"
import os from "os"
import crypto from "crypto"
import Database from "better-sqlite3"
import { runBackup } from "../src/backup.js"

function getFileHash(filePath) {
  const buffer = fs.readFileSync(filePath)
  return crypto.createHash("sha256").update(buffer).digest("hex")
}

test("Respaldo consistente sin alterar la base de datos origen", async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "crm-lolo-backup-test-"))
  const srcDbPath = path.join(tempDir, "origin.db")
  const dstDir = path.join(tempDir, "backups")

  t.after(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {}
  })

  // 1. Crear base de datos origen de prueba con datos
  const originDb = new Database(srcDbPath)
  originDb.exec("CREATE TABLE test_table (id INTEGER PRIMARY KEY, value TEXT);")
  originDb.exec("INSERT INTO test_table (value) VALUES ('data_1'), ('data_2');")
  // Force WAL checkpoint to ensure consistent snapshot comparison
  originDb.pragma("wal_checkpoint(TRUNCATE)")
  originDb.close()

  const originHashBefore = getFileHash(srcDbPath)

  // 2. Ejecutar backup seguro
  const backupFile = await runBackup({
    srcDbPath,
    dstDir,
    fileName: "backup-test.db",
    silent: true
  })

  // 3. Verificar que la base de datos origen NO haya sufrido modificaciones (tamaño e integridad intacta)
  const originHashAfter = getFileHash(srcDbPath)
  assert.equal(originHashAfter, originHashBefore)

  // 4. Verificar integridad y contenido del archivo de respaldo
  const backupDb = new Database(backupFile, { readonly: true })
  const quickCheck = backupDb.prepare("PRAGMA quick_check").get()
  assert.equal(quickCheck.quick_check, "ok")

  const rows = backupDb.prepare("SELECT * FROM test_table ORDER BY id").all()
  assert.equal(rows.length, 2)
  assert.equal(rows[0].value, "data_1")
  assert.equal(rows[1].value, "data_2")
  backupDb.close()
})
