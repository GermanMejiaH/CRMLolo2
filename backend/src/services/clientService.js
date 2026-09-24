import * as clientRepo from "../repositories/clientRepository.js"

export function listClients(filters = {}) {
  return clientRepo.listClients(filters)
}

export function countClients(filters = {}) {
  return clientRepo.countClients(filters)
}

export function getClient(id) {
  return clientRepo.getClientById(id)
}

export function addClient(data) {
  return clientRepo.addClientRecord(data)
}

export function updateClient(id, data) {
  return clientRepo.updateClientRecord(id, data)
}

export function getClientProductPrices(clientId) {
  return clientRepo.getClientProductPrices(clientId)
}

export function getClientProductPrice(clientId, productId) {
  return clientRepo.getClientProductPrice(clientId, productId)
}

export function setClientProductPrice(clientId, productId, price) {
  return clientRepo.setClientProductPrice(clientId, productId, price)
}

export function deleteClientProductPrice(clientId, productId) {
  return clientRepo.deleteClientProductPrice(clientId, productId)
}

export function getClientResumen360(clienteId) {
  return clientRepo.getClientResumen360Data(clienteId)
}
