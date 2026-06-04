import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type {
  AddMembershipInput,
  UpdateMembershipInput,
} from "@restaurant/shared";

import { SupabaseRequestService } from "../../shared/database/supabase-request.service";

export interface MemberRow {
  membershipId: string;
  userId: string;
  email: string;
  fullName: string | null;
  role: string;
  branchId: string | null;
  isActive: boolean;
  createdAt: string;
}

interface RawMemberRow {
  membership_id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  branch_id: string | null;
  is_active: boolean;
  created_at: string;
}

function toMember(row: RawMemberRow): MemberRow {
  return {
    membershipId: row.membership_id,
    userId: row.user_id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    branchId: row.branch_id,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

@Injectable()
export class MembershipsService {
  private readonly logger = new Logger(MembershipsService.name);

  constructor(private readonly supabase: SupabaseRequestService) {}

  async listForOrg(organizationId: string): Promise<MemberRow[]> {
    const { data, error } = await this.supabase.client.rpc("list_org_members", {
      target_org_id: organizationId,
    });
    if (error) throw new InternalServerErrorException(error.message);
    return (data as RawMemberRow[]).map(toMember);
  }

  async add(input: AddMembershipInput): Promise<MemberRow> {
    // Step 1 — find the Supabase Auth user by email.
    const { data: userId, error: findErr } = await this.supabase.client.rpc(
      "find_user_by_email",
      { target_email: input.email },
    );
    if (findErr) throw new InternalServerErrorException(findErr.message);
    if (!userId) {
      throw new NotFoundException(
        `No hay un usuario registrado con ${input.email}. Pedile que se cree una cuenta primero (en /signup), después agregalo acá.`,
      );
    }

    // Step 2 — insert the membership. RLS gates this to managers of the
    // target org, so a waiter calling this won't succeed.
    const { data, error } = await this.supabase.client
      .from("memberships")
      .insert({
        user_id: userId as string,
        organization_id: input.organizationId,
        role: input.role,
        branch_id: input.branchId ?? null,
      })
      .select("id")
      .single();

    if (error) {
      this.logger.warn(`add membership failed: ${error.message} (${error.code})`);
      if (error.code === "23505") {
        throw new ConflictException(
          "Esa persona ya tiene esa misma asignación en este restaurante.",
        );
      }
      if (error.code === "42501") {
        throw new ConflictException(
          "Solo el dueño o un administrador pueden agregar miembros.",
        );
      }
      throw new InternalServerErrorException(error.message);
    }

    // Re-fetch via list_org_members to get the joined user info.
    const members = await this.listForOrg(input.organizationId);
    const created = members.find((m) => m.membershipId === data.id);
    if (!created) {
      throw new InternalServerErrorException(
        "El miembro se creó pero no se pudo leer.",
      );
    }
    return created;
  }

  async update(
    membershipId: string,
    input: UpdateMembershipInput,
  ): Promise<MemberRow> {
    const patch: {
      role?: string;
      branch_id?: string | null;
      is_active?: boolean;
    } = {};
    if (input.role !== undefined) patch.role = input.role;
    if (input.branchId !== undefined) patch.branch_id = input.branchId ?? null;
    if (input.isActive !== undefined) patch.is_active = input.isActive;

    const { data, error } = await this.supabase.client
      .from("memberships")
      .update(patch)
      .eq("id", membershipId)
      .select("organization_id, id")
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);
    if (!data) {
      throw new NotFoundException(`Miembro ${membershipId} no encontrado.`);
    }

    const members = await this.listForOrg(data.organization_id);
    const updated = members.find((m) => m.membershipId === data.id);
    if (!updated) {
      throw new InternalServerErrorException(
        "El miembro se actualizó pero no se pudo leer.",
      );
    }
    return updated;
  }

  async remove(membershipId: string): Promise<void> {
    // Don't let someone delete the LAST owner of an org — they'd lock
    // themselves out of management. Check first, then delete.
    const { data: target, error: lookupErr } = await this.supabase.client
      .from("memberships")
      .select("organization_id, role")
      .eq("id", membershipId)
      .maybeSingle();
    if (lookupErr) throw new InternalServerErrorException(lookupErr.message);
    if (!target) {
      throw new NotFoundException(`Miembro ${membershipId} no encontrado.`);
    }

    if (target.role === "owner") {
      const { count, error: countErr } = await this.supabase.client
        .from("memberships")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", target.organization_id)
        .eq("role", "owner")
        .eq("is_active", true);
      if (countErr) throw new InternalServerErrorException(countErr.message);
      if ((count ?? 0) <= 1) {
        throw new BadRequestException(
          "No se puede quitar al único dueño activo. Asigná a otra persona como dueño primero.",
        );
      }
    }

    const { error, count } = await this.supabase.client
      .from("memberships")
      .delete({ count: "exact" })
      .eq("id", membershipId);
    if (error) throw new InternalServerErrorException(error.message);
    if (count === 0) {
      throw new NotFoundException(`Miembro ${membershipId} no encontrado.`);
    }
  }
}
