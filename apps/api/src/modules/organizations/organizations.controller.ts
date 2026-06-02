import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  CreateOrganizationSchema,
  type CreateOrganizationInput,
} from "@restaurant/shared";

import { AuthGuard } from "../../shared/auth/auth.guard";
import { ZodBodyPipe } from "../../shared/validation/zod-body.pipe";

import { OrganizationsService } from "./organizations.service";

@Controller("organizations")
@UseGuards(AuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new ZodBodyPipe(CreateOrganizationSchema))
    input: CreateOrganizationInput,
  ) {
    return this.organizationsService.createWithFirstBranch(input);
  }
}
