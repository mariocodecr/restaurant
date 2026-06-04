import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  STOCK_MOVEMENT_KIND,
  type CreateStockMovementInput,
} from "@restaurant/shared";

import { SupabaseRequestService } from "../../shared/database/supabase-request.service";

export interface StockLevel {
  branchId: string;
  ingredientId: string;
  ingredientName: string;
  unit: string;
  minStockAlert: number | null;
  quantity: number;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  branchId: string;
  ingredientId: string;
  ingredientName: string;
  unit: string;
  kind: string;
  quantityDelta: number;
  unitCost: number;
  notes: string | null;
  createdAt: string;
}

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(private readonly supabase: SupabaseRequestService) {}

  // Joined view: every ACTIVE ingredient in the org, with its current
  // level at the given branch (zero if no movements yet). We compute
  // this client-side from two queries because Supabase's PostgREST
  // doesn't make outer joins ergonomic.
  async listLevels(branchId: string, organizationId: string): Promise<StockLevel[]> {
    const [{ data: ingredients, error: ingErr }, { data: levels, error: lvlErr }] =
      await Promise.all([
        this.supabase.client
          .from("ingredients")
          .select("id, name, unit, min_stock_alert")
          .eq("organization_id", organizationId)
          .eq("is_active", true)
          .order("sort_order")
          .order("name"),
        this.supabase.client
          .from("stock_levels")
          .select("ingredient_id, quantity, updated_at")
          .eq("branch_id", branchId),
      ]);

    if (ingErr) throw new InternalServerErrorException(ingErr.message);
    if (lvlErr) throw new InternalServerErrorException(lvlErr.message);

    const levelByIng = new Map<string, { quantity: number; updated_at: string }>();
    for (const l of levels ?? []) {
      levelByIng.set(l.ingredient_id, {
        quantity: Number(l.quantity),
        updated_at: l.updated_at,
      });
    }

    return (ingredients ?? []).map((ing) => {
      const l = levelByIng.get(ing.id);
      return {
        branchId,
        ingredientId: ing.id,
        ingredientName: ing.name,
        unit: ing.unit,
        minStockAlert:
          ing.min_stock_alert === null ? null : Number(ing.min_stock_alert),
        quantity: l ? l.quantity : 0,
        updatedAt: l ? l.updated_at : "",
      };
    });
  }

  async listMovements(
    branchId: string,
    options: { ingredientId?: string; limit?: number } = {},
  ): Promise<StockMovement[]> {
    const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
    let q = this.supabase.client
      .from("stock_movements")
      .select(
        "id, branch_id, ingredient_id, kind, quantity_delta, unit_cost, notes, created_at, ingredients!inner(name, unit)",
      )
      .eq("branch_id", branchId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (options.ingredientId) q = q.eq("ingredient_id", options.ingredientId);

    const { data, error } = await q;
    if (error) throw new InternalServerErrorException(error.message);

    return (data ?? []).map((row) => {
      // Supabase returns the embedded relation as an object even when many
      // candidate parents exist; the !inner guarantees presence.
      const ing = row.ingredients as unknown as { name: string; unit: string };
      return {
        id: row.id,
        branchId: row.branch_id,
        ingredientId: row.ingredient_id,
        ingredientName: ing.name,
        unit: ing.unit,
        kind: row.kind,
        quantityDelta: Number(row.quantity_delta),
        unitCost: Number(row.unit_cost),
        notes: row.notes,
        createdAt: row.created_at,
      };
    });
  }

  async addMovement(
    input: CreateStockMovementInput,
    userId: string,
  ): Promise<StockMovement> {
    // Compute the signed delta from kind + quantity + (for ajuste) isPositive.
    let delta = input.quantity;
    if (input.kind === STOCK_MOVEMENT_KIND.SALIDA) {
      delta = -Math.abs(input.quantity);
    } else if (input.kind === STOCK_MOVEMENT_KIND.ENTRADA) {
      delta = Math.abs(input.quantity);
    } else if (input.kind === STOCK_MOVEMENT_KIND.AJUSTE) {
      delta = input.isPositive === false ? -Math.abs(input.quantity) : Math.abs(input.quantity);
    }
    if (delta === 0) {
      throw new ConflictException("La cantidad no puede ser cero.");
    }

    const { data, error } = await this.supabase.client
      .from("stock_movements")
      .insert({
        organization_id: input.organizationId,
        branch_id: input.branchId,
        ingredient_id: input.ingredientId,
        kind: input.kind,
        quantity_delta: delta,
        unit_cost: input.unitCost ?? 0,
        notes: input.notes ?? null,
        created_by_user_id: userId,
      })
      .select(
        "id, branch_id, ingredient_id, kind, quantity_delta, unit_cost, notes, created_at, ingredients!inner(name, unit)",
      )
      .single();

    if (error) {
      this.logger.warn(`add stock movement failed: ${error.message} (${error.code})`);
      if (error.code === "42501") {
        throw new ConflictException(
          "Solo el dueño o un administrador pueden registrar movimientos.",
        );
      }
      if (error.code === "P0001") {
        throw new ConflictException(
          "Sucursal o ingrediente no pertenecen a este restaurante.",
        );
      }
      throw new InternalServerErrorException(error.message);
    }

    const ing = data.ingredients as unknown as { name: string; unit: string };
    return {
      id: data.id,
      branchId: data.branch_id,
      ingredientId: data.ingredient_id,
      ingredientName: ing.name,
      unit: ing.unit,
      kind: data.kind,
      quantityDelta: Number(data.quantity_delta),
      unitCost: Number(data.unit_cost),
      notes: data.notes,
      createdAt: data.created_at,
    };
  }

  async removeMovement(id: string): Promise<void> {
    const { error, count } = await this.supabase.client
      .from("stock_movements")
      .delete({ count: "exact" })
      .eq("id", id);
    if (error) throw new InternalServerErrorException(error.message);
    if (count === 0) throw new NotFoundException(`Movimiento ${id} no encontrado.`);
  }
}
