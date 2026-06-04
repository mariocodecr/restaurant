import { Module } from "@nestjs/common";

import { IngredientsService } from "./ingredients.service";
import { InventoryController } from "./inventory.controller";
import { StockService } from "./stock.service";

@Module({
  controllers: [InventoryController],
  providers: [IngredientsService, StockService],
})
export class InventoryModule {}
