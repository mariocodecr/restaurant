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
  AddMembershipSchema,
  UpdateMembershipSchema,
  type AddMembershipInput,
  type UpdateMembershipInput,
} from "@restaurant/shared";

import { AuthGuard } from "../../shared/auth/auth.guard";
import { ZodBodyPipe } from "../../shared/validation/zod-body.pipe";

import { MembershipsService } from "./memberships.service";

@Controller("memberships")
@UseGuards(AuthGuard)
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Get()
  list(@Query("organizationId") organizationId?: string) {
    if (!organizationId) {
      throw new BadRequestException("organizationId query param is required");
    }
    return this.membershipsService.listForOrg(organizationId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  add(@Body(new ZodBodyPipe(AddMembershipSchema)) input: AddMembershipInput) {
    return this.membershipsService.add(input);
  }

  @Patch(":id")
  update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodBodyPipe(UpdateMembershipSchema)) input: UpdateMembershipInput,
  ) {
    return this.membershipsService.update(id, input);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.membershipsService.remove(id);
  }
}
