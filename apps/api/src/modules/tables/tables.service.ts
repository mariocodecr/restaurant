import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type {
  CreateTableInput,
  UpdateTableInput,
} from "@restaurant/shared";

import { SupabaseRequestService } from "../../shared/database/supabase-request.service";

export interface Table {
  id: string;
  organizationId: string;
  branchId: string;
  name: string;
  capacity: number;
  status: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface TableRow {
  id: string;
  organization_id: string;
  branch_id: string;
  name: string;
  capacity: number;
  status: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function toTable(row: TableRow): Table {
  return {
    id: row.id,
    organizationId: row.organization_id,
    branchId: row.branch_id,
    name: row.name,
    capacity: row.capacity,
    status: row.status,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface ListOptions {
  organizationId?: string;
  branchId?: string;
}

@Injectable()
export class TablesService {
  private readonly logger = new Logger(TablesService.name);

  constructor(private readonly supabase: SupabaseRequestService) {}

  async list(opts: ListOptions = {}): Promise<Table[]> {
    let query = this.supabase.client
      .from("tables")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (opts.organizationId) query = query.eq("organization_id", opts.organizationId);
    if (opts.branchId) query = query.eq("branch_id", opts.branchId);

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(error.message);
    return data.map(toTable);
  }

  async create(input: CreateTableInput): Promise<Table> {
    const { data, error } = await this.supabase.client
      .from("tables")
      .insert({
        organization_id: input.organizationId,
        branch_id: input.branchId,
        name: input.name,
        capacity: input.capacity ?? 4,
        status: input.status ?? "available",
        sort_order: input.sortOrder ?? 0,
      })
      .select("*")
      .single();

    if (error) {
      this.logger.warn(`create table failed: ${error.message} (${error.code})`);
      if (error.code === "23505") {
        throw new ConflictException(
          "Ya existe una mesa con ese nombre en la sucursal.",
        );
      }
      if (error.code === "42501") {
        throw new ConflictException("No tenés permiso para crear mesas acá.");
      }
      if (error.code === "P0001") {
        throw new ConflictException(
          "La sucursal no pertenece a este restaurante.",
        );
      }
      throw new InternalServerErrorException(error.message);
    }

    return toTable(data);
  }

  async update(id: string, input: UpdateTableInput): Promise<Table> {
    const patch: Partial<TableRow> = {};
    if (input.branchId !== undefined) patch.branch_id = input.branchId;
    if (input.name !== undefined) patch.name = input.name;
    if (input.capacity !== undefined) patch.capacity = input.capacity;
    if (input.status !== undefined) patch.status = input.status;
    if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
    if (input.isActive !== undefined) patch.is_active = input.isActive;

    const { data, error } = await this.supabase.client
      .from("tables")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        throw new ConflictException(
          "Ya existe una mesa con ese nombre en la sucursal.",
        );
      }
      if (error.code === "P0001") {
        throw new ConflictException(
          "La sucursal no pertenece a este restaurante.",
        );
      }
      throw new InternalServerErrorException(error.message);
    }
    if (!data) {
      throw new NotFoundException(`Mesa ${id} no encontrada.`);
    }
    return toTable(data);
  }

  async remove(id: string): Promise<void> {
    const { error, count } = await this.supabase.client
      .from("tables")
      .delete({ count: "exact" })
      .eq("id", id);

    if (error) throw new InternalServerErrorException(error.message);
    if (count === 0) {
      throw new NotFoundException(`Mesa ${id} no encontrada.`);
    }
  }
}
