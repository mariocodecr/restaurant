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
  CreateCategorySchema,
  UpdateCategorySchema,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from "@restaurant/shared";

import { AuthGuard } from "../../shared/auth/auth.guard";
import { ZodBodyPipe } from "../../shared/validation/zod-body.pipe";

import { CategoriesService } from "./categories.service";

@Controller("categories")
@UseGuards(AuthGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  list(@Query("organizationId") organizationId?: string) {
    return this.categoriesService.list(organizationId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new ZodBodyPipe(CreateCategorySchema)) input: CreateCategoryInput,
  ) {
    return this.categoriesService.create(input);
  }

  @Patch(":id")
  update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodBodyPipe(UpdateCategorySchema)) input: UpdateCategoryInput,
  ) {
    return this.categoriesService.update(id, input);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.categoriesService.remove(id);
  }
}
