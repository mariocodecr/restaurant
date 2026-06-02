import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { MeModule } from "./modules/me/me.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
