import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type { AddPaymentInput } from "@restaurant/shared";

import { SupabaseRequestService } from "../../shared/database/supabase-request.service";

export interface Payment {
  id: string;
  orderId: string;
  organizationId: string;
  method: string;
  amount: number;
  reference: string | null;
  receivedByUserId: string;
  createdAt: string;
  updatedAt: string;
}

interface PaymentRow {
  id: string;
  order_id: string;
  organization_id: string;
  method: string;
  amount: number;
  reference: string | null;
  received_by_user_id: string;
  created_at: string;
  updated_at: string;
}

function toPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    orderId: row.order_id,
    organizationId: row.organization_id,
    method: row.method,
    amount: Number(row.amount),
    reference: row.reference,
    receivedByUserId: row.received_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly supabase: SupabaseRequestService) {}

  async listForOrder(orderId: string): Promise<Payment[]> {
    const { data, error } = await this.supabase.client
      .from("payments")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return data.map(toPayment);
  }

  async addForOrder(
    orderId: string,
    input: AddPaymentInput,
    receivedByUserId: string,
  ): Promise<Payment> {
    // Pull the order to copy its organization_id (RLS-scoped fetch).
    const { data: order, error: orderErr } = await this.supabase.client
      .from("orders")
      .select("organization_id, status, total")
      .eq("id", orderId)
      .maybeSingle();
    if (orderErr) throw new InternalServerErrorException(orderErr.message);
    if (!order) throw new NotFoundException(`Orden ${orderId} no encontrada.`);

    if (order.status === "cancelled") {
      throw new ConflictException("La orden está cancelada.");
    }
    if (order.status === "paid") {
      throw new ConflictException("La orden ya está pagada.");
    }

    const { data, error } = await this.supabase.client
      .from("payments")
      .insert({
        order_id: orderId,
        organization_id: order.organization_id,
        method: input.method,
        amount: input.amount,
        reference: input.reference ?? null,
        received_by_user_id: receivedByUserId,
      })
      .select("*")
      .single();

    if (error) {
      this.logger.warn(`add payment failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException(error.message);
    }
    return toPayment(data);
  }

  async remove(orderId: string, paymentId: string): Promise<void> {
    const { error, count } = await this.supabase.client
      .from("payments")
      .delete({ count: "exact" })
      .eq("id", paymentId)
      .eq("order_id", orderId);

    if (error) throw new InternalServerErrorException(error.message);
    if (count === 0) {
      throw new NotFoundException(`Pago ${paymentId} no encontrado.`);
    }
  }
}
