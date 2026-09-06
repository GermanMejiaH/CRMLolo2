import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import Clientes from "../src/pages/Clientes"
import Productos from "../src/pages/Productos"
import { ToastProvider } from "../src/components/ToastContext"
import * as clientApi from "../src/api/client"

vi.mock("../src/api/client")

describe("Estados vacíos en Frontend con opción de ver inactivos", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    clientApi.getProductos.mockResolvedValue([])
  })

  it("Muestra estado vacío claro en Clientes y renderiza el cliente inactivo tras pulsar el botón", async () => {
    clientApi.getClientesPaged.mockImplementation((_token, params) => {
      if (params.includeInactive) {
        return Promise.resolve({
          items: [
            {
              id: 99,
              nombre: "Cliente Inactivo Test",
              active: 0,
              activo: 0,
              email: "inactivo@test.com",
              createdAt: "2026-01-01T00:00:00.000Z"
            }
          ],
          total: 1
        })
      }
      return Promise.resolve({ items: [], total: 0 })
    })

    render(
      <ToastProvider>
        <Clientes token="fake-jwt-token" />
      </ToastProvider>
    )

    await waitFor(() => {
      expect(screen.getByText("No hay clientes activos registrados")).toBeTruthy()
    })

    const button = screen.getByRole("button", { name: /Ver clientes inactivos/i })
    expect(button).toBeTruthy()

    fireEvent.click(button)

    // Verificar invocación de API con includeInactive
    await waitFor(() => {
      expect(clientApi.getClientesPaged).toHaveBeenCalledWith(
        "fake-jwt-token",
        expect.objectContaining({ includeInactive: true })
      )
    })

    // Verificar que el registro inactivo se renderiza efectivamente en la UI
    await waitFor(() => {
      expect(screen.getByText("Cliente Inactivo Test")).toBeTruthy()
    })
  })

  it("Muestra estado vacío claro en Productos y renderiza el producto inactivo tras pulsar el botón", async () => {
    clientApi.getProductosPaged.mockImplementation((_token, params) => {
      if (params.includeInactive) {
        return Promise.resolve({
          items: [
            {
              id: 88,
              nombre: "Producto Inactivo Test",
              active: 0,
              activo: 0,
              precioMinimo: 10,
              precioMaximo: 20,
              stockActual: 5,
              stockMinimo: 2,
              createdAt: "2026-01-01T00:00:00.000Z"
            }
          ],
          total: 1
        })
      }
      return Promise.resolve({ items: [], total: 0 })
    })

    render(
      <ToastProvider>
        <Productos token="fake-jwt-token" />
      </ToastProvider>
    )

    await waitFor(() => {
      expect(screen.getByText("No hay productos activos registrados")).toBeTruthy()
    })

    const button = screen.getByRole("button", { name: /Ver productos inactivos/i })
    expect(button).toBeTruthy()

    fireEvent.click(button)

    // Verificar invocación de API con includeInactive
    await waitFor(() => {
      expect(clientApi.getProductosPaged).toHaveBeenCalledWith(
        "fake-jwt-token",
        expect.objectContaining({ includeInactive: true })
      )
    })

    // Verificar que el registro inactivo se renderiza efectivamente en la UI
    await waitFor(() => {
      expect(screen.getByText("Producto Inactivo Test")).toBeTruthy()
    })
  })
})
