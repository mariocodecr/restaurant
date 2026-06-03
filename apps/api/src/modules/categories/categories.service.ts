import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@restaurant/shared";

import { SupabaseRequestService } from "../../shared/database/supabase-request.service";

export interface Category {
  id: string;
  organizationId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CategoryRow {
  id: string;
  organization_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private readonly supabase: SupabaseRequestService) {}

  // RLS scopes the result to orgs the user is a member of.
  async list(organizationId?: string): Promise<Category[]> {
    let query = this.supabase.client
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (organizationId) query = query.eq("organization_id", organizationId);

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(error.message);
    return data.map(toCategory);
  }

  async create(input: CreateCategoryInput): Promise<Category> {
    const { data, error } = await this.supabase.client
      .from("categories")
      .insert({
        organization_id: input.organizationId,
        name: input.name,
        sort_order: input.sortOrder ?? 0,
      })
      .select("*")
      .single();

    if (error) {
      this.logger.warn(`create category failed: ${error.message} (${error.code})`);
      if (error.code === "23505") {
        throw new ConflictException("Ya existe una categoría con ese nombre.");
      }
      if (error.code === "42501") {
        throw new ConflictException("No tenés permiso para crear categorías acá.");
      }
      throw new InternalServerErrorException(error.message);
    }

    return toCategory(data);
  }

  async update(id: string, input: UpdateCategoryInput): Promise<Category> {
    const patch: Partial<CategoryRow> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
    if (input.isActive !== undefined) patch.is_active = input.isActive;

    const { data, error } = await this.supabase.client
      .from("categories")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        throw new ConflictException("Ya existe una categoría con ese nombre.");
      }
      throw new InternalServerErrorException(error.message);
    }
    if (!data) {
      throw new NotFoundException(`Categoría ${id} no encontrada.`);
    }
    return toCategory(data);
  }

  async remove(id: string): Promise<void> {
    const { error, count } = await this.supabase.client
      .from("categories")
      .delete({ count: "exact" })
      .eq("id", id);

    if (error) {
      // 23503 = foreign_key_violation (products still reference this category)
      if (error.code === "23503") {
        throw new ConflictException(
          "No se puede borrar: hay productos en esta categoría. Movélos o eliminálos primero.",
        );
      }
      throw new InternalServerErrorException(error.message);
    }
    if (count === 0) {
      throw new NotFoundException(`Categoría ${id} no encontrada.`);
    }
  }
}
