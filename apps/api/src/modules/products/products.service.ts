import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type {
  CreateProductInput,
  UpdateProductInput,
} from "@restaurant/shared";

import { SupabaseRequestService } from "../../shared/database/supabase-request.service";

export interface Product {
  id: string;
  organizationId: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  cost: number;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface ProductRow {
  id: string;
  organization_id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  cost: number;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    organizationId: row.organization_id,
    categoryId: row.category_id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    cost: Number(row.cost),
    imageUrl: row.image_url,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface ListOptions {
  organizationId?: string;
  categoryId?: string;
}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(private readonly supabase: SupabaseRequestService) {}

  async list(opts: ListOptions = {}): Promise<Product[]> {
    let query = this.supabase.client
      .from("products")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (opts.organizationId) query = query.eq("organization_id", opts.organizationId);
    if (opts.categoryId) query = query.eq("category_id", opts.categoryId);

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(error.message);
    return data.map(toProduct);
  }

  async create(input: CreateProductInput): Promise<Product> {
    const { data, error } = await this.supabase.client
      .from("products")
      .insert({
        organization_id: input.organizationId,
        category_id: input.categoryId,
        name: input.name,
        description: input.description ?? null,
        price: input.price,
        cost: input.cost ?? 0,
        image_url: input.imageUrl ?? null,
        sort_order: input.sortOrder ?? 0,
      })
      .select("*")
      .single();

    if (error) {
      this.logger.warn(`create product failed: ${error.message} (${error.code})`);
      if (error.code === "42501") {
        throw new ConflictException("No tenés permiso para crear productos acá.");
      }
      // P0001 = generic raise_exception, used by our org-match trigger
      if (error.code === "P0001") {
        throw new ConflictException(
          "La categoría no pertenece a este restaurante.",
        );
      }
      throw new InternalServerErrorException(error.message);
    }

    return toProduct(data);
  }

  async update(id: string, input: UpdateProductInput): Promise<Product> {
    const patch: Partial<ProductRow> = {};
    if (input.categoryId !== undefined) patch.category_id = input.categoryId;
    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description ?? null;
    if (input.price !== undefined) patch.price = input.price;
    if (input.cost !== undefined) patch.cost = input.cost;
    if (input.imageUrl !== undefined) patch.image_url = input.imageUrl ?? null;
    if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
    if (input.isActive !== undefined) patch.is_active = input.isActive;

    const { data, error } = await this.supabase.client
      .from("products")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      if (error.code === "P0001") {
        throw new ConflictException(
          "La categoría no pertenece a este restaurante.",
        );
      }
      throw new InternalServerErrorException(error.message);
    }
    if (!data) {
      throw new NotFoundException(`Producto ${id} no encontrado.`);
    }
    return toProduct(data);
  }

  async remove(id: string): Promise<void> {
    const { error, count } = await this.supabase.client
      .from("products")
      .delete({ count: "exact" })
      .eq("id", id);

    if (error) throw new InternalServerErrorException(error.message);
    if (count === 0) {
      throw new NotFoundException(`Producto ${id} no encontrado.`);
    }
  }
}
