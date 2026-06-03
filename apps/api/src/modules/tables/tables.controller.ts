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
  CreateTableSchema,
  UpdateTableSchema,
  type CreateTableInput,
  type UpdateTableInput,
} from "@restaurant/shared";

import { AuthGuard } from "../../shared/auth/auth.guard";
import { ZodBodyPipe } from "../../shared/validation/zod-body.pipe";

import { TablesService } from "./tables.service";

@Controller("tables")
@UseGuards(AuthGuard)
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Get()
  list(
    @Query("organizationId") organizationId?: string,
    @Query("branchId") branchId?: string,
  ) {
    return this.tablesService.list({ organizationId, branchId });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body(new ZodBodyPipe(CreateTableSchema)) input: CreateTableInput) {
    return this.tablesService.create(input);
  }

  @Patch(":id")
  update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodBodyPipe(UpdateTableSchema)) input: UpdateTableInput,
  ) {
    return this.tablesService.update(id, input);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.tablesService.remove(id);
  }
}
