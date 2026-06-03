import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { CategoriesModule } from "./modules/categories/categories.module";
import { MeModule } from "./modules/me/me.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";
import { ProductsModule } from "./modules/products/products.module";
import { AuthModule } from "./shared/auth/auth.module";
import { validateEnv } from "./shared/config/env.validation";
import { DatabaseModule } from "./shared/database/database.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    DatabaseModule,
    AuthModule,
    MeModule,
    OrganizationsModule,
    CategoriesModule,
    ProductsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
