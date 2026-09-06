import test from "node:test"
import assert from "node:assert/strict"
import fs from "fs"
import path from "path"
import os from "os"

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "crm-lolo-api-test-"))
const tempDbPath = path.join(tempDir, "test-api.db")

process.env.NODE_ENV = "test"
process.env.DB_PATH = tempDbPath
process.env.STORAGE_DIR = tempDir
process.env.JWT_SECRET = "secret_testing_key_12345"

test("Pruebas de integración API Express con base temporal aislada", async (t) => {
  const { app } = await import("../src/server.js")
  const store = await import("../src/store.js")
  const db = (await import("../src/db.js")).default

  let server = null
  let baseUrl = ""

  t.before(() => {
    return new Promise((resolve) => {
      server = app.listen(0, () => {
        const address = server.address()
        baseUrl = `http://127.0.0.1:${address.port}`
        resolve()
      })
    })
  })

  t.after(() => {
    return new Promise((resolve) => {
      server.close(() => {
        try {
          db.close()
          fs.rmSync(tempDir, { recursive: true, force: true })
        } catch {}
        resolve()
      })
    })
  })

  let authToken = ""

  await t.test("Cabeceras de seguridad HTTP presentes", async () => {
    const res = await fetch(`${baseUrl}/clientes`)
    assert.equal(res.headers.get("x-content-type-options"), "nosniff")
    assert.equal(res.headers.get("x-frame-options"), "DENY")
  })

  await t.test("Autenticación y migración atómica de contraseña legacy a bcrypt", async () => {
    // Check initial seed user has legacy hash plain:admin123
    const userBefore = store.users.findByEmail("admin@lolo")
    assert.ok(userBefore.passwordHash.startsWith("plain:"))

    // Perform login with plain password
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@lolo", password: "admin123" })
    })

    assert.equal(res.status, 200)
    const json = await res.json()
    assert.ok(json.token)
    authToken = json.token

    // Verify user in DB has now been upgraded to bcrypt hash ($2a$ or $2b$)
    const userAfter = store.users.findByEmail("admin@lolo")
    assert.ok(userAfter.passwordHash.startsWith("$2a$") || userAfter.passwordHash.startsWith("$2b$"))

    // Login again with upgraded bcrypt password
    const res2 = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@lolo", password: "admin123" })
    })

    assert.equal(res2.status, 200)
    const json2 = await res2.json()
    assert.ok(json2.token)
  })

  await t.test("Migración CAS (Compare-And-Swap) de contraseñas legacy", async () => {
    db.prepare(
      "INSERT INTO users (email, passwordHash, role, name) VALUES ('cas@test', 'plain:secret123', 'Operador', 'CAS Test')"
    ).run()

    // CAS actualiza con éxito si el hash coincide con la versión legacy
    const updated = store.updateLegacyUserPassword(
      "cas@test",
      "plain:secret123",
      "$2b$10$fakehash123456789012345678901234567890"
    )
    assert.equal(updated, true)

    // Intentar CAS nuevamente con el hash antiguo desactualizado falla
    const updatedAgain = store.updateLegacyUserPassword("cas@test", "plain:secret123", "$2b$10$anotherfakehash")
    assert.equal(updatedAgain, false)
  })

  await t.test(
    "Rate Limiting de inicio de sesión: cuenta únicamente intentos fallidos y logins correctos no bloquean",
    async () => {
      // 1. Múltiples logins válidos consecutivos NO deben ser bloqueados
      for (let i = 0; i < 6; i++) {
        const res = await fetch(`${baseUrl}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-test-rate-limit": "true" },
          body: JSON.stringify({ email: "admin@lolo", password: "admin123" })
        })
        assert.equal(res.status, 200)
      }

      // 2. Intentos fallidos repetidos incrementan contador hasta umbral de bloqueo
      for (let i = 0; i < 5; i++) {
        const res = await fetch(`${baseUrl}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-test-rate-limit": "true" },
          body: JSON.stringify({ email: "admin@lolo", password: "wrong_password" })
        })
        assert.equal(res.status, 401)
      }

      // Intento posterior queda bloqueado con 429
      const blockedRes = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-test-rate-limit": "true" },
        body: JSON.stringify({ email: "admin@lolo", password: "wrong_password" })
      })
      assert.equal(blockedRes.status, 429)
    }
  )

  await t.test("Crear cliente mediante API", async () => {
    const res = await fetch(`${baseUrl}/clientes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        nombre: "Cliente API Test",
        email: "api@test.com",
        telefono: "555-1234"
      })
    })

    assert.equal(res.status, 201)
    const client = await res.json()
    assert.equal(client.nombre, "Cliente API Test")
  })

  await t.test("Crear producto mediante API", async () => {
    const res = await fetch(`${baseUrl}/productos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        nombre: "Producto API Test",
        precioMinimo: 100,
        precioMaximo: 200,
        stockActual: 50,
        stockMinimo: 5
      })
    })

    assert.equal(res.status, 201)
    const prod = await res.json()
    assert.equal(prod.nombre, "Producto API Test")
  })

  await t.test("Obtener reportes y exportar CSV", async () => {
    const res = await fetch(`${baseUrl}/reportes/kpis`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    assert.equal(res.status, 200)
    const kpis = await res.json()
    assert.equal(typeof kpis.totalVentas, "number")

    const csvRes = await fetch(`${baseUrl}/reportes/ventas.csv`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    assert.equal(csvRes.status, 200)
    assert.ok(csvRes.headers.get("content-type").includes("text/csv"))
  })

  await t.test("Generar proforma PDF mediante API", async () => {
    // Crear pedido de prueba
    const orderRes = await fetch(`${baseUrl}/pedidos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        clienteId: 1,
        productoId: 1,
        cantidad: 2,
        precioUnitario: 42000,
        metodoPago: "Efectivo"
      })
    })
    assert.equal(orderRes.status, 201)
    const order = await orderRes.json()

    // Generar proforma PDF
    const profRes = await fetch(`${baseUrl}/pedidos/${order.id}/proforma`, {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}` }
    })
    assert.equal(profRes.status, 200)
    const prof = await profRes.json()
    assert.ok(prof.url.includes("/static/proformas/"))
    assert.ok(typeof prof.proformaId === "number")
  })

  await t.test("Validación de entradas con Zod en clientes, productos y pedidos", async () => {
    // 1. Cliente con email inválido
    const badClientRes = await fetch(`${baseUrl}/clientes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ nombre: "Cliente Bad", email: "not-an-email" })
    })
    assert.equal(badClientRes.status, 400)
    const badClientJson = await badClientRes.json()
    assert.equal(badClientJson.error, "validation_error")

    // 2. Producto con precio mínimo mayor al máximo
    const badProductRes = await fetch(`${baseUrl}/productos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ nombre: "Producto Bad", precioMinimo: 500, precioMaximo: 100 })
    })
    assert.equal(badProductRes.status, 400)
    const badProductJson = await badProductRes.json()
    assert.equal(badProductJson.error, "validation_error")

    // 3. Pedido sin ítems ni campos legacy
    const badOrderRes = await fetch(`${baseUrl}/pedidos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ clienteId: 1 })
    })
    assert.equal(badOrderRes.status, 400)
    const badOrderJson = await badOrderRes.json()
    assert.equal(badOrderJson.error, "validation_error")
  })

  await t.test("Creación de pedidos multiproducto y generación de proforma PDF", async () => {
    const multiOrderRes = await fetch(`${baseUrl}/pedidos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        clienteId: 1,
        metodoPago: "Transferencia",
        items: [
          { productoId: 1, cantidad: 2, precioUnitario: 30000 },
          { productoId: 2, cantidad: 1, precioUnitario: 40000 }
        ],
        notas: "Pedido multiproducto de prueba"
      })
    })

    assert.equal(multiOrderRes.status, 201)
    const multiOrder = await multiOrderRes.json()
    assert.equal(multiOrder.total, 100000)
    assert.equal(multiOrder.items.length, 2)
    assert.equal(multiOrder.items[0].subtotal, 60000)
    assert.equal(multiOrder.items[1].subtotal, 40000)

    // Proforma en PDF para pedido multiproducto
    const profRes = await fetch(`${baseUrl}/pedidos/${multiOrder.id}/proforma`, {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}` }
    })
    assert.equal(profRes.status, 200)
    const prof = await profRes.json()
    assert.ok(prof.url.includes("/static/proformas/"))
  })

  await t.test("Gestión de precios personalizados por cliente por producto (API)", async () => {
    // 1. Asignar precio personalizado a producto 2 para cliente 1
    const putRes = await fetch(`${baseUrl}/clientes/1/precios/2`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ price: 33000 })
    })
    assert.equal(putRes.status, 200)
    const putJson = await putRes.json()
    assert.equal(putJson.price, 33000)

    // 2. Obtener precios personalizados del cliente 1
    const getRes = await fetch(`${baseUrl}/clientes/1/precios`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    assert.equal(getRes.status, 200)
    const prices = await getRes.json()
    assert.ok(Array.isArray(prices))
    const itemPrice = prices.find((p) => p.productId === 2)
    assert.ok(itemPrice)
    assert.equal(itemPrice.price, 33000)

    // 3. Eliminar precio personalizado
    const delRes = await fetch(`${baseUrl}/clientes/1/precios/2`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${authToken}` }
    })
    assert.equal(delRes.status, 200)
  })

  await t.test("Validación de stock insuficiente al crear pedido (rechazo HTTP 400)", async () => {
    const overflowRes = await fetch(`${baseUrl}/pedidos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        clienteId: 1,
        productoId: 2,
        cantidad: 999999,
        metodoPago: "Efectivo"
      })
    })
    assert.equal(overflowRes.status, 400)
    const json = await overflowRes.json()
    assert.equal(json.error, "stock")
  })
})
