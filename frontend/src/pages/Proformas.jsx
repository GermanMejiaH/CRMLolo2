import React, { useEffect, useState } from "react"
import { FileText, Search, RefreshCw } from "lucide-react"
import { useToast } from "../components/ToastContext"
import { getProformas, API_BASE_URL } from "../api/client"

export default function Proformas({ token }) {
  const { addToast } = useToast()
  const [items, setItems] = useState([])
  const [searchTerm, setSearchTerm] = useState("")

  async function load() {
    if (!token) return
    try {
      const j = await getProformas(token)
      setItems(j)
    } catch (error) {
      addToast("Error al cargar las proformas", "error")
    }
  }
  useEffect(() => {
    load()
  }, [token])
  const filtered = items.filter((p) => String(p.id).includes(searchTerm) || String(p.pedidoId).includes(searchTerm))
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-cyan-400" />
            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
              Proformas
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
        <p className="text-gray-400 ml-11">Listado y descarga de PDFs</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-800/50 backdrop-blur-sm border border-cyan-500/30 rounded-lg p-4 shadow-lg shadow-cyan-500/20">
          <p className="text-gray-400 text-sm">Total Proformas</p>
          <p className="text-3xl font-bold text-cyan-400">{items.length}</p>
        </div>
        <div className="bg-slate-800/50 backdrop-blur-sm border border-purple-500/30 rounded-lg p-4 shadow-lg shadow-purple-500/20">
          <p className="text-gray-400 text-sm">Monto Total Proformado</p>
          <p className="text-3xl font-bold text-purple-400">
            {new Intl.NumberFormat("es-CO", {
              style: "currency",
              currency: "COP",
              minimumFractionDigits: 0
            }).format(items.reduce((sum, p) => sum + (p.total || 0), 0))}
          </p>
        </div>
        <div className="bg-slate-800/50 backdrop-blur-sm border border-green-500/30 rounded-lg p-4 shadow-lg shadow-green-500/20">
          <p className="text-gray-400 text-sm">Última Generada</p>
          <p className="text-3xl font-bold text-green-400">
            {items.length > 0 ? `PRF-${String(items[items.length - 1].id).padStart(4, "0")}` : "N/A"}
          </p>
        </div>
      </div>
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por ID o Pedido"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800/50 border border-cyan-500/30 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:shadow-lg focus:shadow-cyan-500/30 transition-all"
          />
        </div>
      </div>
      <div className="bg-slate-800/50 backdrop-blur-sm border border-cyan-500/30 rounded-lg overflow-hidden shadow-xl shadow-cyan-500/20">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900/50">
              <tr className="border-b border-cyan-500/30">
                <th className="text-left p-4 text-cyan-400 font-semibold">ID</th>
                <th className="text-left p-4 text-cyan-400 font-semibold">Pedido</th>
                <th className="text-left p-4 text-cyan-400 font-semibold">Total</th>
                <th className="text-left p-4 text-cyan-400 font-semibold">Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="4" className="text-center p-8 text-gray-400">
                    No hay proformas
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                    <td className="p-4 text-white font-medium">{p.id}</td>
                    <td className="p-4 text-gray-300">{p.pedidoId}</td>
                    <td className="p-4 text-gray-300">
                      {new Intl.NumberFormat("es-CO", {
                        style: "currency",
                        currency: "COP",
                        minimumFractionDigits: 0
                      }).format(p.total)}
                    </td>
                    <td className="p-4">
                      <a
                        className="px-3 py-1 border border-cyan-500 text-cyan-400 rounded"
                        href={`${API_BASE_URL}${p.url}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Descargar
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
