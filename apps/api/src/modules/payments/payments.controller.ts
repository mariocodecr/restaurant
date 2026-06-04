import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  AddPaymentSchema,
  type AddPaymentInput,
} from "@restaurant/shared";

import type { AuthUser } from "../../shared/auth/auth-user";
import { AuthGuard } from "../../shared/auth/auth.guard";
import { CurrentUser } from "../../shared/auth/current-user.decorator";
import { ZodBodyPipe } from "../../shared/validation/zod-body.pipe";

import { PaymentsService } from "./payments.service";

@Controller("orders/:orderId/payments")
@UseGuards(AuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  list(@Param("orderId", new ParseUUIDPipe()) orderId: string) {
    return this.paymentsService.listForOrder(orderId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  add(
    @Param("orderId", new ParseUUIDPipe()) orderId: string,
    @Body(new ZodBodyPipe(AddPaymentSchema)) input: AddPaymentInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.paymentsService.addForOrder(orderId, input, user.id);
  }

  @Delete(":paymentId")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param("orderId", new ParseUUIDPipe()) orderId: string,
    @Param("paymentId", new ParseUUIDPipe()) paymentId: string,
  ) {
    return this.paymentsService.remove(orderId, paymentId);
  }
}
