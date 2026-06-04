import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type {
  CreateIngredientInput,
  UpdateIngredientInput,
} from "@restaurant/shared";

import { SupabaseRequestService } from "../../shared/database/supabase-request.service";

export interface Ingredient {
  id: string;
  organizationId: string;
  name: string;
  unit: string;
  currentCost: number;
  minStockAlert: number | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface IngredientRow {
  id: string;
  organization_id: string;
  name: string;
  unit: string;
  current_cost: number;
  min_stock_alert: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function toIngredient(row: IngredientRow): Ingredient {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    unit: row.unit,
    currentCost: Number(row.current_cost),
    minStockAlert: row.min_stock_alert === null ? null : Number(row.min_stock_alert),
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable()
export class IngredientsService {
  private readonly logger = new Logger(IngredientsService.name);

  constructor(private readonly supabase: SupabaseRequestService) {}

  async list(organizationId?: string): Promise<Ingredient[]> {
    let q = this.supabase.client
      .from("ingredients")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (organizationId) q = q.eq("organization_id", organizationId);
    const { data, error } = await q;
    if (error) throw new InternalServerErrorException(error.message);
    return data.map(toIngredient);
  }

  async create(input: CreateIngredientInput): Promise<Ingredient> {
    const { data, error } = await this.supabase.client
      .from("ingredients")
      .insert({
        organization_id: input.organizationId,
        name: input.name,
        unit: input.unit,
        current_cost: input.currentCost ?? 0,
        min_stock_alert: input.minStockAlert ?? null,
        sort_order: input.sortOrder ?? 0,
      })
      .select("*")
      .single();

    if (error) {
      this.logger.warn(`create ingredient failed: ${error.message} (${error.code})`);
      if (error.code === "23505") {
        throw new ConflictException(
          "Ya existe un ingrediente con ese nombre en este restaurante.",
        );
      }
      if (error.code === "42501") {
        throw new ConflictException("No tenés permiso para crear ingredientes acá.");
      }
      throw new InternalServerErrorException(error.message);
    }
    return toIngredient(data);
  }

  async update(id: string, input: UpdateIngredientInput): Promise<Ingredient> {
    const patch: Partial<IngredientRow> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.unit !== undefined) patch.unit = input.unit;
    if (input.currentCost !== undefined) patch.current_cost = input.currentCost;
    if (input.minStockAlert !== undefined) patch.min_stock_alert = input.minStockAlert;
    if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
    if (input.isActive !== undefined) patch.is_active = input.isActive;

    const { data, error } = await this.supabase.client
      .from("ingredients")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        throw new ConflictException(
          "Ya existe un ingrediente con ese nombre en este restaurante.",
        );
      }
      throw new InternalServerErrorException(error.message);
    }
    if (!data) throw new NotFoundException(`Ingrediente ${id} no encontrado.`);
    return toIngredient(data);
  }

  async remove(id: string): Promise<void> {
    const { error, count } = await this.supabase.client
      .from("ingredients")
      .delete({ count: "exact" })
      .eq("id", id);
    if (error) throw new InternalServerErrorException(error.message);
    if (count === 0) throw new NotFoundException(`Ingrediente ${id} no encontrado.`);
  }
}
