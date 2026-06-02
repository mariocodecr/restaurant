# Restaurant ERP SaaS

Sistema multi-tenant de gestión integral para restaurantes: POS, cocina en tiempo real, inventario, proveedores, facturación, reportes y módulo de IA.

## Stack

- **Frontend**: Next.js 15 (App Router) + TypeScript + TailwindCSS 4
- **Backend**: NestJS + TypeScript (Clean Architecture)
- **Database**: Supabase PostgreSQL (Row Level Security)
- **Auth**: Supabase Auth (JWT + memberships)
- **Realtime**: Supabase Realtime + WebSockets
- **Arquitectura**: Multi-tenant SaaS (shared schema + RLS)

## Estructura del monorepo

```
restaurant/
├── apps/
│   ├── web/          # Next.js (frontend)
│   └── api/          # NestJS (backend)
├── packages/
│   ├── shared/       # Tipos compartidos, DTOs, validaciones (Zod)
│   └── database/     # Migraciones SQL, tipos generados de Supabase
└── docs/             # Documentación arquitectónica
```

## Roles

| Rol | Capacidades |
|-----|-------------|
| **Dueño** | Acceso total: reportes, ventas, ganancias, costos, sucursales, usuarios, métricas globales |
| **Administrador** | Menú, mesas, inventario, proveedores, empleados, reportes operativos |
| **Mesero** | Mapa de mesas, abrir mesas, crear/modificar órdenes, dividir cuentas, solicitar cobro |
| **Cocina** | Ver órdenes pendientes, cambiar estado (pendiente → preparando → listo → entregado) |

## Módulos

- Autenticación y RBAC multi-tenant
- Gestión de restaurantes y sucursales
- Mapa visual de mesas con estados en tiempo real
- Órdenes con FSM (open → preparing → ready → delivered → paid)
- Dashboard de cocina (KDS) en tiempo real
- Menú: categorías, productos, modificadores
- Inventario: ingredientes, recetas, stock_movements, descuento automático
- Proveedores y órdenes de compra
- Facturación: impuestos, descuentos, división de cuentas, métodos de pago
- Reportes: ventas, productos, inventario, finanzas, empleados
- IA: predicción de inventario/ventas + asistente conversacional

## Estado

🚧 En construcción. Ver [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) para el diseño completo.
