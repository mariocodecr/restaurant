import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  AddOrderItemSchema,
  CreateOrderSchema,
  TransitionOrderSchema,
  UpdateOrderHeaderSchema,
  UpdateOrderItemSchema,
  type AddOrderItemInput,
  type CreateOrderInput,
  type OrderStatus,
  type TransitionOrderInput,
  type UpdateOrderHeaderInput,
  type UpdateOrderItemInput,
} from "@restaurant/shared";

import type { AuthUser } from "../../shared/auth/auth-user";
import { AuthGuard } from "../../shared/auth/auth.guard";
import { CurrentUser } from "../../shared/auth/current-user.decorator";
import { ZodBodyPipe } from "../../shared/validation/zod-body.pipe";

import { OrdersService } from "./orders.service";

@Controller("orders")
@UseGuards(AuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  list(
    @Query("organizationId") organizationId?: string,
    @Query("branchId") branchId?: string,
    @Query("status") status?: string,
  ) {
    return this.ordersService.list({
      organizationId,
      branchId,
      status: status as OrderStatus | "active" | undefined,
    });
  }

  @Get(":id")
  findOne(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.ordersService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new ZodBodyPipe(CreateOrderSchema)) input: CreateOrderInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ordersService.create(input, user.id);
  }

  @Patch(":id")
  update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodBodyPipe(UpdateOrderHeaderSchema)) input: UpdateOrderHeaderInput,
  ) {
    return this.ordersService.updateHeader(id, input);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.ordersService.remove(id);
  }

  // --- Transitions --------------------------------------------------------

  @Post(":id/transitions")
  transition(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodBodyPipe(TransitionOrderSchema)) input: TransitionOrderInput,
  ) {
    return this.ordersService.transition(id, input);
  }

  // --- Items --------------------------------------------------------------

  @Post(":id/items")
  @HttpCode(HttpStatus.CREATED)
  addItem(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodBodyPipe(AddOrderItemSchema)) input: AddOrderItemInput,
  ) {
    return this.ordersService.addItem(id, input);
  }

  @Patch(":id/items/:itemId")
  updateItem(
    @Param("itemId", new ParseUUIDPipe()) itemId: string,
    @Body(new ZodBodyPipe(UpdateOrderItemSchema)) input: UpdateOrderItemInput,
  ) {
    return this.ordersService.updateItem(itemId, input);
  }

  @Delete(":id/items/:itemId")
  @HttpCode(HttpStatus.NO_CONTENT)
  removeItem(@Param("itemId", new ParseUUIDPipe()) itemId: string) {
    return this.ordersService.removeItem(itemId);
  }
}
