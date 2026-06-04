import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from "@nestjs/common";
import {
  UpdateInvoiceCustomerSchema,
  type UpdateInvoiceCustomerInput,
} from "@restaurant/shared";

import { AuthGuard } from "../../shared/auth/auth.guard";
import { ZodBodyPipe } from "../../shared/validation/zod-body.pipe";

import { InvoicesService } from "./invoices.service";

@Controller()
@UseGuards(AuthGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get("orders/:orderId/invoice")
  findForOrder(@Param("orderId", new ParseUUIDPipe()) orderId: string) {
    return this.invoicesService.findForOrder(orderId);
  }

  @Patch("invoices/:id")
  updateCustomer(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodBodyPipe(UpdateInvoiceCustomerSchema))
    input: UpdateInvoiceCustomerInput,
  ) {
    return this.invoicesService.updateCustomer(id, input);
  }
}
