import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import type { UpdateInvoiceCustomerInput } from "@restaurant/shared";

import { SupabaseRequestService } from "../../shared/database/supabase-request.service";

export interface Invoice {
  id: string;
  organizationId: string;
  orderId: string;
  invoiceNumber: number;
  customerName: string | null;
  customerTaxId: string | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  currency: string;
  issuedAt: string;
}

interface InvoiceRow {
  id: string;
  organization_id: string;
  order_id: string;
  invoice_number: number;
  customer_name: string | null;
  customer_tax_id: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  currency: string;
  issued_at: string;
}

function toInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    organizationId: row.organization_id,
    orderId: row.order_id,
    invoiceNumber: row.invoice_number,
    customerName: row.customer_name,
    customerTaxId: row.customer_tax_id,
    subtotal: Number(row.subtotal),
    discountAmount: Number(row.discount_amount),
    taxAmount: Number(row.tax_amount),
    total: Number(row.total),
    currency: row.currency,
    issuedAt: row.issued_at,
  };
}

@Injectable()
export class InvoicesService {
  constructor(private readonly supabase: SupabaseRequestService) {}

  async findForOrder(orderId: string): Promise<Invoice> {
    const { data, error } = await this.supabase.client
      .from("invoices")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle();
    if (error) throw new InternalServerErrorException(error.message);
    if (!data) {
      throw new NotFoundException(
        `Esta orden todavía no tiene factura — se genera cuando se marca como pagada.`,
      );
    }
    return toInvoice(data);
  }

  async updateCustomer(
    id: string,
    input: UpdateInvoiceCustomerInput,
  ): Promise<Invoice> {
    const patch: Partial<InvoiceRow> = {};
    if (input.customerName !== undefined) patch.customer_name = input.customerName;
    if (input.customerTaxId !== undefined) patch.customer_tax_id = input.customerTaxId;

    const { data, error } = await this.supabase.client
      .from("invoices")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException(`Factura ${id} no encontrada.`);
    return toInvoice(data);
  }
}
