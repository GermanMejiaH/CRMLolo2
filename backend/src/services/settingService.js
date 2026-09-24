import * as settingRepo from "../repositories/settingRepository.js"
import { logActivity } from "../utils/logger.js"

export function getCostoManoObraUnitaria() {
  const val = settingRepo.getSetting("costo_mano_obra_unitaria", "1000")
  return Number(val) || 1000
}

export function setCostoManoObraUnitaria(valor) {
  const num = Number(valor)
  if (isNaN(num) || num < 0) {
    throw new Error("El costo de mano de obra debe ser un número mayor o igual a 0")
  }
  settingRepo.setSetting("costo_mano_obra_unitaria", String(num))
  logActivity("CONFIGURACION_MANO_OBRA_ACTUALIZADA", { nuevoValor: num })
  return num
}

export function getSettings() {
  const all = settingRepo.getAllSettings()
  return {
    costoManoObraUnitaria: Number(all.costo_mano_obra_unitaria || 1000)
  }
}

export function updateSettings(data = {}) {
  if (data.costoManoObraUnitaria != null) {
    setCostoManoObraUnitaria(data.costoManoObraUnitaria)
  }
  return getSettings()
}
