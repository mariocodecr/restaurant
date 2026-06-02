import { Injectable } from "@nestjs/common";

import { SupabaseRequestService } from "../../shared/database/supabase-request.service";

export interface Membership {
  organizationId: string;
  branchId: string | null;
  role: string;
}

@Injectable()
export class MeService {
  constructor(private readonly supabase: SupabaseRequestService) {}

  async getMemberships(): Promise<Membership[]> {
    const { data, error } = await this.supabase.client
      .from("memberships")
      .select("organization_id, branch_id, role")
      .eq("is_active", true);

    if (error) {
      throw new Error(`Failed to load memberships: ${error.message}`);
    }

    return data.map((row) => ({
      organizationId: row.organization_id,
      branchId: row.branch_id,
      role: row.role,
    }));
  }
}
