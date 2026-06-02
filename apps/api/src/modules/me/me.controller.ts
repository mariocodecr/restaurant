import { Controller, Get, UseGuards } from "@nestjs/common";

import type { AuthUser } from "../../shared/auth/auth-user";
import { AuthGuard } from "../../shared/auth/auth.guard";
import { CurrentUser } from "../../shared/auth/current-user.decorator";

import { MeService, type Membership } from "./me.service";

interface MeResponse {
  user: AuthUser;
  memberships: Membership[];
}

@Controller("me")
@UseGuards(AuthGuard)
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get()
  async getMe(@CurrentUser() user: AuthUser): Promise<MeResponse> {
    const memberships = await this.meService.getMemberships();
    return { user, memberships };
  }
}
