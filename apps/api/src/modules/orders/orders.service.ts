import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  canTransition,
  type AddOrderItemInput,
  type CreateOrderInput,
  type OrderStatus,
  type TransitionOrderInput,
  type UpdateOrderHeaderInput,
  type UpdateOrderItemInput,
} from "@restaurant/shared";

import { SupabaseRequestService } from "../../shared/database/supabase-request.service";

// ---- Shared types ---------------------------------------------------------

export interface OrderItem {
  id: string;
  orderId: string;
  organizationId: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  organizationId: string;
  branchId: string;
  tableId: string | null;
  waiterUserId: string;
  orderNumber: number;
  status: OrderStatus;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  notes: string | null;
  openedAt: string;
  readyAt: string | null;
  deliveredAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

// ---- Row → domain mappers -------------------------------------------------

interface OrderRow {
  id: string;
  organization_id: string;
  branch_id: string;
  table_id: string | null;
  waiter_user_id: string;
  order_number: number;
  status: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  opened_at: string;
  ready_at: string | null;
  delivered_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

interface OrderItemRow {
  id: string;
  order_id: string;
  organization_id: string;
  product_id: string;
  product_name_snapshot: string;
  unit_price: number;
  quantity: number;
  line_total: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    organizationId: row.organization_id,
    branchId: row.branch_id,
    tableId: row.table_id,
    waiterUserId: row.waiter_user_id,
    orderNumber: row.order_number,
    status: row.status as OrderStatus,
    subtotal: Number(row.subtotal),
    discountAmount: Number(row.discount_amount),
    taxAmount: Number(row.tax_amount),
    total: Number(row.total),
    notes: row.notes,
    openedAt: row.opened_at,
    readyAt: row.ready_at,
    deliveredAt: row.delivered_at,
    paidAt: row.paid_at,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toOrderItem(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    organizationId: row.organization_id,
    productId: row.product_id,
    productName: row.product_name_snapshot,
    unitPrice: Number(row.unit_price),
    quantity: row.quantity,
    lineTotal: row.line_total === null ? 0 : Number(row.line_total),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface ListOptions {
  organizationId?: string;
  branchId?: string;
  status?: OrderStatus | "active";
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(private readonly supabase: SupabaseRequestService) {}

  // ===== Header CRUD =======================================================

  async list(opts: ListOptions = {}): Promise<Order[]> {
    let q = this.supabase.client
      .from("orders")
      .select("*")
      .order("opened_at", { ascending: false });

    if (opts.organizationId) q = q.eq("organization_id", opts.organizationId);
    if (opts.branchId) q = q.eq("branch_id", opts.branchId);

    if (opts.status === "active") {
      q = q.not("status", "in", "(paid,cancelled)");
    } else if (opts.status) {
      q = q.eq("status", opts.status);
    }

    const { data, error } = await q;
    if (error) throw new InternalServerErrorException(error.message);
    return data.map(toOrder);
  }

  async findOne(id: string): Promise<OrderWithItems> {
    const [orderRes, itemsRes] = await Promise.all([
      this.supabase.client.from("orders").select("*").eq("id", id).maybeSingle(),
      this.supabase.client
        .from("order_items")
        .select("*")
        .eq("order_id", id)
        .order("created_at", { ascending: true }),
    ]);

    if (orderRes.error) throw new InternalServerErrorException(orderRes.error.message);
    if (!orderRes.data) throw new NotFoundException(`Orden ${id} no encontrada.`);
    if (itemsRes.error) throw new InternalServerErrorException(itemsRes.error.message);

    return {
      ...toOrder(orderRes.data),
      items: itemsRes.data.map(toOrderItem),
    };
  }

  async create(input: CreateOrderInput, waiterUserId: string): Promise<Order> {
    const { data, error } = await this.supabase.client
      .from("orders")
      .insert({
        organization_id: input.organizationId,
        branch_id: input.branchId,
        table_id: input.tableId ?? null,
        waiter_user_id: waiterUserId,
        notes: input.notes ?? null,
        // status defaults to 'open' in DB; order_number assigned by trigger
        order_number: 0,
      })
      .select("*")
      .single();

    if (error) {
      this.logger.warn(`create order failed: ${error.message} (${error.code})`);
      if (error.code === "P0001") {
        throw new ConflictException(
          "La mesa o sucursal no pertenece a este restaurante.",
        );
      }
      throw new InternalServerErrorException(error.message);
    }
    return toOrder(data);
  }

  async updateHeader(id: string, input: UpdateOrderHeaderInput): Promise<Order> {
    const patch: Partial<OrderRow> = {};
    if (input.tableId !== undefined) patch.table_id = input.tableId;
    if (input.discountAmount !== undefined) patch.discount_amount = input.discountAmount;
    if (input.taxAmount !== undefined) patch.tax_amount = input.taxAmount;
    if (input.notes !== undefined) patch.notes = input.notes ?? null;

    const { data, error } = await this.supabase.client
      .from("orders")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException(`Orden ${id} no encontrada.`);
    return toOrder(data);
  }

  async remove(id: string): Promise<void> {
    const { error, count } = await this.supabase.client
      .from("orders")
      .delete({ count: "exact" })
      .eq("id", id);

    if (error) throw new InternalServerErrorException(error.message);
    if (count === 0) throw new NotFoundException(`Orden ${id} no encontrada.`);
  }

  // ===== Transitions =======================================================

  async transition(id: string, input: TransitionOrderInput): Promise<Order> {
    // Fetch current to give a clean error message instead of relying on the
    // trigger exception text leaking 'open -> paid'.
    const { data: current, error: currErr } = await this.supabase.client
      .from("orders")
      .select("status")
      .eq("id", id)
      .maybeSingle();
    if (currErr) throw new InternalServerErrorException(currErr.message);
    if (!current) throw new NotFoundException(`Orden ${id} no encontrada.`);

    const from = current.status as OrderStatus;
    const to = input.to as OrderStatus;
    if (!canTransition(from, to)) {
      throw new BadRequestException(
        `Transición inválida: ${from} → ${to}.`,
      );
    }

    const { data, error } = await this.supabase.client
      .from("orders")
      .update({ status: to })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      // The trigger may still raise if e.g. status changed between our
      // pre-check and the UPDATE. Map cleanly.
      if (error.message.includes("Invalid order status transition")) {
        throw new BadRequestException(error.message);
      }
      throw new InternalServerErrorException(error.message);
    }
    if (!data) throw new NotFoundException(`Orden ${id} no encontrada.`);
    return toOrder(data);
  }

  // ===== Items =============================================================

  async addItem(orderId: string, input: AddOrderItemInput): Promise<OrderItem> {
    // Snapshot product name + unit_price from products. The service uses
    // the per-request RLS client, so this read is also tenant-scoped.
    const { data: product, error: productErr } = await this.supabase.client
      .from("products")
      .select("organization_id, name, price, is_active")
      .eq("id", input.productId)
      .maybeSingle();

    if (productErr) throw new InternalServerErrorException(productErr.message);
    if (!product) {
      throw new NotFoundException(`Producto ${input.productId} no encontrado.`);
    }
    if (!product.is_active) {
      throw new ConflictException("El producto está inactivo.");
    }

    const { data, error } = await this.supabase.client
      .from("order_items")
      .insert({
        order_id: orderId,
        organization_id: product.organization_id,
        product_id: input.productId,
        product_name_snapshot: product.name,
        unit_price: input.unitPriceOverride ?? Number(product.price),
        quantity: input.quantity,
        notes: input.notes ?? null,
      })
      .select("*")
      .single();

    if (error) {
      this.logger.warn(`add order item failed: ${error.message} (${error.code})`);
      if (error.code === "P0001") {
        throw new ConflictException(
          "El producto no pertenece al mismo restaurante que la orden.",
        );
      }
      throw new InternalServerErrorException(error.message);
    }
    return toOrderItem(data);
  }

  async updateItem(itemId: string, input: UpdateOrderItemInput): Promise<OrderItem> {
    const patch: Partial<OrderItemRow> = {};
    if (input.quantity !== undefined) patch.quantity = input.quantity;
    if (input.notes !== undefined) patch.notes = input.notes ?? null;

    const { data, error } = await this.supabase.client
      .from("order_items")
      .update(patch)
      .eq("id", itemId)
      .select("*")
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException(`Ítem ${itemId} no encontrado.`);
    return toOrderItem(data);
  }

  async removeItem(itemId: string): Promise<void> {
    const { error, count } = await this.supabase.client
      .from("order_items")
      .delete({ count: "exact" })
      .eq("id", itemId);

    if (error) throw new InternalServerErrorException(error.message);
    if (count === 0) throw new NotFoundException(`Ítem ${itemId} no encontrado.`);
  }
}
