import React, { useEffect, useState } from "react"
import { ShoppingCart, Search, Plus, RefreshCw, CheckCircle, AlertTriangle, FileText, X, Trash2 } from "lucide-react"
import { useToast } from "../components/ToastContext"
import Modal from "../components/Modal"
import { getClientes, getProductos, getPedidosFiltered, createPedido, updatePedido, deletePedido, generateProforma, getPedidoAudit, getOptions } from "../api/client"

export default function Pedidos({ token }) {
  const { addToast } = useToast()
  const [showForm, setShowForm] = useState(false)
  const [pedidos, setPedidos] = useState([])
  const [clientes, setClientes] = useState([])
  const [productos, setProductos] = useState([])
  const [nuevo, setNuevo] = useState({ clienteId: "", productoId: "", cantidad: "" })
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

  async function load() {
    if (!token) return
    try {
      const [c, p, o, opts] = await Promise.all([
        getClientes(token),
        getProductos(token),
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

  useEffect(() => { load() }, [token, from, to, estado, metodoPago])
  useEffect(() => {
    if (initFromUrl.current) return
    const qs = new URLSearchParams(window.location.search)
    const f = qs.get('from') || ''
    const t = qs.get('to') || ''
    const e = qs.get('estado') || ''
    const mp = qs.get('metodoPago') || ''
    setFrom(f); setTo(t); setEstado(e); setMetodoPago(mp)
    initFromUrl.current = true
  }, [])
  useEffect(() => {
    const qs = new URLSearchParams()
    if (from) qs.set('from', from)
    if (to) qs.set('to', to)
    if (estado) qs.set('estado', estado)
    if (metodoPago) qs.set('metodoPago', metodoPago)
    const url = `${window.location.pathname}?${qs.toString()}`
    window.history.replaceState({}, '', url)
  }, [from, to, estado, metodoPago])

  async function crear() {
    if (!nuevo.clienteId || !nuevo.productoId || !nuevo.cantidad) {
      addToast("Por favor completa todos los campos", "warning")
      return
    }
    try {
      await createPedido(token, { ...nuevo, cantidad: Number(nuevo.cantidad), metodoPago: nuevo.metodoPago || "" })
      setNuevo({ clienteId: "", productoId: "", cantidad: "", metodoPago: "" })
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

  const filtered = pedidos.filter(p => String(p.id).includes(searchTerm) || String(p.estado || "").toLowerCase().includes(searchTerm.toLowerCase()))
  const completadosCount = pedidos.filter(p => p.estado === "Completado").length
  const pendientesCount = pedidos.filter(p => p.estado === "Pendiente").length

  function EstadoBadge({ estado }) {
    if (estado === "Completado") return <div className="flex items-center gap-2 bg-green-500/20 border border-green-500 rounded-lg px-3 py-1 w-fit"><CheckCircle className="w-4 h-4 text-green-400" /><span className="text-green-400 font-semibold text-sm">Completado</span></div>
    if (estado === "Pendiente") return <div className="flex items-center gap-2 bg-yellow-500/20 border border-yellow-500 rounded-lg px-3 py-1 w-fit"><AlertTriangle className="w-4 h-4 text-yellow-400" /><span className="text-yellow-400 font-semibold text-sm">Pendiente</span></div>
    return <div className="flex items-center gap-2 bg-red-500/20 border border-red-500 rounded-lg px-3 py-1 w-fit"><AlertTriangle className="w-4 h-4 text-red-400" /><span className="text-red-400 font-semibold text-sm">Cancelado</span></div>
  }

  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 text-cyan-400" />
            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">Gestión de Pedidos</h1>
          </div>
          <button className="flex items-center gap-2 bg-slate-800/50 border border-cyan-500/30 rounded-lg px-4 py-2 text-gray-300" onClick={load}><RefreshCw className="w-5 h-5 text-cyan-400" />Actualizar</button>
        </div>
        <p className="text-gray-400 ml-11">Crea, consulta y gestiona pedidos</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-800/50 backdrop-blur-sm border border-cyan-500/30 rounded-lg p-4 shadow-lg shadow-cyan-500/20"><p className="text-gray-400 text-sm">Total Pedidos</p><p className="text-3xl font-bold text-cyan-400">{pedidos.length}</p></div>
        <div className="bg-slate-800/50 backdrop-blur-sm border border-green-500/30 rounded-lg p-4 shadow-lg shadow-green-500/20"><p className="text-gray-400 text-sm">Completados</p><p className="text-3xl font-bold text-green-400">{completadosCount}</p></div>
        <div className="bg-slate-800/50 backdrop-blur-sm border border-yellow-500/30 rounded-lg p-4 shadow-lg shadow-yellow-500/20"><p className="text-gray-400 text-sm">Pendientes</p><p className="text-3xl font-bold text-yellow-400">{pendientesCount}</p></div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" placeholder="Buscar por ID o estado" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-slate-800/50 border border-cyan-500/30 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:shadow-lg focus:shadow-cyan-500/30 transition-all" />
        </div>
        <button onClick={() => setShowForm(true)} className="bg-gradient-to-r from-cyan-500 to-purple-500 text-white px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-transform hover:scale-105 shadow-lg shadow-cyan-500/20"><Plus className="w-5 h-5" />Nuevo Pedido</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <div>
          <label className="text-gray-300 text-sm mb-1 block">Desde</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full bg-slate-900/60 border border-cyan-500/30 rounded-lg px-3 py-2 text-gray-300" />
        </div>
        <div>
          <label className="text-gray-300 text-sm mb-1 block">Hasta</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-full bg-slate-900/60 border border-cyan-500/30 rounded-lg px-3 py-2 text-gray-300" />
        </div>
        <div>
          <label className="text-gray-300 text-sm mb-1 block">Estado</label>
          <select value={estado} onChange={e => setEstado(e.target.value)} className="w-full bg-slate-900/60 border border-cyan-500/30 rounded-lg px-3 py-2 text-gray-300">
            <option value="">Todos</option>
            {orderStates.map(s => (<option key={s} value={s}>{s}</option>))}
          </select>
        </div>
        <div>
          <label className="text-gray-300 text-sm mb-1 block">Método de Pago</label>
          <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)} className="w-full bg-slate-900/60 border border-cyan-500/30 rounded-lg px-3 py-2 text-gray-300">
            <option value="">Todos</option>
            {payments.map(p => (<option key={p} value={p}>{p}</option>))}
          </select>
        </div>
        <div className="md:col-span-2 flex items-center gap-2">
          <button className="px-3 py-2 border border-cyan-500/30 rounded text-gray-300 bg-slate-900/60" onClick={setToday}>Hoy</button>
          <button className="px-3 py-2 border border-cyan-500/30 rounded text-gray-300 bg-slate-900/60" onClick={setThisWeek}>Esta semana</button>
          <button className="px-3 py-2 border border-cyan-500/30 rounded text-gray-300 bg-slate-900/60" onClick={setThisMonth}>Este mes</button>
          <button className="ml-auto px-3 py-2 border border-slate-600 rounded text-gray-300 bg-slate-900/60" onClick={() => { setFrom(""); setTo(""); setEstado(""); setMetodoPago("") }}>Limpiar</button>
        </div>
      </div>

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="Crear Nuevo Pedido"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Cliente</label>
            <select 
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-500 transition-colors" 
              value={nuevo.clienteId} 
              onChange={e => setNuevo({ ...nuevo, clienteId: e.target.value })}
            >
              <option value="">Seleccionar Cliente</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Producto</label>
            <select 
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-500 transition-colors" 
              value={nuevo.productoId} 
              onChange={e => setNuevo({ ...nuevo, productoId: e.target.value })}
            >
              <option value="">Seleccionar Producto</option>
              {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Cantidad</label>
            <input 
              type="number"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-500 transition-colors" 
              placeholder="0" 
              value={nuevo.cantidad} 
              onChange={e => setNuevo({ ...nuevo, cantidad: e.target.value })} 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Método de Pago (opcional)</label>
            <select 
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-500 transition-colors" 
              value={nuevo.metodoPago || ""} 
              onChange={e => setNuevo({ ...nuevo, metodoPago: e.target.value })}
            >
              <option value="">Sin especificar</option>
              {payments.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
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
                <th className="text-left p-4 text-cyan-400 font-semibold">Producto</th>
                <th className="text-left p-4 text-cyan-400 font-semibold">Cantidad</th>
                <th className="text-left p-4 text-cyan-400 font-semibold">Estado</th>
                <th className="text-left p-4 text-cyan-400 font-semibold">Método Pago</th>
                <th className="text-left p-4 text-cyan-400 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="6" className="text-center p-8 text-gray-400">No hay pedidos</td></tr>
              ) : (
                filtered.map(x => {
                  const cliente = clientes.find(c => c.id === x.clienteId)
                  const producto = productos.find(p => p.id === x.productoId)
                  return (
                    <tr key={x.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                      <td className="p-4 text-white font-medium">{x.id}</td>
                      <td className="p-4 text-gray-300">{cliente?.nombre || ""}</td>
                      <td className="p-4 text-gray-300">{producto?.nombre || ""}</td>
                      <td className="p-4 text-white font-semibold">{x.cantidad}</td>
                      <td className="p-4"><EstadoBadge estado={x.estado} /></td>
                      <td className="p-4 text-gray-300">{x.metodoPago || "Efectivo"}</td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <button className="px-3 py-1 border border-green-500 text-green-400 rounded hover:bg-green-500/10 transition-colors" onClick={() => completar(x.id)}>Completar</button>
                          <button className="px-3 py-1 border border-cyan-500 text-cyan-400 rounded hover:bg-cyan-500/10 transition-colors" onClick={() => proforma(x.id)}>Proforma</button>
                          <button className="px-3 py-1 border border-yellow-500 text-yellow-400 rounded hover:bg-yellow-500/10 transition-colors" onClick={() => openAudit(x)}>Auditoría</button>
                          {x.estado === "Pendiente" && (
                            <button className="px-3 py-1 border border-purple-500 text-purple-400 rounded hover:bg-purple-500/10 transition-colors" onClick={() => { setEditOrder(x); setEditMetodoPago(x.metodoPago || ""); setEditCantidad(String(x.cantidad || "")); }}>Editar</button>
                          )}
                          <button className="p-1 border border-red-500 text-red-400 rounded hover:bg-red-500/10 transition-colors" onClick={() => eliminar(x.id)} title="Eliminar"><Trash2 className="w-5 h-5" /></button>
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
        <div className="text-gray-300">Pedido #{auditOrder?.id || ""} — Cliente {clientes.find(c => c.id === auditOrder?.clienteId)?.nombre || ""}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-300">
                <th className="p-2 text-left">Fecha</th>
                <th className="p-2 text-left">Observación</th>
                <th className="p-2 text-left">Usuario</th>
              </tr>
            </thead>
            <tbody>
              {auditItems.length === 0 ? (
                <tr><td className="p-3 text-gray-400" colSpan="3">Sin auditoría</td></tr>
              ) : auditItems.map(a => (
                <tr key={a.id} className="border-t border-slate-700">
                  <td className="p-2 text-gray-300">{new Date(a.date).toLocaleString()}</td>
                  <td className="p-2 text-gray-300">{a.observation || ''}</td>
                  <td className="p-2 text-gray-300">{a.userName || a.userId || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="text-gray-400">Página {auditPage} de {Math.max(1, Math.ceil(auditTotal / auditLimit))}</div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 border border-slate-600 text-gray-300 rounded disabled:opacity-50" disabled={auditPage <= 1} onClick={async () => { const np = auditPage - 1; setAuditPage(np); await loadAudit(auditOrder.id, np, auditLimit) }}>Prev</button>
            <button className="px-3 py-1 border border-slate-600 text-gray-300 rounded disabled:opacity-50" disabled={auditPage >= Math.max(1, Math.ceil(auditTotal / auditLimit))} onClick={async () => { const np = auditPage + 1; setAuditPage(np); await loadAudit(auditOrder.id, np, auditLimit) }}>Next</button>
            <select className="ml-2 bg-slate-800 border border-slate-700 rounded text-white p-1" value={auditLimit} onChange={async e => { const nl = Number(e.target.value); setAuditLimit(nl); setAuditPage(1); await loadAudit(auditOrder.id, 1, nl) }}>
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
            <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white" value={editCantidad} onChange={e => setEditCantidad(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Método de Pago</label>
            <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white" value={editMetodoPago} onChange={e => setEditMetodoPago(e.target.value)}>
              <option value="">Sin especificar</option>
              {payments.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button className="px-3 py-2 border border-slate-600 text-gray-300 rounded" onClick={() => setEditOrder(null)}>Cancelar</button>
          <button className="px-3 py-2 bg-gradient-to-r from-cyan-600 to-purple-600 text-white rounded" onClick={async () => {
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
          }}>Guardar</button>
        </div>
      </div>
    </Modal>
    </>
  )
}
  function setToday() {
    const d = new Date(); const iso = d.toISOString().slice(0,10); setFrom(iso); setTo(iso)
  }
  function setThisWeek() {
    const d = new Date(); const day = d.getDay(); const diffToMonday = (day + 6) % 7; const start = new Date(d); start.setDate(d.getDate() - diffToMonday); const end = new Date(start); end.setDate(start.getDate() + 6); setFrom(start.toISOString().slice(0,10)); setTo(end.toISOString().slice(0,10))
  }
  function setThisMonth() {
    const d = new Date(); const start = new Date(d.getFullYear(), d.getMonth(), 1); const end = new Date(d.getFullYear(), d.getMonth() + 1, 0); setFrom(start.toISOString().slice(0,10)); setTo(end.toISOString().slice(0,10))
  }
