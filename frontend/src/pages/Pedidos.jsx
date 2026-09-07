import React, { useEffect, useState, useMemo } from "react"
import {
  ShoppingCart,
  Search,
  Plus,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  FileText,
  X,
  Trash2,
  DollarSign,
  MessageCircle,
  CreditCard
} from "lucide-react"
import { useToast } from "../components/ToastContext"
import Modal from "../components/Modal"
import {
  getClientes,
  getProductos,
  getPedidosFiltered,
  createPedido,
  updatePedido,
  deletePedido,
  generateProforma,
  getPedidoAudit,
  getOptions,
  getClientPrices,
  getAbonos,
  crearAbono
} from "../api/client"

export default function Pedidos({ token }) {
  const { addToast } = useToast()
  const [showForm, setShowForm] = useState(false)
  const [pedidos, setPedidos] = useState([])
  const [clientes, setClientes] = useState([])
  const [productos, setProductos] = useState([])
  const [nuevo, setNuevo] = useState({
    clienteId: "",
    metodoPago: "",
    notas: "",
    items: [{ productoId: "", cantidad: 1, precioUnitario: "" }]
  })
  const [clientPrices, setClientPrices] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [estado, setEstado] = useState("")
  const [metodoPago, setMetodoPago] = useState("")
  const [orderStates, setOrderStates] = useState([])
  const [payments, setPayments] = useState([])
  const initFromUrl = React.useRef(false)
  const [showAudit, setShowAudit] = useState(false)
  const [auditItems, setAuditItems] = useState([])
  const [auditOrder, setAuditOrder] = useState(null)
  const [auditPage, setAuditPage] = useState(1)
  const [auditLimit, setAuditLimit] = useState(10)
  const [auditTotal, setAuditTotal] = useState(0)
  const [editOrder, setEditOrder] = useState(null)
  const [editMetodoPago, setEditMetodoPago] = useState("")
  const [editCantidad, setEditCantidad] = useState("")

  // Abonos state
  const [showAbonos, setShowAbonos] = useState(false)
  const [abonosOrder, setAbonosOrder] = useState(null)
  const [abonosItems, setAbonosItems] = useState([])
  const [abonosSummary, setAbonosSummary] = useState({
    total: 0,
    totalPagado: 0,
    saldoPendiente: 0,
    estadoPago: "Pendiente"
  })
  const [newAbono, setNewAbono] = useState({ monto: "", metodoPago: "Efectivo", nota: "" })
  const [loadingAbonos, setLoadingAbonos] = useState(false)

  async function openAbonos(order) {
    setAbonosOrder(order)
    setShowAbonos(true)
    setNewAbono({ monto: "", metodoPago: "Efectivo", nota: "" })
    await loadAbonos(order.id)
  }

  async function loadAbonos(id) {
    try {
      setLoadingAbonos(true)
      const data = await getAbonos(token, id)
      setAbonosItems(data.items || [])
      setAbonosSummary({
        total: Number(data.total || 0),
        totalPagado: Number(data.totalPagado || 0),
        saldoPendiente: Number(data.saldoPendiente || 0),
        estadoPago: data.estadoPago || "Pendiente"
      })
    } catch {
      addToast("Error al cargar abonos", "error")
    } finally {
      setLoadingAbonos(false)
    }
  }

  async function handleCrearAbono() {
    if (!newAbono.monto || Number(newAbono.monto) <= 0) {
      addToast("Ingresa un monto válido mayor a 0", "warning")
      return
    }
    try {
      await crearAbono(token, abonosOrder.id, {
        monto: Number(newAbono.monto),
        metodoPago: newAbono.metodoPago,
        nota: newAbono.nota
      })
      addToast("Abono registrado con éxito", "success")
      setNewAbono({ monto: "", metodoPago: "Efectivo", nota: "" })
      await loadAbonos(abonosOrder.id)
      load()
    } catch {
      addToast("Error al registrar abono", "error")
    }
  }

  function openWhatsApp(order) {
    const cliente = clientes.find((c) => c.id === order.clienteId)
    if (!cliente || !cliente.telefono) {
      addToast("El cliente no tiene un número de teléfono registrado", "warning")
      return
    }
    const phoneClean = cliente.telefono.replace(/[^0-9]/g, "")
    if (!phoneClean) {
      addToast("Número de teléfono inválido para WhatsApp", "warning")
      return
    }
    const tot = Number(order.total || 0)
    const pag = Number(order.totalPagado || 0)
    const sal = Math.max(0, tot - pag)
    const msg = `Hola ${cliente.nombre}! Te compartimos el resumen de tu pedido #${order.id} en LOLO:\n- Total: $${tot.toLocaleString("es-CO")} COP\n- Abonado: $${pag.toLocaleString("es-CO")} COP\n- Saldo Pendiente: $${sal.toLocaleString("es-CO")} COP\n\n¡Gracias por tu compra!`
    const url = `https://wa.me/${phoneClean}?text=${encodeURIComponent(msg)}`
    window.open(url, "_blank")
  }

  // Load client prices when client is selected
  useEffect(() => {
    if (token && nuevo.clienteId) {
      getClientPrices(token, Number(nuevo.clienteId))
        .then(setClientPrices)
        .catch(() => setClientPrices([]))
    } else {
      setClientPrices([])
    }
  }, [token, nuevo.clienteId])

  function getItemRecommendedPrice(clienteId, productoId) {
    if (!clienteId || !productoId) return null
    const product = productos.find((p) => p.id === Number(productoId))
    const client = clientes.find((c) => c.id === Number(clienteId))
    if (!product) return null

    const customPrice = clientPrices.find((p) => p.productId === Number(productoId))
    if (customPrice) return customPrice.price

    if (client && client.precioPersonalizado != null) return client.precioPersonalizado

    return product.precioMinimo
  }

  const totalPrice = useMemo(() => {
    return nuevo.items.reduce((sum, item) => {
      const cant = Number(item.cantidad) || 0
      const rec = getItemRecommendedPrice(nuevo.clienteId, item.productoId)
      const unit = item.precioUnitario !== "" && item.precioUnitario != null ? Number(item.precioUnitario) : rec || 0
      return sum + cant * unit
    }, 0)
  }, [nuevo.items, nuevo.clienteId, clientPrices, productos, clientes])

  function handleItemChange(index, field, value) {
    setNuevo((prev) => {
      const updated = [...prev.items]
      updated[index] = { ...updated[index], [field]: value }
      return { ...prev, items: updated }
    })
  }

  function addItemRow() {
    setNuevo((prev) => ({
      ...prev,
      items: [...prev.items, { productoId: "", cantidad: 1, precioUnitario: "" }]
    }))
  }

  function removeItemRow(index) {
    setNuevo((prev) => {
      if (prev.items.length <= 1) return prev
      return { ...prev, items: prev.items.filter((_, i) => i !== index) }
    })
  }

  async function load() {
    if (!token) return
    try {
      const [c, p, o, opts] = await Promise.all([
        getClientes(token),
        getProductos(token, { tipo: "producto_terminado" }),
        getPedidosFiltered(token, { from, to, estado, metodoPago }),
        getOptions(token)
      ])
      setClientes(c)
      setProductos(p)
      setPedidos(o)
      setOrderStates(Array.isArray(opts.orderStates) ? opts.orderStates : [])
      setPayments(Array.isArray(opts.payments) ? opts.payments : [])
    } catch (err) {
      addToast("Error al cargar datos", "error")
    }
  }

  useEffect(() => {
    load()
  }, [token, from, to, estado, metodoPago])
  useEffect(() => {
    if (initFromUrl.current) return
    const qs = new URLSearchParams(window.location.search)
    const f = qs.get("from") || ""
    const t = qs.get("to") || ""
    const e = qs.get("estado") || ""
    const mp = qs.get("metodoPago") || ""
    setFrom(f)
    setTo(t)
    setEstado(e)
    setMetodoPago(mp)
    initFromUrl.current = true
  }, [])
  useEffect(() => {
    const qs = new URLSearchParams()
    if (from) qs.set("from", from)
    if (to) qs.set("to", to)
    if (estado) qs.set("estado", estado)
    if (metodoPago) qs.set("metodoPago", metodoPago)
    const url = `${window.location.pathname}?${qs.toString()}`
    window.history.replaceState({}, "", url)
  }, [from, to, estado, metodoPago])

  async function crear() {
    if (!nuevo.clienteId) {
      addToast("Por favor selecciona un cliente", "warning")
      return
    }
    const validItems = nuevo.items.filter((it) => it.productoId && Number(it.cantidad) > 0)
    if (validItems.length === 0) {
      addToast("Por favor agrega al menos un producto válido al pedido", "warning")
      return
    }

    // Check stock overflow before submission
    for (const it of validItems) {
      const prod = productos.find((p) => p.id === Number(it.productoId))
      if (prod) {
        const avail = Number(prod.stockActual || 0)
        const req = Number(it.cantidad || 0)
        if (avail < req) {
          addToast(`Stock insuficiente para ${prod.nombre} (Disponible: ${avail}, Solicitado: ${req})`, "error")
          return
        }
      }
    }

    try {
      const payloadItems = validItems.map((it) => {
        const rec = getItemRecommendedPrice(nuevo.clienteId, it.productoId)
        const unit = it.precioUnitario !== "" && it.precioUnitario != null ? Number(it.precioUnitario) : rec
        return {
          productoId: Number(it.productoId),
          cantidad: Number(it.cantidad),
          precioUnitario: unit != null ? Number(unit) : undefined
        }
      })

      await createPedido(token, {
        clienteId: Number(nuevo.clienteId),
        metodoPago: nuevo.metodoPago || "",
        notas: nuevo.notas || "",
        items: payloadItems
      })
      setNuevo({
        clienteId: "",
        metodoPago: "",
        notas: "",
        items: [{ productoId: "", cantidad: 1, precioUnitario: "" }]
      })
      setShowForm(false)
      load()
      addToast("Pedido creado exitosamente", "success")
    } catch (error) {
      addToast("Error al crear el pedido", "error")
    }
  }

  async function completar(id) {
    try {
      await updatePedido(token, id, { estado: "Completado" })
      load()
      addToast("Pedido completado", "success")
    } catch (error) {
      addToast("Error al completar pedido", "error")
    }
  }

  async function eliminar(id) {
    if (!window.confirm("¿Estás seguro de eliminar este pedido?")) return
    try {
      await deletePedido(token, id)
      load()
      addToast("Pedido eliminado", "success")
    } catch (error) {
      addToast("Error al eliminar pedido", "error")
    }
  }

  async function proforma(id) {
    try {
      const j = await generateProforma(token, id)
      if (j.url) {
        addToast("Proforma generada exitosamente", "success")
      } else {
        addToast("Error al generar proforma", "error")
      }
    } catch (error) {
      addToast("Error al generar proforma", "error")
    }
  }

  async function openAudit(order) {
    setAuditOrder(order)
    setShowAudit(true)
    setAuditPage(1)
    await loadAudit(order.id, 1, auditLimit)
  }

  async function loadAudit(id, pageArg, limitArg) {
    try {
      const data = await getPedidoAudit(token, id, { page: pageArg, limit: limitArg })
      setAuditItems(data.items || [])
      setAuditTotal(Number(data.total || 0))
    } catch {
      addToast("Error al cargar auditoría", "error")
    }
  }

  const filtered = pedidos.filter(
    (p) =>
      String(p.id).includes(searchTerm) ||
      String(p.estado || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
  )
  const completadosCount = pedidos.filter((p) => p.estado === "Completado").length
  const pendientesCount = pedidos.filter((p) => p.estado === "Pendiente").length

  function EstadoBadge({ estado }) {
    if (estado === "Completado")
      return (
        <div className="flex items-center gap-2 bg-green-500/20 border border-green-500 rounded-lg px-3 py-1 w-fit">
          <CheckCircle className="w-4 h-4 text-green-400" />
          <span className="text-green-400 font-semibold text-sm">Completado</span>
        </div>
      )
    if (estado === "Pendiente")
      return (
        <div className="flex items-center gap-2 bg-yellow-500/20 border border-yellow-500 rounded-lg px-3 py-1 w-fit">
          <AlertTriangle className="w-4 h-4 text-yellow-400" />
          <span className="text-yellow-400 font-semibold text-sm">Pendiente</span>
        </div>
      )
    return (
      <div className="flex items-center gap-2 bg-red-500/20 border border-red-500 rounded-lg px-3 py-1 w-fit">
        <AlertTriangle className="w-4 h-4 text-red-400" />
        <span className="text-red-400 font-semibold text-sm">Cancelado</span>
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-8 h-8 text-cyan-400" />
              <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
                Gestión de Pedidos
              </h1>
            </div>
            <button
              className="flex items-center gap-2 bg-slate-800/50 border border-cyan-500/30 rounded-lg px-4 py-2 text-gray-300"
              onClick={load}
            >
              <RefreshCw className="w-5 h-5 text-cyan-400" />
              Actualizar
            </button>
          </div>
          <p className="text-gray-400 ml-11">Crea, consulta y gestiona pedidos</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-cyan-500/30 rounded-lg p-4 shadow-lg shadow-cyan-500/20">
            <p className="text-gray-400 text-sm">Total Pedidos</p>
            <p className="text-3xl font-bold text-cyan-400">{pedidos.length}</p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm border border-green-500/30 rounded-lg p-4 shadow-lg shadow-green-500/20">
            <p className="text-gray-400 text-sm">Completados</p>
            <p className="text-3xl font-bold text-green-400">{completadosCount}</p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm border border-yellow-500/30 rounded-lg p-4 shadow-lg shadow-yellow-500/20">
            <p className="text-gray-400 text-sm">Pendientes</p>
            <p className="text-3xl font-bold text-yellow-400">{pendientesCount}</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por ID o estado"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800/50 border border-cyan-500/30 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:shadow-lg focus:shadow-cyan-500/30 transition-all"
            />
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-gradient-to-r from-cyan-500 to-purple-500 text-white px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-transform hover:scale-105 shadow-lg shadow-cyan-500/20"
          >
            <Plus className="w-5 h-5" />
            Nuevo Pedido
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
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
          <div className="md:col-span-2 flex items-center gap-2">
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
              }}
            >
              Limpiar
            </button>
          </div>
        </div>

        <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Crear Nuevo Pedido">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Cliente</label>
              <select
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-500 transition-colors"
                value={nuevo.clienteId}
                onChange={(e) => setNuevo({ ...nuevo, clienteId: e.target.value })}
              >
                <option value="">Seleccionar Cliente</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="block text-sm font-medium text-slate-300">Productos del Pedido</label>
              <button
                type="button"
                onClick={addItemRow}
                className="flex items-center gap-1 text-xs font-semibold bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 rounded px-2.5 py-1 hover:bg-cyan-500/30 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar Producto
              </button>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {nuevo.items.map((item, idx) => {
                const recPrice = getItemRecommendedPrice(nuevo.clienteId, item.productoId)
                const unit =
                  item.precioUnitario !== "" && item.precioUnitario != null
                    ? Number(item.precioUnitario)
                    : recPrice || 0
                const sub = (Number(item.cantidad) || 0) * unit
                return (
                  <div
                    key={idx}
                    className="bg-slate-900/80 border border-slate-700/70 rounded-lg p-3 relative space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-cyan-400 font-semibold">Ítem #{idx + 1}</span>
                      {nuevo.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItemRow(idx)}
                          className="text-red-400 hover:text-red-300 p-1"
                          title="Eliminar producto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div className="md:col-span-1">
                        <label className="block text-xs text-slate-400 mb-1">Producto</label>
                        <select
                          className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                          value={item.productoId}
                          onChange={(e) => handleItemChange(idx, "productoId", e.target.value)}
                        >
                          <option value="">Seleccionar</option>
                          {productos.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nombre} (Stock: {p.stockActual || 0})
                            </option>
                          ))}
                        </select>
                        {(() => {
                          const selP = productos.find((p) => p.id === Number(item.productoId))
                          if (!selP) return null
                          const avail = Number(selP.stockActual || 0)
                          const req = Number(item.cantidad || 0)
                          const isExceeded = req > avail
                          const isLow = avail <= Number(selP.stockMinimo || 0)
                          if (isExceeded) {
                            return (
                              <p className="text-xs text-red-400 font-semibold mt-1">¡Insuficiente! Disp: {avail}</p>
                            )
                          }
                          return (
                            <p className="text-xs text-slate-400 mt-1">
                              Disp:{" "}
                              <span
                                className={isLow ? "text-yellow-400 font-semibold" : "text-green-400 font-semibold"}
                              >
                                {avail} uds
                              </span>{" "}
                              {isLow && "(Stock Bajo)"}
                            </p>
                          )
                        })()}
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Cantidad</label>
                        <input
                          type="number"
                          min="1"
                          className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                          value={item.cantidad}
                          onChange={(e) => handleItemChange(idx, "cantidad", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Precio Unit. ($)</label>
                        <input
                          type="number"
                          className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                          placeholder={recPrice ? String(recPrice) : "Precio"}
                          value={item.precioUnitario}
                          onChange={(e) => handleItemChange(idx, "precioUnitario", e.target.value)}
                        />
                      </div>
                    </div>
                    {sub > 0 && (
                      <div className="text-right text-xs text-gray-400">
                        Subtotal: <span className="text-cyan-400 font-semibold">${sub.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Método de Pago (opcional)</label>
              <select
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-500 transition-colors"
                value={nuevo.metodoPago || ""}
                onChange={(e) => setNuevo({ ...nuevo, metodoPago: e.target.value })}
              >
                <option value="">Sin especificar</option>
                {payments.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-slate-900/50 border border-cyan-500/30 rounded-lg p-4 mt-4">
              <p className="text-gray-300 text-sm">
                Total Acumulado:{" "}
                <span className="text-2xl font-bold text-cyan-400">${totalPrice.toLocaleString()}</span>
              </p>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-700/50">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={crear}
                className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white rounded-lg shadow-lg shadow-cyan-500/20 transition-all transform hover:scale-105"
              >
                Crear Pedido
              </button>
            </div>
          </div>
        </Modal>

        <div className="bg-slate-800/50 backdrop-blur-sm border border-cyan-500/30 rounded-lg overflow-hidden shadow-xl shadow-cyan-500/20">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50">
                <tr className="border-b border-cyan-500/30">
                  <th className="text-left p-4 text-cyan-400 font-semibold">ID</th>
                  <th className="text-left p-4 text-cyan-400 font-semibold">Cliente</th>
                  <th className="text-left p-4 text-cyan-400 font-semibold">Productos / Ítems</th>
                  <th className="text-left p-4 text-cyan-400 font-semibold">Cant. Total</th>
                  <th className="text-left p-4 text-cyan-400 font-semibold">Total ($)</th>
                  <th className="text-left p-4 text-cyan-400 font-semibold">Estado Pedido</th>
                  <th className="text-left p-4 text-cyan-400 font-semibold">Estado Pago</th>
                  <th className="text-left p-4 text-cyan-400 font-semibold">Método Pago</th>
                  <th className="text-left p-4 text-cyan-400 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center p-8 text-gray-400">
                      No hay pedidos
                    </td>
                  </tr>
                ) : (
                  filtered.map((x) => {
                    const cliente = clientes.find((c) => c.id === x.clienteId)
                    const producto = productos.find((p) => p.id === x.productoId)
                    const hasItems = Array.isArray(x.items) && x.items.length > 0
                    const itemNames = hasItems
                      ? x.items.map((i) => i.productoNombre || `Producto #${i.productoId}`).join(", ")
                      : producto?.nombre || `Producto #${x.productoId}`
                    const totalQty = hasItems ? x.items.reduce((s, i) => s + Number(i.cantidad || 0), 0) : x.cantidad

                    return (
                      <tr key={x.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                        <td className="p-4 text-white font-medium">{x.id}</td>
                        <td className="p-4 text-gray-300">{cliente?.nombre || ""}</td>
                        <td className="p-4 text-gray-300 max-w-xs truncate" title={itemNames}>
                          {itemNames}
                        </td>
                        <td className="p-4 text-white font-semibold">{totalQty}</td>
                        <td className="p-4 text-cyan-400 font-bold">${(x.total || 0).toLocaleString()}</td>
                        <td className="p-4">
                          <EstadoBadge estado={x.estado} />
                        </td>
                        <td className="p-4">
                          <EstadoPagoBadge total={x.total} totalPagado={x.totalPagado} />
                        </td>
                        <td className="p-4 text-gray-300">{x.metodoPago || "Efectivo"}</td>
                        <td className="p-4">
                          <div className="flex gap-1.5 flex-wrap">
                            {x.estado !== "Completado" && x.estado !== "Cancelado" && (
                              <button
                                className="px-2.5 py-1 border border-green-500 text-green-400 text-xs rounded hover:bg-green-500/10 transition-colors"
                                onClick={() => completar(x.id)}
                              >
                                Completar
                              </button>
                            )}
                            <button
                              className="px-2.5 py-1 border border-emerald-500 text-emerald-400 text-xs rounded hover:bg-emerald-500/10 transition-colors flex items-center gap-1"
                              onClick={() => openAbonos(x)}
                              title="Registrar / Ver Abonos"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              Abonos
                            </button>
                            <button
                              className="px-2.5 py-1 border border-teal-500 text-teal-300 text-xs rounded hover:bg-teal-500/10 transition-colors flex items-center gap-1"
                              onClick={() => openWhatsApp(x)}
                              title="Enviar por WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              WhatsApp
                            </button>
                            <button
                              className="px-2.5 py-1 border border-cyan-500 text-cyan-400 text-xs rounded hover:bg-cyan-500/10 transition-colors"
                              onClick={() => proforma(x.id)}
                            >
                              Proforma
                            </button>
                            <button
                              className="px-2.5 py-1 border border-yellow-500 text-yellow-400 text-xs rounded hover:bg-yellow-500/10 transition-colors"
                              onClick={() => openAudit(x)}
                            >
                              Auditoría
                            </button>
                            {x.estado === "Pendiente" && (
                              <button
                                className="px-2.5 py-1 border border-purple-500 text-purple-400 text-xs rounded hover:bg-purple-500/10 transition-colors"
                                onClick={() => {
                                  setEditOrder(x)
                                  setEditMetodoPago(x.metodoPago || "")
                                  setEditCantidad(String(x.cantidad || ""))
                                }}
                              >
                                Editar
                              </button>
                            )}
                            <button
                              className="p-1 border border-red-500 text-red-400 rounded hover:bg-red-500/10 transition-colors"
                              onClick={() => eliminar(x.id)}
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal isOpen={showAudit} onClose={() => setShowAudit(false)} title="Auditoría del Pedido">
        <div className="space-y-3">
          <div className="text-gray-300">
            Pedido #{auditOrder?.id || ""} — Cliente{" "}
            {clientes.find((c) => c.id === auditOrder?.clienteId)?.nombre || ""}
          </div>
          <div className="relative pl-6 border-l-2 border-cyan-500/30 space-y-4 my-4">
            {auditItems.length === 0 ? (
              <p className="text-gray-400 text-sm">Sin eventos de auditoría registrados</p>
            ) : (
              auditItems.map((a) => {
                const obs = String(a.observation || "").toLowerCase()
                const isCreated = obs.includes("creado")
                const isCompleted = obs.includes("completado")
                const isUpdated = obs.includes("actualizado")

                return (
                  <div key={a.id} className="relative group">
                    <div
                      className={`absolute -left-[31px] top-0 w-6 h-6 rounded-full border flex items-center justify-center ${
                        isCompleted
                          ? "bg-green-500/20 border-green-500 text-green-400"
                          : isCreated
                            ? "bg-cyan-500/20 border-cyan-500 text-cyan-400"
                            : isUpdated
                              ? "bg-yellow-500/20 border-yellow-500 text-yellow-400"
                              : "bg-purple-500/20 border-purple-500 text-purple-400"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-3.5 h-3.5" />
                      ) : isCreated ? (
                        <Plus className="w-3.5 h-3.5" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="bg-slate-900/80 border border-slate-700/60 rounded-lg p-3 shadow-md">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-white capitalize">{a.observation || "Evento"}</span>
                        <span className="text-slate-400">{new Date(a.date).toLocaleString("es-CO")}</span>
                      </div>
                      <p className="text-xs text-cyan-400 font-medium">
                        Usuario: <span className="text-gray-300">{a.userName || `ID #${a.userId || "Sistema"}`}</span>
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="text-gray-400">
              Página {auditPage} de {Math.max(1, Math.ceil(auditTotal / auditLimit))}
            </div>
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1 border border-slate-600 text-gray-300 rounded disabled:opacity-50"
                disabled={auditPage <= 1}
                onClick={async () => {
                  const np = auditPage - 1
                  setAuditPage(np)
                  await loadAudit(auditOrder.id, np, auditLimit)
                }}
              >
                Prev
              </button>
              <button
                className="px-3 py-1 border border-slate-600 text-gray-300 rounded disabled:opacity-50"
                disabled={auditPage >= Math.max(1, Math.ceil(auditTotal / auditLimit))}
                onClick={async () => {
                  const np = auditPage + 1
                  setAuditPage(np)
                  await loadAudit(auditOrder.id, np, auditLimit)
                }}
              >
                Next
              </button>
              <select
                className="ml-2 bg-slate-800 border border-slate-700 rounded text-white p-1"
                value={auditLimit}
                onChange={async (e) => {
                  const nl = Number(e.target.value)
                  setAuditLimit(nl)
                  setAuditPage(1)
                  await loadAudit(auditOrder.id, 1, nl)
                }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </div>
      </Modal>
      <Modal isOpen={!!editOrder} onClose={() => setEditOrder(null)} title="Editar Pedido (Pendiente)">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Cantidad</label>
              <input
                type="number"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white"
                value={editCantidad}
                onChange={(e) => setEditCantidad(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Método de Pago</label>
              <select
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white"
                value={editMetodoPago}
                onChange={(e) => setEditMetodoPago(e.target.value)}
              >
                <option value="">Sin especificar</option>
                {payments.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              className="px-3 py-2 border border-slate-600 text-gray-300 rounded"
              onClick={() => setEditOrder(null)}
            >
              Cancelar
            </button>
            <button
              className="px-3 py-2 bg-gradient-to-r from-cyan-600 to-purple-600 text-white rounded"
              onClick={async () => {
                if (!editOrder) return
                try {
                  const payload = { cantidad: Number(editCantidad), metodoPago: editMetodoPago || "" }
                  await updatePedido(token, editOrder.id, payload)
                  addToast("Pedido actualizado", "success")
                  setEditOrder(null)
                  load()
                } catch {
                  addToast("Error al actualizar pedido", "error")
                }
              }}
            >
              Guardar
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showAbonos}
        onClose={() => setShowAbonos(false)}
        title={`Abonos — Pedido #${abonosOrder?.id || ""}`}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-slate-900/60 border border-cyan-500/30 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-400">Total Pedido</p>
              <p className="text-xl font-bold text-white">${abonosSummary.total.toLocaleString("es-CO")}</p>
            </div>
            <div className="bg-slate-900/60 border border-emerald-500/30 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-400">Total Abonado</p>
              <p className="text-xl font-bold text-emerald-400">${abonosSummary.totalPagado.toLocaleString("es-CO")}</p>
            </div>
            <div className="bg-slate-900/60 border border-rose-500/30 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-400">Saldo Pendiente</p>
              <p className="text-xl font-bold text-rose-400">${abonosSummary.saldoPendiente.toLocaleString("es-CO")}</p>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-700/60 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-semibold text-cyan-400 flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Registrar Nuevo Abono
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-300 mb-1">Monto ($)</label>
                <input
                  type="number"
                  min="1"
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                  placeholder="Monto a abonar"
                  value={newAbono.monto}
                  onChange={(e) => setNewAbono({ ...newAbono, monto: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-300 mb-1">Método de Pago</label>
                <select
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                  value={newAbono.metodoPago}
                  onChange={(e) => setNewAbono({ ...newAbono, metodoPago: e.target.value })}
                >
                  <option value="Efectivo">Efectivo</option>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Tarjeta">Tarjeta</option>
                  <option value="Nequi">Nequi</option>
                  <option value="Bancolombia">Bancolombia</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-300 mb-1">Nota / Ref (opcional)</label>
                <input
                  type="text"
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                  placeholder="Ej: Comprobante #1234"
                  value={newAbono.nota}
                  onChange={(e) => setNewAbono({ ...newAbono, nota: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <button
                onClick={handleCrearAbono}
                className="px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded text-xs font-semibold shadow transition-all"
              >
                Guardar Abono
              </button>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-2">Historial de Abonos</h4>
            {loadingAbonos ? (
              <p className="text-xs text-gray-400">Cargando abonos...</p>
            ) : abonosItems.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">No se han registrado abonos para este pedido.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-2">
                {abonosItems.map((ab) => (
                  <div
                    key={ab.id}
                    className="bg-slate-900/80 border border-slate-700/60 rounded p-2.5 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-semibold text-emerald-400">
                        ${Number(ab.monto || 0).toLocaleString("es-CO")} ({ab.metodoPago || "Efectivo"})
                      </p>
                      <p className="text-slate-400 text-[11px]">
                        {new Date(ab.date).toLocaleString("es-CO")} — {ab.userName || "Sistema"}
                      </p>
                    </div>
                    {ab.nota && (
                      <span className="text-gray-300 bg-slate-800 px-2 py-0.5 rounded text-[11px]">{ab.nota}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </>
  )
}

function EstadoBadge({ estado }) {
  const isCompleted = estado === "Completado"
  const isCanceled = estado === "Cancelado"
  return (
    <span
      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
        isCompleted
          ? "bg-green-500/20 text-green-400 border border-green-500/30"
          : isCanceled
            ? "bg-red-500/20 text-red-400 border border-red-500/30"
            : "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
      }`}
    >
      {estado}
    </span>
  )
}

function EstadoPagoBadge({ total, totalPagado }) {
  const pagado = Number(totalPagado || 0)
  const tot = Number(total || 0)
  const saldo = Math.max(0, tot - pagado)
  const isPaid = pagado >= tot && tot > 0
  const isPartial = pagado > 0 && !isPaid

  if (isPaid) {
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
        Pagado
      </span>
    )
  }
  if (isPartial) {
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
        Parcial (${saldo.toLocaleString()})
      </span>
    )
  }
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30">
      Pendiente
    </span>
  )
}
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
  setFrom(start.toISOString().slice(0, 10))
  setTo(end.toISOString().slice(0, 10))
}
function setThisMonth() {
  const d = new Date()
  const start = new Date(d.getFullYear(), d.getMonth(), 1)
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  setFrom(start.toISOString().slice(0, 10))
  setTo(end.toISOString().slice(0, 10))
}
