import React, { useState } from "react"
import { FileSpreadsheet, RefreshCw, Calendar, BarChart3, DollarSign, TrendingUp, PieChart, AlertCircle } from "lucide-react"
import { useToast } from "../components/ToastContext"
import {
  downloadVentasCSV,
  getOptions,
  getReportKpis,
  getReportSeries,
  getPedidosFiltered,
  getClientes,
  getReporteRentabilidad
} from "../api/client"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts"
import * as XLSX from "xlsx"

export default function Reportes({ token }) {
  const { addToast } = useToast()
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [estado, setEstado] = useState("")
  const [metodoPago, setMetodoPago] = useState("")
  const [cliente, setCliente] = useState("")
  const [clientes, setClientes] = useState([])
  const [orderStates, setOrderStates] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingXlsx, setLoadingXlsx] = useState(false)
  const [kpis, setKpis] = useState({
    totalVentas: 0,
    pedidos: 0,
    completados: 0,
    ticketPromedio: 0,
    totalesPorMetodoPago: {}
  })
  const [loadingKpis, setLoadingKpis] = useState(false)
  const [series, setSeries] = useState([])
  const [loadingSeries, setLoadingSeries] = useState(false)
  const [granularity, setGranularity] = useState("day")
  const [delim, setDelim] = useState("semicolon")
  const initFromUrl = React.useRef(false)

  function setToday() {
    const d = new Date()
    const iso = d.toISOString().slice(0, 10)
    setFrom(iso)
    setTo(iso)
  }

  function setThisWeek() {
    const d = new Date()
    const day = d.getDay()
    const diffToMonday = (day + 6) % 7
    const start = new Date(d)
    start.setDate(d.getDate() - diffToMonday)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    const fromIso = start.toISOString().slice(0, 10)
    const toIso = end.toISOString().slice(0, 10)
    setFrom(fromIso)
    setTo(toIso)
  }

  function setThisMonth() {
    const d = new Date()
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    const fromIso = start.toISOString().slice(0, 10)
    const toIso = end.toISOString().slice(0, 10)
    setFrom(fromIso)
    setTo(toIso)
  }

  async function descargarCSV() {
    if (!token) return
    try {
      if (from && to && new Date(from) > new Date(to)) {
        addToast("Rango inválido", "warning")
        return
      }
      setLoading(true)
      const blob = await downloadVentasCSV(token, { from, to, estado, metodoPago, cliente, delim })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `ventas${from ? `_${from}` : ""}${to ? `_${to}` : ""}.csv`
      a.click()
      URL.revokeObjectURL(url)
      addToast("Reporte descargado correctamente", "success")
    } catch (error) {
      console.error(error)
      addToast("Error al descargar reporte", "error")
    } finally {
      setLoading(false)
    }
  }

  async function descargarXLSX() {
    if (!token) return
    try {
      if (from && to && new Date(from) > new Date(to)) {
        addToast("Rango inválido", "warning")
        return
      }
      setLoadingXlsx(true)
      const blob = await downloadVentasCSV(token, { from, to, estado, metodoPago, cliente, delim })
      const text = await blob.text()
      const lines = text
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .filter(Boolean)
      const sepLine = lines[0].startsWith("sep=") ? lines.shift() : ""
      const detectedDelim = sepLine.startsWith("sep=") ? sepLine.slice(4, 5) : delim === "semicolon" ? ";" : ","
      const rowsParsed = lines.map((line) => line.split(detectedDelim))
      const wb = XLSX.utils.book_new()
      const sheetDetalle = XLSX.utils.aoa_to_sheet(rowsParsed)
      const ref = sheetDetalle["!ref"]
      if (ref) {
        const rng = XLSX.utils.decode_range(ref)
        for (let r = 1; r <= rng.e.r; r++) {
          for (const c of [6, 7, 8]) {
            const addr = XLSX.utils.encode_cell({ c, r })
            const cell = sheetDetalle[addr]
            if (cell) {
              const num = Number(cell.v)
              sheetDetalle[addr] = { t: "n", v: isNaN(num) ? 0 : num, z: c === 6 ? "#,##0" : "[$COP] #,##0" }
            }
          }
        }
      }
      XLSX.utils.book_append_sheet(wb, sheetDetalle, "Detalle")
      const selClient = clientes.find((c) => c.id === Number(cliente))
      const kpiRows = [
        ["Filtro desde", from || ""],
        ["Filtro hasta", to || ""],
        ["Estado", estado || "Todos"],
        ["Método de pago", metodoPago || "Todos"],
        ["Cliente", selClient ? selClient.nombre : "Todos"],
        ["Total Ventas", kpis.totalVentas],
        ["Pedidos", kpis.pedidos],
        ["Completados", kpis.completados],
        ["Ticket Promedio", kpis.ticketPromedio]
      ]
      const sheetKpis = XLSX.utils.aoa_to_sheet(kpiRows)
      XLSX.utils.book_append_sheet(wb, sheetKpis, "KPIs")
      const out = XLSX.write(wb, { bookType: "xlsx", type: "array" })
      const url = URL.createObjectURL(
        new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      )
      const a = document.createElement("a")
      a.href = url
      a.download = `ventas${from ? `_${from}` : ""}${to ? `_${to}` : ""}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      addToast("XLSX generado", "success")
    } catch (e) {
      console.error(e)
      addToast("Error al generar XLSX", "error")
    } finally {
      setLoadingXlsx(false)
    }
  }

  async function loadOptions() {
    if (!token) return
    try {
      const [j, c] = await Promise.all([getOptions(token), getClientes(token)])
      setOrderStates(Array.isArray(j.orderStates) ? j.orderStates : [])
      setPayments(Array.isArray(j.payments) ? j.payments : [])
      setClientes(Array.isArray(c) ? c : c.items || [])
    } catch {}
  }

  async function loadKpis() {
    if (!token) return
    try {
      if (from && to && new Date(from) > new Date(to)) return
      setLoadingKpis(true)
      const j = await getReportKpis(token, { from, to, estado, metodoPago, cliente })
      setKpis(j)
    } catch {
    } finally {
      setLoadingKpis(false)
    }
  }

  async function loadSeries() {
    if (!token) return
    try {
      if (from && to && new Date(from) > new Date(to)) return
      setLoadingSeries(true)
      const orders = await getPedidosFiltered(token, { from, to, estado, metodoPago, cliente })
      const pm =
        Array.isArray(payments) && payments.length > 0
          ? payments
          : Array.from(
              new Set(
                (Array.isArray(orders) ? orders : []).map((o) => {
                  const m = o.metodoPago && String(o.metodoPago).trim() ? String(o.metodoPago).trim() : "Efectivo"
                  return m
                })
              )
            )
      const buckets = new Map()
      const excludeCancelado = !estado
      for (const o of Array.isArray(orders) ? orders : []) {
        if (excludeCancelado && o.estado === "Cancelado") continue
        const d = new Date(Number(o.createdAt))
        const bucket =
          granularity === "month"
            ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
            : d.toISOString().slice(0, 10)
        const metodo = o.metodoPago && String(o.metodoPago).trim() ? String(o.metodoPago).trim() : "Efectivo"
        const cur = buckets.get(bucket) || { bucket, total: 0 }
        cur.total = Number(cur.total || 0) + Number(o.total || 0)
        if (pm && pm.length > 0) {
          cur[metodo] = Number(cur[metodo] || 0) + Number(o.total || 0)
        }
        buckets.set(bucket, cur)
      }
      const normalized = Array.from(buckets.values()).sort((a, b) => a.bucket.localeCompare(b.bucket))
      if ((!payments || payments.length === 0) && pm.length > 0) {
        setPayments(pm)
      }
      setSeries(normalized)
    } catch {
    } finally {
      setLoadingSeries(false)
    }
  }

  React.useEffect(() => {
    loadOptions()
  }, [token])
  React.useEffect(() => {
    if (initFromUrl.current) return
    const qs = new URLSearchParams(window.location.search)
    const f = qs.get("from") || ""
    const t = qs.get("to") || ""
    const e = qs.get("estado") || ""
    const mp = qs.get("metodoPago") || ""
    const c = qs.get("cliente") || ""
    const g = qs.get("granularity") || "day"
    setFrom(f)
    setTo(t)
    setEstado(e)
    setMetodoPago(mp)
    setCliente(c)
    setGranularity(g === "month" ? "month" : "day")
    initFromUrl.current = true
  }, [])
  const [rentabilidad, setRentabilidad] = useState(null)
  const [loadingRentabilidad, setLoadingRentabilidad] = useState(false)

  async function loadRentabilidad() {
    if (!token) return
    setLoadingRentabilidad(true)
    try {
      const res = await getReporteRentabilidad(token, { from, to, clienteId: cliente })
      setRentabilidad(res)
    } catch {
      setRentabilidad(null)
    } finally {
      setLoadingRentabilidad(false)
    }
  }

  React.useEffect(() => {
    loadKpis()
    loadSeries()
    loadRentabilidad()
  }, [token, from, to, estado, metodoPago, cliente, granularity, payments])
  React.useEffect(() => {
    if (Number(kpis.totalVentas || 0) > 0 && (!series || series.length === 0)) {
      loadSeries()
    }
  }, [kpis, payments, granularity])
  React.useEffect(() => {
    const qs = new URLSearchParams()
    if (from) qs.set("from", from)
    if (to) qs.set("to", to)
    if (estado) qs.set("estado", estado)
    if (metodoPago) qs.set("metodoPago", metodoPago)
    if (cliente) qs.set("cliente", cliente)
    if (granularity && granularity !== "day") qs.set("granularity", granularity)
    const url = `${window.location.pathname}?${qs.toString()}`
    window.history.replaceState({}, "", url)
  }, [from, to, estado, metodoPago, cliente, granularity])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-cyan-400" />
            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
              Reportes
            </h1>
          </div>
          <button
            className="flex items-center gap-2 bg-slate-800/50 border border-cyan-500/30 rounded-lg px-4 py-2 text-gray-300"
            onClick={descargarCSV}
          >
            <RefreshCw className="w-5 h-5 text-cyan-400" />
            Descargar ventas CSV
          </button>
        </div>
        <p className="text-gray-400 ml-11">Exportación y análisis</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-800/50 backdrop-blur-sm border border-cyan-500/30 rounded-lg p-4 shadow-lg shadow-cyan-500/20">
          <p className="text-gray-400 text-sm">Formato disponible</p>
          <p className="text-3xl font-bold text-cyan-400">CSV</p>
        </div>
        <div className="bg-slate-800/50 backdrop-blur-sm border border-cyan-500/30 rounded-lg p-4 shadow-lg shadow-cyan-500/20">
          <p className="text-gray-400 text-sm">Reporte</p>
          <p className="text-3xl font-bold text-cyan-400">Ventas</p>
        </div>
      </div>

      <div className="bg-slate-800/50 backdrop-blur-sm border border-cyan-500/30 rounded-lg overflow-hidden shadow-xl shadow-cyan-500/20">
        <div className="p-6 text-gray-300">
          <p>
            Descarga el reporte de ventas en formato CSV para analizarlo en tu herramienta favorita. Puedes limitar por
            rango de fechas.
          </p>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-gray-300 text-sm mb-1 block">Desde</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full bg-slate-900/60 border border-cyan-500/30 rounded-lg px-3 py-2 text-gray-300"
              />
            </div>
            <div>
              <label className="text-gray-300 text-sm mb-1 block">Hasta</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full bg-slate-900/60 border border-cyan-500/30 rounded-lg px-3 py-2 text-gray-300"
              />
            </div>
            <div>
              <label className="text-gray-300 text-sm mb-1 block">Estado</label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                className="w-full bg-slate-900/60 border border-cyan-500/30 rounded-lg px-3 py-2 text-gray-300"
              >
                <option value="">Todos</option>
                {orderStates.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-gray-300 text-sm mb-1 block">Método de Pago</label>
              <select
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value)}
                className="w-full bg-slate-900/60 border border-cyan-500/30 rounded-lg px-3 py-2 text-gray-300"
              >
                <option value="">Todos</option>
                {payments.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-gray-300 text-sm mb-1 block">Cliente</label>
              <select
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                className="w-full bg-slate-900/60 border border-cyan-500/30 rounded-lg px-3 py-2 text-gray-300"
              >
                <option value="">Todos los clientes</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-gray-300 text-sm mb-1 block">Granularidad</label>
              <select
                value={granularity}
                onChange={(e) => setGranularity(e.target.value)}
                className="w-full bg-slate-900/60 border border-cyan-500/30 rounded-lg px-3 py-2 text-gray-300"
              >
                <option value="day">Día</option>
                <option value="month">Mes</option>
              </select>
            </div>
            <div>
              <label className="text-gray-300 text-sm mb-1 block">Separador</label>
              <select
                value={delim}
                onChange={(e) => setDelim(e.target.value)}
                className="w-full bg-slate-900/60 border border-cyan-500/30 rounded-lg px-3 py-2 text-gray-300"
              >
                <option value="semicolon">Punto y coma (;)</option>
                <option value="comma">Coma (,)</option>
              </select>
            </div>
            <div className="md:col-span-3 flex items-center gap-2">
              <button
                className="px-3 py-2 border border-cyan-500/30 rounded text-gray-300 bg-slate-900/60"
                onClick={setToday}
              >
                Hoy
              </button>
              <button
                className="px-3 py-2 border border-cyan-500/30 rounded text-gray-300 bg-slate-900/60"
                onClick={setThisWeek}
              >
                Esta semana
              </button>
              <button
                className="px-3 py-2 border border-cyan-500/30 rounded text-gray-300 bg-slate-900/60"
                onClick={setThisMonth}
              >
                Este mes
              </button>
              <button
                className="ml-auto px-3 py-2 border border-slate-600 rounded text-gray-300 bg-slate-900/60"
                onClick={() => {
                  setFrom("")
                  setTo("")
                  setEstado("")
                  setMetodoPago("")
                  setCliente("")
                }}
              >
                Limpiar
              </button>
            </div>
            <div className="md:col-span-2 flex items-center gap-2">
              <button
                disabled={!token || loading}
                className="flex items-center gap-2 bg-slate-900/60 border border-cyan-500/30 rounded-lg px-4 py-2 text-gray-300 hover:bg-slate-800/60 transition-all disabled:opacity-50"
                onClick={descargarCSV}
              >
                {loading ? (
                  <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
                ) : (
                  <FileSpreadsheet className="w-5 h-5 text-cyan-400" />
                )}
                Descargar CSV
              </button>
              <button
                disabled={!token || loadingXlsx}
                className="flex items-center gap-2 bg-slate-900/60 border border-purple-500/30 rounded-lg px-4 py-2 text-gray-300 hover:bg-slate-800/60 transition-all disabled:opacity-50"
                onClick={descargarXLSX}
              >
                {loadingXlsx ? (
                  <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
                ) : (
                  <FileSpreadsheet className="w-5 h-5 text-purple-400" />
                )}
                Descargar XLSX
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-6 bg-slate-800/50 backdrop-blur-sm border border-cyan-500/30 rounded-lg overflow-hidden shadow-xl shadow-cyan-500/20">
        <div className="p-4 flex items-center gap-2 text-cyan-400">
          <BarChart3 className="w-5 h-5" /> Serie de ventas por {granularity === "month" ? "mes" : "día"}
        </div>
        <div className="p-4">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="bucket" tick={{ fill: "#94a3b8" }} />
                <YAxis
                  tick={{ fill: "#94a3b8" }}
                  tickFormatter={(v) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`)}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid #06b6d4",
                    borderRadius: "8px",
                    color: "#e2e8f0"
                  }}
                  formatter={(value, name) => [
                    new Intl.NumberFormat("es-CO", {
                      style: "currency",
                      currency: "COP",
                      minimumFractionDigits: 0
                    }).format(value),
                    name
                  ]}
                  labelFormatter={(label) => `Fecha: ${label}`}
                />
                {payments && payments.length > 0 ? (
                  payments.map((p, idx) => (
                    <Bar
                      key={p}
                      dataKey={p}
                      name={p}
                      stackId="a"
                      fill={
                        p === "Efectivo"
                          ? "#06b6d4"
                          : p === "Transferencia"
                            ? "#a855f7"
                            : p === "Tarjeta"
                              ? "#10b981"
                              : idx === 0
                                ? "#06b6d4"
                                : "#eab308"
                      }
                    />
                  ))
                ) : (
                  <Bar dataKey="total" name="Total Ventas" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                )}
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-cyan-500/30 rounded-lg p-4">
          <p className="text-gray-400 text-sm">Total Ventas</p>
          <p className="text-2xl font-bold text-cyan-400">
            {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(
              kpis.totalVentas || 0
            )}
          </p>
        </div>
        <div className="bg-slate-800/50 border border-cyan-500/30 rounded-lg p-4">
          <p className="text-gray-400 text-sm">Pedidos</p>
          <p className="text-2xl font-bold text-cyan-400">{kpis.pedidos || 0}</p>
        </div>
        <div className="bg-slate-800/50 border border-cyan-500/30 rounded-lg p-4">
          <p className="text-gray-400 text-sm">Completados</p>
          <p className="text-2xl font-bold text-cyan-400">{kpis.completados || 0}</p>
        </div>
        <div className="bg-slate-800/50 border border-cyan-500/30 rounded-lg p-4">
          <p className="text-gray-400 text-sm">Ticket Promedio</p>
          <p className="text-2xl font-bold text-cyan-400">
            {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(
              kpis.ticketPromedio || 0
            )}
          </p>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {payments.map((p) => (
          <div key={p} className="bg-slate-800/50 border border-cyan-500/30 rounded-lg p-4">
            <p className="text-gray-400 text-sm">{p}</p>
            <p className="text-2xl font-bold text-cyan-400">
              {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(
                (kpis.totalesPorMetodoPago || {})[p] || 0
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Análisis de Rentabilidad Bruta Real (COGS vs Ventas) */}
      <div className="mt-8 bg-slate-800/50 backdrop-blur-sm border border-emerald-500/30 rounded-2xl p-6 shadow-xl shadow-emerald-500/10 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-700/60 pb-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              Análisis de Rentabilidad Real (Costo BOM / COGS)
            </h2>
          </div>
          <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full font-medium">
            Utilidad Bruta Calculada con Receta BOM
          </span>
        </div>

        {rentabilidad?.summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4">
              <p className="text-xs text-slate-400">Ventas Totales</p>
              <p className="text-2xl font-bold text-slate-100">
                ${Number(rentabilidad.summary.totalVentas).toLocaleString("es-CO")}
              </p>
            </div>
            <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4">
              <p className="text-xs text-slate-400">Costo Real de Insumos (COGS)</p>
              <p className="text-2xl font-bold text-amber-400">
                ${Number(rentabilidad.summary.totalCOGS).toLocaleString("es-CO")}
              </p>
            </div>
            <div className="bg-slate-900/60 border border-emerald-500/30 rounded-xl p-4">
              <p className="text-xs text-emerald-400 font-medium">Ganancia Bruta Real</p>
              <p className="text-2xl font-bold text-emerald-400">
                ${Number(rentabilidad.summary.gananciaBrutaTotal).toLocaleString("es-CO")}
              </p>
            </div>
            <div className="bg-slate-900/60 border border-cyan-500/30 rounded-xl p-4">
              <p className="text-xs text-cyan-400 font-medium">Margen Bruto Promedio</p>
              <p className="text-2xl font-bold text-cyan-400">
                {rentabilidad.summary.margenPromedioPercent}%
              </p>
            </div>
          </div>
        )}

        {/* Tablas de Desglose */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Rentabilidad por Producto */}
          <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm text-cyan-400 flex items-center gap-2">
              <PieChart className="w-4 h-4" /> Rentabilidad por Producto Terminado
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800 text-slate-400">
                  <tr>
                    <th className="p-2">Producto</th>
                    <th className="p-2">Unid.</th>
                    <th className="p-2">Venta Total</th>
                    <th className="p-2">Costo Insumos</th>
                    <th className="p-2 text-right">Ganancia ($)</th>
                    <th className="p-2 text-right">Margen (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {(rentabilidad?.porProducto || []).length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-3 text-center text-slate-500">Sin datos de ventas</td>
                    </tr>
                  ) : (
                    rentabilidad.porProducto.map((p) => (
                      <tr key={p.productoId} className="hover:bg-slate-800/40">
                        <td className="p-2 font-medium text-slate-200">{p.productoNombre}</td>
                        <td className="p-2 text-slate-300">{p.totalUnidades}</td>
                        <td className="p-2 text-slate-300">${p.totalVentas.toLocaleString("es-CO")}</td>
                        <td className="p-2 text-amber-400">${p.totalCOGS.toLocaleString("es-CO")}</td>
                        <td className="p-2 text-right font-bold text-emerald-400">${p.gananciaBruta.toLocaleString("es-CO")}</td>
                        <td className="p-2 text-right font-bold text-cyan-400">{p.margenPercent}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rentabilidad por Cliente */}
          <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm text-purple-400 flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Rentabilidad por Cliente
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800 text-slate-400">
                  <tr>
                    <th className="p-2">Cliente</th>
                    <th className="p-2">Ventas</th>
                    <th className="p-2">Costo Insumos</th>
                    <th className="p-2 text-right">Ganancia ($)</th>
                    <th className="p-2 text-right">Margen (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {(rentabilidad?.porCliente || []).length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-3 text-center text-slate-500">Sin datos de ventas</td>
                    </tr>
                  ) : (
                    rentabilidad.porCliente.map((c) => (
                      <tr key={c.clienteId} className="hover:bg-slate-800/40">
                        <td className="p-2 font-medium text-slate-200">{c.clienteNombre}</td>
                        <td className="p-2 text-slate-300">${c.totalVentas.toLocaleString("es-CO")}</td>
                        <td className="p-2 text-amber-400">${c.totalCOGS.toLocaleString("es-CO")}</td>
                        <td className="p-2 text-right font-bold text-emerald-400">${c.gananciaBruta.toLocaleString("es-CO")}</td>
                        <td className="p-2 text-right font-bold text-cyan-400">{c.margenPercent}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
