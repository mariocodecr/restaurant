import {
  BadRequestException,
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
  CreateIngredientSchema,
  CreateStockMovementSchema,
  UpdateIngredientSchema,
  type CreateIngredientInput,
  type CreateStockMovementInput,
  type UpdateIngredientInput,
} from "@restaurant/shared";

import type { AuthUser } from "../../shared/auth/auth-user";
import { AuthGuard } from "../../shared/auth/auth.guard";
import { CurrentUser } from "../../shared/auth/current-user.decorator";
import { ZodBodyPipe } from "../../shared/validation/zod-body.pipe";

import { IngredientsService } from "./ingredients.service";
import { StockService } from "./stock.service";

// One controller hosts both the /ingredients resource and the
// /stock-* resources to keep the inventory surface in one place.
@Controller()
@UseGuards(AuthGuard)
export class InventoryController {
  constructor(
    private readonly ingredients: IngredientsService,
    private readonly stock: StockService,
  ) {}

  // --- Ingredients ----------------------------------------------------

  @Get("ingredients")
  listIngredients(@Query("organizationId") organizationId?: string) {
    return this.ingredients.list(organizationId);
  }

  @Post("ingredients")
  @HttpCode(HttpStatus.CREATED)
  createIngredient(
    @Body(new ZodBodyPipe(CreateIngredientSchema)) input: CreateIngredientInput,
  ) {
    return this.ingredients.create(input);
  }

  @Patch("ingredients/:id")
  updateIngredient(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodBodyPipe(UpdateIngredientSchema)) input: UpdateIngredientInput,
  ) {
    return this.ingredients.update(id, input);
  }

  @Delete("ingredients/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteIngredient(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.ingredients.remove(id);
  }

  // --- Stock levels (read-only, per branch) ---------------------------

  @Get("stock-levels")
  listStockLevels(
    @Query("branchId") branchId?: string,
    @Query("organizationId") organizationId?: string,
  ) {
    if (!branchId || !organizationId) {
      throw new BadRequestException(
        "branchId and organizationId query params are required",
      );
    }
    return this.stock.listLevels(branchId, organizationId);
  }

  // --- Stock movements ------------------------------------------------

  @Get("stock-movements")
  listMovements(
    @Query("branchId") branchId?: string,
    @Query("ingredientId") ingredientId?: string,
    @Query("limit") limit?: string,
  ) {
    if (!branchId) {
      throw new BadRequestException("branchId query param is required");
    }
    const limitNum = limit ? Number(limit) : undefined;
    return this.stock.listMovements(branchId, {
      ingredientId,
      limit: Number.isFinite(limitNum) ? limitNum : undefined,
    });
  }

  @Post("stock-movements")
  @HttpCode(HttpStatus.CREATED)
  addMovement(
    @Body(new ZodBodyPipe(CreateStockMovementSchema)) input: CreateStockMovementInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.stock.addMovement(input, user.id);
  }

  @Delete("stock-movements/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMovement(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.stock.removeMovement(id);
  }
}
