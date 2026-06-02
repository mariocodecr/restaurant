import { Global, Module } from "@nestjs/common";

import { supabaseAnonProvider } from "./supabase-anon.provider";
import { SupabaseRequestService } from "./supabase-request.service";

@Global()
@Module({
  providers: [supabaseAnonProvider, SupabaseRequestService],
  exports: [supabaseAnonProvider, SupabaseRequestService],
})
export class DatabaseModule {}
