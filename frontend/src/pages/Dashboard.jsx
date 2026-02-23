import React, { useEffect, useState } from "react"
import { TrendingUp, ShoppingCart, Users, Package, DollarSign, AlertTriangle, Calendar, Activity } from "lucide-react"
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { getDashboard } from "../api/client"

export default function Dashboard({ token = "demo-token" }) {
  const [stats, setStats] = useState({
    totalVentas: 0,
    pedidosCompletados: 0,
    clientesNuevos: 0,
    ticketPromedio: 0,
    stockBajo: 0
  })
  
  const [ventasMensuales, setVentasMensuales] = useState([])
  const [ventasDiarias, setVentasDiarias] = useState([])
  const [topClientes, setTopClientes] = useState([])
  const [metodosPago, setMetodosPago] = useState([])
  const [estadoPedidos, setEstadoPedidos] = useState([])

  useEffect(() => {
    loadDashboardData()
  }, [token])

  async function loadDashboardData() {
    try {
      const data = await getDashboard(token)

      setStats(data.stats)
      setVentasMensuales(data.ventasMensuales)
      setVentasDiarias(data.ventasDiarias)
      setTopClientes(data.topClientes)

      const paymentColors = { "Efectivo": "#06b6d4", "Transferencia": "#a855f7", "Crédito": "#eab308" }
      {
        const totalPayments = (Array.isArray(data.metodosPago) ? data.metodosPago : []).reduce((s, x) => s + Number(x.value || 0), 0)
        const items = (Array.isArray(data.metodosPago) ? data.metodosPago : []).map(m => ({
          ...m,
          percent: totalPayments > 0 ? Math.round((Number(m.value || 0) / totalPayments) * 100) : 0,
          color: paymentColors[m.name] || "#ef4444"
        }))
        setMetodosPago(items)
      }

      const stateColors = { "Completado": "#10b981", "Pendiente": "#eab308", "Cancelado": "#ef4444" }
      {
        const totalStates = (Array.isArray(data.estadoPedidos) ? data.estadoPedidos : []).reduce((s, x) => s + Number(x.value || 0), 0)
        const items = (Array.isArray(data.estadoPedidos) ? data.estadoPedidos : []).map(e => ({
          ...e,
          percent: totalStates > 0 ? Math.round((Number(e.value || 0) / totalStates) * 100) : 0,
          color: stateColors[e.name] || "#94a3b8"
        }))
        setEstadoPedidos(items)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', { 
      style: 'currency', 
      currency: 'COP',
      minimumFractionDigits: 0 
    }).format(value)
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-cyan-500/50 rounded-lg p-3 shadow-xl">
          <p className="text-gray-300 text-sm mb-1">{label}</p>
          <p className="text-cyan-400 font-bold">{formatCurrency(payload[0].value)}</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="w-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6 rounded-lg">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8 text-cyan-400" />
            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
              Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-2 bg-slate-800/50 border border-cyan-500/30 rounded-lg px-4 py-2">
            <Calendar className="w-5 h-5 text-cyan-400" />
            <span className="text-gray-300 capitalize">
              {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>
        <p className="text-gray-400 ml-11">Resumen general de operaciones LOLO</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-slate-800/50 backdrop-blur-sm border border-cyan-500/30 rounded-lg p-4 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 transition-all">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 text-cyan-400" />
          </div>
          <p className="text-gray-400 text-sm">Total Ventas</p>
          <p className="text-2xl font-bold text-cyan-400">{formatCurrency(stats.totalVentas)}</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm border border-purple-500/30 rounded-lg p-4 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 transition-all">
          <div className="flex items-center justify-between mb-2">
            <ShoppingCart className="w-8 h-8 text-purple-400" />
          </div>
          <p className="text-gray-400 text-sm">Pedidos Completados</p>
          <p className="text-2xl font-bold text-purple-400">{stats.pedidosCompletados}</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm border border-green-500/30 rounded-lg p-4 shadow-lg shadow-green-500/20 hover:shadow-green-500/40 transition-all">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 text-green-400" />
          </div>
          <p className="text-gray-400 text-sm">Clientes Nuevos</p>
          <p className="text-2xl font-bold text-green-400">{stats.clientesNuevos}</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm border border-yellow-500/30 rounded-lg p-4 shadow-lg shadow-yellow-500/20 hover:shadow-yellow-500/40 transition-all">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 text-yellow-400" />
          </div>
          <p className="text-gray-400 text-sm">Ticket Promedio</p>
          <p className="text-2xl font-bold text-yellow-400">{formatCurrency(stats.ticketPromedio)}</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm border border-red-500/30 rounded-lg p-4 shadow-lg shadow-red-500/20 hover:shadow-red-500/40 transition-all">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <p className="text-gray-400 text-sm">Alertas Stock Bajo</p>
          <p className="text-2xl font-bold text-red-400">{stats.stockBajo}</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Ventas Mensuales */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-cyan-500/30 rounded-lg p-6 shadow-xl shadow-cyan-500/20">
          <h3 className="text-xl font-semibold text-cyan-400 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Ventas Mensuales
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={ventasMensuales}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="mes" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="ventas" 
                stroke="#06b6d4" 
                strokeWidth={3}
                dot={{ fill: '#06b6d4', r: 5 }}
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Ventas Diarias */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-purple-500/30 rounded-lg p-6 shadow-xl shadow-purple-500/20">
          <h3 className="text-xl font-semibold text-purple-400 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Ventas por Día
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={ventasDiarias}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="dia" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="ventas" fill="url(#colorGradient)" radius={[8, 8, 0, 0]} />
              <defs>
                <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity={1}/>
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0.8}/>
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Second Row Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Clientes */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-green-500/30 rounded-lg p-6 shadow-xl shadow-green-500/20 lg:col-span-1">
          <h3 className="text-xl font-semibold text-green-400 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Top 5 Clientes
          </h3>
          <div className="space-y-3">
            {topClientes.map((cliente, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-green-500/20 hover:border-green-500/50 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center text-white font-bold">
                    {idx + 1}
                  </div>
                  <span className="text-gray-300 text-sm">{cliente.nombre}</span>
                </div>
                <span className="text-green-400 font-semibold text-sm">{formatCurrency(cliente.total)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Métodos de Pago */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-yellow-500/30 rounded-lg p-6 shadow-xl shadow-yellow-500/20">
          <h3 className="text-xl font-semibold text-yellow-400 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Métodos de Pago
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={metodosPago}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {metodosPago.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {metodosPago.map((metodo, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: metodo.color }}></div>
                <span className="text-gray-300 text-sm">{metodo.name} ({metodo.percent}%)</span>
              </div>
            ))}
          </div>
        </div>

        {/* Estado Pedidos */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-pink-500/30 rounded-lg p-6 shadow-xl shadow-pink-500/20">
          <h3 className="text-xl font-semibold text-pink-400 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5" />
            Estado de Pedidos
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={estadoPedidos}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {estadoPedidos.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-4">
            {estadoPedidos.map((estado, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: estado.color }}></div>
                  <span className="text-gray-300 text-sm">{estado.name}</span>
                </div>
                <span className="text-gray-400 font-semibold text-sm">{estado.percent}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
