import * as productRepo from "../repositories/productRepository.js"

export function listProducts(filters = {}) {
  return productRepo.listProducts(filters)
}

export function countProducts(filters = {}) {
  return productRepo.countProducts(filters)
}

export function getProduct(id) {
  return productRepo.getProductById(id)
}

export function addProduct(data) {
  return productRepo.addProductRecord(data)
}

export function updateProduct(id, data) {
  return productRepo.updateProductRecord(id, data)
}

export function deleteProduct(id) {
  return productRepo.deleteProductRecord(id)
}
