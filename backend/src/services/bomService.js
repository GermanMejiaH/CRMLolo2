import * as inventoryRepo from "../repositories/inventoryRepository.js"
import { checkAssemblyAvailability as checkAvail, getCapacidadEnsambladoTeorica as getCap } from "./inventoryService.js"
import { logActivity } from "../utils/logger.js"

export function getBom(productoTerminadoId) {
  return inventoryRepo.getBom(productoTerminadoId)
}

export function setBom(productoTerminadoId, items) {
  const result = inventoryRepo.setBomRecord(productoTerminadoId, items)
  logActivity("RECETA_BOM_ACTUALIZADA", { productoTerminadoId, itemsCount: items?.length })
  return result
}

export function checkAssemblyAvailability(productoTerminadoId, cantidadProducida) {
  return checkAvail(productoTerminadoId, cantidadProducida)
}

export function getCapacidadEnsambladoTeorica(productoTerminadoId) {
  return getCap(productoTerminadoId)
}
