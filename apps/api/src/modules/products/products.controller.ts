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
  CreateProductSchema,
  UpdateProductSchema,
  type CreateProductInput,
  type UpdateProductInput,
} from "@restaurant/shared";

import { AuthGuard } from "../../shared/auth/auth.guard";
import { ZodBodyPipe } from "../../shared/validation/zod-body.pipe";

import { ProductsService } from "./products.service";

@Controller("products")
@UseGuards(AuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  list(
    @Query("organizationId") organizationId?: string,
    @Query("categoryId") categoryId?: string,
  ) {
    return this.productsService.list({ organizationId, categoryId });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new ZodBodyPipe(CreateProductSchema)) input: CreateProductInput,
  ) {
    return this.productsService.create(input);
  }

  @Patch(":id")
  update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodBodyPipe(UpdateProductSchema)) input: UpdateProductInput,
  ) {
    return this.productsService.update(id, input);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.productsService.remove(id);
  }
}
