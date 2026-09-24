const BASE_URL = (() => {
  const env =
    typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE_URL
      ? String(import.meta.env.VITE_API_BASE_URL).trim()
      : ""
  if (env) return env.replace(/\/$/, "")
  if (typeof window !== "undefined") {
    const host = window.location.hostname || ""
    const proto = window.location.protocol || "http:"
    const isLocal =
      host === "localhost" || host === "127.0.0.1" || host.startsWith("192.168.") || host.endsWith(".local")
    if (isLocal) return `${proto}//${host}:4000`
  }
  return "http://localhost:4000"
})()

async function request(path, { method = "GET", token, body, headers = {} } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  })
  const isJson = res.headers.get("content-type")?.includes("application/json")
  const data = isJson ? await res.json() : await res.text()
  if (!res.ok) {
    if (res.status === 401) {
      try {
        localStorage.removeItem("token")
      } catch {}
      if (typeof window !== "undefined") {
        const loc = window.location
        if (loc.pathname !== "/login") {
          loc.assign("/login")
        }
      }
    }
    const message = typeof data === "string" ? data : data?.error || "error"
    throw new Error(message)
  }
  return data
}

export function getClientes(token) {
  return request("/clientes", { token })
}
export function login(email, password) {
  return request("/auth/login", { method: "POST", body: { email, password } })
}
export function getClientesPaged(token, params = {}) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== "") qs.set(k, String(v))
  })
  return request(`/clientes?${qs.toString()}`, { token })
}
export function getProductos(token) {
  return request("/productos", { token })
}
export function getProductosPaged(token, params = {}) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== "") qs.set(k, String(v))
  })
  return request(`/productos?${qs.toString()}`, { token })
}
export function createProducto(token, payload) {
  return request("/productos", { method: "POST", token, body: payload })
}
export function ajustarStockProducto(token, id, payload) {
  return request(`/productos/${id}/ajustar`, { method: "POST", token, body: payload })
}
export function updateProducto(token, id, payload) {
  return request(`/productos/${id}`, { method: "PUT", token, body: payload })
}
export function desactivarProducto(token, id) {
  return request(`/productos/${id}/desactivar`, { method: "POST", token })
}
export function deleteProducto(token, id) {
  return request(`/productos/${id}`, { method: "DELETE", token })
}
export function getPedidos(token) {
  return request("/pedidos", { token })
}
export function createPedido(token, payload) {
  return request("/pedidos", { method: "POST", token, body: payload })
}
export function deletePedido(token, id) {
  return request(`/pedidos/${id}`, { method: "DELETE", token })
}
export function updatePedido(token, id, payload) {
  return request(`/pedidos/${id}`, { method: "PUT", token, body: payload })
}
export function generateProforma(token, id) {
  return request(`/pedidos/${id}/proforma`, { method: "POST", token })
}
export function getProformas(token) {
  return request("/proformas", { token })
}
export const API_BASE_URL = BASE_URL
export function getOptions(token) {
  return request("/config/options", { token })
}
export function getReportKpis(token, params = {}) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== "") qs.set(k, String(v))
  })
  return request(`/reportes/kpis?${qs.toString()}`, { token })
}
export function createCliente(token, payload) {
  return request("/clientes", { method: "POST", token, body: payload })
}
export function updateCliente(token, id, payload) {
  return request(`/clientes/${id}`, { method: "PUT", token, body: payload })
}
export function desactivarCliente(token, id) {
  return request(`/clientes/${id}/desactivar`, { method: "POST", token })
}
export async function downloadVentasCSV(token, params = {}) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== "") qs.set(k, String(v))
  })
  const url = `${BASE_URL}/reportes/ventas.csv${qs.toString() ? `?${qs.toString()}` : ""}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error("Error al descargar")
  return res.blob()
}

export function getReportSeries(token, params = {}) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== "") qs.set(k, String(v))
  })
  return request(`/reportes/ventas-series?${qs.toString()}`, { token })
}

export function getPedidosFiltered(token, params = {}) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== "") qs.set(k, String(v))
  })
  return request(`/pedidos?${qs.toString()}`, { token })
}

export function getProductoMovimientos(token, id, params = {}) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== "") qs.set(k, String(v))
  })
  return request(`/productos/${id}/movimientos?${qs.toString()}`, { token })
}

export function getPedidoAudit(token, id, params = {}) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== "") qs.set(k, String(v))
  })
  return request(`/pedidos/${id}/audit?${qs.toString()}`, { token })
}

export function getDashboard(token) {
  return request(`/dashboard`, { token })
}

export function getClientPrices(token, clientId) {
  return request(`/clientes/${clientId}/precios`, { token })
}

export function setClientProductPrice(token, clientId, productId, price) {
  return request(`/clientes/${clientId}/precios/${productId}`, {
    method: "PUT",
    token,
    body: { price }
  })
}

export function deleteClientProductPrice(token, clientId, productId) {
  return request(`/clientes/${clientId}/precios/${productId}`, {
    method: "DELETE",
    token
  })
}

export function getAbonos(token, orderId) {
  return request(`/pedidos/${orderId}/abonos`, { token })
}

export function crearAbono(token, orderId, payload) {
  return request(`/pedidos/${orderId}/abonos`, {
    method: "POST",
    token,
    body: payload
  })
}

export function getClienteResumen360(token, clienteId) {
  return request(`/clientes/${clienteId}/resumen-360`, { token })
}

export function getBom(token, productoId) {
  return request(`/bom/${productoId}`, { token })
}

export function setBom(token, productoId, items) {
  return request(`/bom/${productoId}`, {
    method: "POST",
    token,
    body: { items }
  })
}

export function verificarEnsamblado(token, productoTerminadoId, cantidadProducida) {
  const payload =
    typeof productoTerminadoId === "object"
      ? productoTerminadoId
      : { productoTerminadoId: Number(productoTerminadoId), cantidadProducida: Number(cantidadProducida) }
  return request("/produccion/verificar", {
    method: "POST",
    token,
    body: payload
  })
}

export function ejecutarEnsamblado(token, productoTerminadoId, cantidadProducida, notas) {
  const payload =
    typeof productoTerminadoId === "object"
      ? productoTerminadoId
      : { productoTerminadoId: Number(productoTerminadoId), cantidadProducida: Number(cantidadProducida), notas }
  return request("/produccion/ensamblar", {
    method: "POST",
    token,
    body: payload
  })
}

export function getHistorialProduccion(token) {
  return request("/produccion/historial", { token })
}

export function getCapacidadTeorica(token, productoTerminadoId) {
  return request(`/produccion/capacidad-teorica/${productoTerminadoId}`, { token })
}

export function createCompra(token, payload) {
  return request("/compras", { method: "POST", token, body: payload })
}

export function getCompras(token, params = {}) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== "") qs.set(k, String(v))
  })
  return request(`/compras${qs.toString() ? `?${qs.toString()}` : ""}`, { token })
}

export function getCompra(token, id) {
  return request(`/compras/${id}`, { token })
}

export function getKardex(token, productoId = null, params = {}) {
  const qs = new URLSearchParams()
  if (productoId) qs.set("productoId", String(productoId))
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== "") qs.set(k, String(v))
  })
  const pathStr = productoId ? `/kardex/${productoId}` : "/kardex"
  return request(`${pathStr}${qs.toString() ? `?${qs.toString()}` : ""}`, { token })
}

export function getReporteRentabilidad(token, params = {}) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== "") qs.set(k, String(v))
  })
  return request(`/reportes/rentabilidad${qs.toString() ? `?${qs.toString()}` : ""}`, { token })
}

export function getAlertasStock(token) {
  return request("/alertas/stock", { token })
}


