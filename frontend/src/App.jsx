import React, { useEffect, useState } from "react"
import { Routes, Route, NavLink, Link, Navigate } from "react-router-dom"
import {
  LayoutDashboard,
  Users,
  Package,
  Cpu,
  Truck,
  ShoppingCart,
  FileText,
  Settings as SettingsIcon,
  FileSpreadsheet,
  LogIn,
  LogOut
} from "lucide-react"
import { ToastProvider } from "./components/ToastContext"
import Login from "./pages/Login.jsx"
import Dashboard from "./pages/Dashboard.jsx"
import Clientes from "./pages/Clientes.jsx"
import Productos from "./pages/Productos.jsx"
import Produccion from "./pages/Produccion.jsx"
import Compras from "./pages/Compras.jsx"
import Pedidos from "./pages/Pedidos.jsx"
import Proformas from "./pages/Proformas.jsx"
import Configuracion from "./pages/Configuracion.jsx"
import Reportes from "./pages/Reportes.jsx"

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "")
  useEffect(() => {
    if (token) localStorage.setItem("token", token)
    else localStorage.removeItem("token")
  }, [token])

  function RequireAuth({ children }) {
    if (!token) return <Navigate to="/login" />
    return children
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-900 overflow-x-hidden">
        <div className="px-6 py-3 flex items-center gap-3 bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900 border-b border-cyan-500/20 shadow-lg shadow-cyan-500/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-purple-500 rounded-lg flex items-center justify-center text-white font-bold">
              L
            </div>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 font-semibold">
              CRM LOLO
            </span>
          </div>
          {token && (
            <div className="flex items-center gap-2 ml-6 overflow-x-auto whitespace-nowrap">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg flex items-center gap-2 text-sm ${isActive ? "bg-slate-800/60 border border-cyan-500/40 text-cyan-300" : "text-gray-300 hover:text-white"}`
                }
                end
              >
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </NavLink>
              <NavLink
                to="/clientes"
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg flex items-center gap-2 text-sm ${isActive ? "bg-slate-800/60 border border-cyan-500/40 text-cyan-300" : "text-gray-300 hover:text-white"}`
                }
              >
                <Users className="w-4 h-4" /> Clientes
              </NavLink>
              <NavLink
                to="/productos"
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg flex items-center gap-2 text-sm ${isActive ? "bg-slate-800/60 border border-cyan-500/40 text-cyan-300" : "text-gray-300 hover:text-white"}`
                }
              >
                <Package className="w-4 h-4" /> Productos
              </NavLink>
              <NavLink
                to="/produccion"
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg flex items-center gap-2 text-sm ${isActive ? "bg-slate-800/60 border border-cyan-500/40 text-cyan-300" : "text-gray-300 hover:text-white"}`
                }
              >
                <Cpu className="w-4 h-4" /> Producción
              </NavLink>
              <NavLink
                to="/compras"
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg flex items-center gap-2 text-sm ${isActive ? "bg-slate-800/60 border border-cyan-500/40 text-cyan-300" : "text-gray-300 hover:text-white"}`
                }
              >
                <Truck className="w-4 h-4" /> Compras
              </NavLink>
              <NavLink
                to="/pedidos"
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg flex items-center gap-2 text-sm ${isActive ? "bg-slate-800/60 border border-cyan-500/40 text-cyan-300" : "text-gray-300 hover:text-white"}`
                }
              >
                <ShoppingCart className="w-4 h-4" /> Pedidos
              </NavLink>
              <NavLink
                to="/proformas"
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg flex items-center gap-2 text-sm ${isActive ? "bg-slate-800/60 border border-cyan-500/40 text-cyan-300" : "text-gray-300 hover:text-white"}`
                }
              >
                <FileText className="w-4 h-4" /> Proformas
              </NavLink>
              <NavLink
                to="/configuracion"
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg flex items-center gap-2 text-sm ${isActive ? "bg-slate-800/60 border border-cyan-500/40 text-cyan-300" : "text-gray-300 hover:text-white"}`
                }
              >
                <SettingsIcon className="w-4 h-4" /> Configuración
              </NavLink>
              <NavLink
                to="/reportes"
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg flex items-center gap-2 text-sm ${isActive ? "bg-slate-800/60 border border-cyan-500/40 text-cyan-300" : "text-gray-300 hover:text-white"}`
                }
              >
                <FileSpreadsheet className="w-4 h-4" /> Reportes
              </NavLink>
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            {!token ? (
              <Link
                className="px-3 py-2 rounded-lg flex items-center gap-2 text-gray-300 hover:text-white border border-cyan-500/30 bg-slate-900/40"
                to="/login"
              >
                <LogIn className="w-4 h-4 text-cyan-400" /> Login
              </Link>
            ) : (
              <button
                className="px-3 py-2 rounded-lg flex items-center gap-2 text-gray-300 hover:text-white border border-cyan-500/30 bg-slate-900/40"
                onClick={() => setToken("")}
              >
                <LogOut className="w-4 h-4 text-cyan-400" /> Salir
              </button>
            )}
          </div>
        </div>
        <div className="p-4">
          <Routes>
            <Route path="/login" element={<Login onToken={(t) => setToken(t)} />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <Dashboard token={token} />
                </RequireAuth>
              }
            />
            <Route
              path="/clientes"
              element={
                <RequireAuth>
                  <Clientes token={token} />
                </RequireAuth>
              }
            />
            <Route
              path="/productos"
              element={
                <RequireAuth>
                  <Productos token={token} />
                </RequireAuth>
              }
            />
            <Route
              path="/produccion"
              element={
                <RequireAuth>
                  <Produccion token={token} />
                </RequireAuth>
              }
            />
            <Route
              path="/compras"
              element={
                <RequireAuth>
                  <Compras token={token} />
                </RequireAuth>
              }
            />
            <Route
              path="/pedidos"
              element={
                <RequireAuth>
                  <Pedidos token={token} />
                </RequireAuth>
              }
            />
            <Route
              path="/proformas"
              element={
                <RequireAuth>
                  <Proformas token={token} />
                </RequireAuth>
              }
            />
            <Route
              path="/configuracion"
              element={
                <RequireAuth>
                  <Configuracion token={token} />
                </RequireAuth>
              }
            />
            <Route
              path="/reportes"
              element={
                <RequireAuth>
                  <Reportes token={token} />
                </RequireAuth>
              }
            />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </div>
    </ToastProvider>
  )
}
