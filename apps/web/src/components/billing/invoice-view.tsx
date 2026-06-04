"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

interface InvoiceRow {
  id: string;
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

interface OrderRow {
  id: string;
  order_number: number;
  notes: string | null;
}

interface ItemRow {
  id: string;
  product_name_snapshot: string;
  unit_price: number;
  quantity: number;
  line_total: number | null;
}

interface PaymentRow {
  id: string;
  method: string;
  amount: number;
  reference: string | null;
}

interface OrgRow {
  name: string;
  tax_id: string | null;
}

interface InvoiceViewProps {
  invoice: InvoiceRow;
  order: OrderRow;
  items: ItemRow[];
  payments: PaymentRow[];
  organization: OrgRow;
  tableName: string | null;
}

const METHOD_LABEL: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  other: "Otro",
};

export function InvoiceView({
  invoice,
  order,
  items,
  payments,
  organization,
  tableName,
}: InvoiceViewProps) {
  return (
    <div className="invoice-page">
      {/* Toolbar — hidden on print */}
      <div className="invoice-toolbar flex items-center justify-between gap-3 px-6 py-4 print:hidden">
        <Link
          href="/facturacion"
          className="inline-flex items-center gap-2 text-sm text-[--cream]/60 hover:text-[--cream]"
        >
          <ArrowLeft className="size-4" />
          Volver a facturación
        </Link>
        <Button type="button" onClick={() => window.print()}>
          <Printer className="size-4" />
          Imprimir
        </Button>
      </div>

      <article className="invoice-sheet">
        <header className="invoice-header">
          <div>
            <p className="invoice-eyebrow">Factura</p>
            <h1 className="invoice-number">
              F-{String(invoice.invoice_number).padStart(6, "0")}
            </h1>
            <p className="invoice-meta">
              Emitida el{" "}
              {new Date(invoice.issued_at).toLocaleString("es-CR", {
                dateStyle: "long",
                timeStyle: "short",
              })}
            </p>
          </div>
          <div className="invoice-org">
            <p className="invoice-org-name">{organization.name}</p>
            {organization.tax_id ? (
              <p className="invoice-meta">Cédula jurídica: {organization.tax_id}</p>
            ) : null}
          </div>
        </header>

        <section className="invoice-grid">
          <div>
            <h2 className="invoice-section-title">Cliente</h2>
            <p className="invoice-text">
              {invoice.customer_name ?? <span className="invoice-muted">Consumidor final</span>}
            </p>
            {invoice.customer_tax_id ? (
              <p className="invoice-meta">{invoice.customer_tax_id}</p>
            ) : null}
          </div>
          <div>
            <h2 className="invoice-section-title">Orden</h2>
            <p className="invoice-text">
              #{order.order_number}
              {tableName ? ` · ${tableName}` : ""}
            </p>
            {order.notes ? <p className="invoice-meta">{order.notes}</p> : null}
          </div>
        </section>

        <table className="invoice-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th className="numeric">Cant.</th>
              <th className="numeric">Precio</th>
              <th className="numeric">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td>{it.product_name_snapshot}</td>
                <td className="numeric">{it.quantity}</td>
                <td className="numeric">{formatMoney(Number(it.unit_price))}</td>
                <td className="numeric">{formatMoney(Number(it.line_total ?? 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="invoice-totals">
          <Row label="Subtotal" value={Number(invoice.subtotal)} currency={invoice.currency} />
          <Row
            label="Descuento"
            value={-Number(invoice.discount_amount)}
            currency={invoice.currency}
          />
          <Row label="Impuestos" value={Number(invoice.tax_amount)} currency={invoice.currency} />
          <Row
            label="Total"
            value={Number(invoice.total)}
            currency={invoice.currency}
            bold
          />
        </section>

        {payments.length > 0 ? (
          <section className="invoice-payments">
            <h2 className="invoice-section-title">Pagos</h2>
            <ul>
              {payments.map((p) => (
                <li key={p.id}>
                  <span>
                    {METHOD_LABEL[p.method] ?? p.method}
                    {p.reference ? ` · ${p.reference}` : ""}
                  </span>
                  <span>{formatMoney(Number(p.amount))}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <footer className="invoice-footer">
          ¡Gracias por su visita!
        </footer>
      </article>

      <style jsx>{`
        .invoice-page {
          min-height: 100vh;
        }
        .invoice-sheet {
          max-width: 760px;
          margin: 0 auto;
          padding: 48px;
          background: white;
          color: #1a1611;
          box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.5);
          border-radius: 16px;
          margin-bottom: 60px;
        }
        .invoice-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          padding-bottom: 24px;
          border-bottom: 1px solid #e9d295;
        }
        .invoice-eyebrow {
          font-size: 11px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #8a6532;
          margin: 0;
        }
        .invoice-number {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 28px;
          font-weight: 600;
          color: #b58543;
          margin: 4px 0;
        }
        .invoice-meta {
          font-size: 12px;
          color: #6b5e49;
          margin: 0;
        }
        .invoice-org {
          text-align: right;
        }
        .invoice-org-name {
          font-size: 18px;
          font-weight: 600;
          margin: 0;
        }
        .invoice-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 32px;
          padding: 24px 0;
          border-bottom: 1px solid #e9d295;
        }
        .invoice-section-title {
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #8a6532;
          margin: 0 0 6px;
          font-weight: 600;
        }
        .invoice-text {
          font-size: 15px;
          font-weight: 500;
          margin: 0;
        }
        .invoice-muted {
          color: #6b5e49;
          font-style: italic;
        }
        .invoice-table {
          width: 100%;
          border-collapse: collapse;
          margin: 24px 0;
          font-size: 14px;
        }
        .invoice-table thead th {
          text-align: left;
          padding: 8px 0;
          border-bottom: 2px solid #b58543;
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #8a6532;
          font-weight: 600;
        }
        .invoice-table tbody td {
          padding: 10px 0;
          border-bottom: 1px solid #f3e7c5;
        }
        .invoice-table .numeric {
          text-align: right;
          font-variant-numeric: tabular-nums;
        }
        .invoice-totals {
          margin-top: 12px;
          display: grid;
          row-gap: 6px;
          max-width: 320px;
          margin-left: auto;
        }
        .invoice-payments {
          margin-top: 32px;
          padding-top: 16px;
          border-top: 1px solid #e9d295;
        }
        .invoice-payments ul {
          list-style: none;
          padding: 0;
          margin: 6px 0 0;
        }
        .invoice-payments li {
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
          font-size: 14px;
        }
        .invoice-footer {
          margin-top: 48px;
          padding-top: 24px;
          border-top: 1px solid #e9d295;
          text-align: center;
          font-size: 13px;
          color: #6b5e49;
          font-style: italic;
        }
        @media print {
          .invoice-page {
            background: white !important;
          }
          .invoice-sheet {
            box-shadow: none;
            margin: 0;
            border-radius: 0;
            max-width: none;
            padding: 24px;
          }
        }
      `}</style>
    </div>
  );
}

function Row({
  label,
  value,
  currency,
  bold,
}: {
  label: string;
  value: number;
  currency: string;
  bold?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontWeight: bold ? 700 : 500,
        fontSize: bold ? 18 : 14,
        paddingTop: bold ? 8 : 0,
        marginTop: bold ? 6 : 0,
        borderTop: bold ? "1px solid #e9d295" : "none",
      }}
    >
      <span>{label}</span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>
        {currency} {formatMoney(value)}
      </span>
    </div>
  );
}

function formatMoney(value: number): string {
  return value.toLocaleString("es-CR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
