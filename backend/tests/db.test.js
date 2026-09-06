import test from "node:test"
import assert from "node:assert/strict"
import fs from "fs"
import path from "path"
import os from "os"

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "crm-lolo-db-test-"))
const tempDbPath = path.join(tempDir, "test-data.db")

process.env.NODE_ENV = "test"
process.env.DB_PATH = tempDbPath
process.env.STORAGE_DIR = tempDir

test("Operaciones de base de datos aislada", async (t) => {
  const store = await import("../src/store.js")
  const db = (await import("../src/db.js")).default

  t.after(() => {
    try {
      db.close()
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {}
  })

  await t.test("Garantizar que no se use la base real", () => {
    assert.equal(process.env.DB_PATH, tempDbPath)
    assert.ok(fs.existsSync(tempDbPath))
  })

  await t.test("Crear y consultar clientes", () => {
    const newClient = store.addClient({
      nombre: "Cliente Prueba DB",
      contacto: "Ana Maria",
      telefono: "1234567",
      email: "ana@prueba.com",
      direccion: "Calle Test 123",
      precioPersonalizado: 50000,
      notas: "Nota test"
    })
    assert.ok(newClient.id > 0)
    assert.equal(newClient.nombre, "Cliente Prueba DB")

    const list = store.listClients({ q: "Prueba" })
    assert.ok(list.length >= 1)
    assert.equal(list[0].id, newClient.id)
  })

  await t.test("Crear y consultar productos y ajustar stock", () => {
    const prod = store.addProduct({
      nombre: "Filtro Aceite T1",
      descripcion: "Filtro de alta calidad",
      precioMinimo: 15000,
      precioMaximo: 25000,
      stockActual: 20,
      stockMinimo: 5
    })
    assert.ok(prod.id > 0)

    const updated = store.adjustStock(prod.id, -5, "Venta test", "REF-001", 1)
    assert.equal(updated.stockActual, 15)

    const movements = store.listStockMovements(prod.id)
    assert.equal(movements.length, 1)
    assert.equal(movements[0].diff, -5)
  })

  await t.test("Precios personalizados por cliente", () => {
    const client = store.addClient({ nombre: "Cliente Precio Custom" })
    const prod = store.addProduct({
      nombre: "Producto Custom",
      precioMinimo: 10000,
      precioMaximo: 20000,
      stockActual: 10,
      stockMinimo: 2
    })

    store.setClientProductPrice(client.id, prod.id, 12500)
    const custom = store.getClientProductPrice(client.id, prod.id)
    assert.ok(custom)
    assert.equal(custom.price, 12500)
  })
})
