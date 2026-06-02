import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import type { CreateOrganizationInput } from "@restaurant/shared";

import { SupabaseRequestService } from "../../shared/database/supabase-request.service";

interface CreatedOrganization {
  id: string;
  name: string;
  slug: string;
  currency: string;
  timezone: string;
  tax_id: string | null;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
}

interface CreatedBranch {
  id: string;
  organization_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  timezone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CreateOrgRpcResult {
  organization: CreatedOrganization;
  branch: CreatedBranch;
}

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(private readonly supabase: SupabaseRequestService) {}

  async createWithFirstBranch(
    input: CreateOrganizationInput,
  ): Promise<CreateOrgRpcResult> {
    const { data, error } = await this.supabase.client.rpc(
      "create_organization_with_branch",
      {
        org_name: input.name,
        org_slug: input.slug,
        org_currency: input.currency,
        org_timezone: input.timezone,
        org_tax_id: input.taxId ?? "",
        branch_name: input.firstBranch.name,
        branch_address: input.firstBranch.address ?? "",
        branch_phone: input.firstBranch.phone ?? "",
        branch_timezone: input.firstBranch.timezone ?? "",
      },
    );

    if (error) {
      this.logger.warn(
        `create_organization_with_branch RPC failed: ${error.message} (code=${error.code})`,
      );
      // Postgres unique_violation
      if (error.code === "23505") {
        throw new ConflictException(
          "Ya existe una organización con ese slug. Probá otro.",
        );
      }
      throw new InternalServerErrorException(error.message);
    }

    return data as unknown as CreateOrgRpcResult;
  }
}
