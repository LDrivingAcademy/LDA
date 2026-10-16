import type { SupabaseClient } from '@supabase/supabase-js';
export class SupabaseMockStore {
  constructor(client: SupabaseClient);
}
export class PersistentMocks {
  constructor(options: { sets: unknown[]; store: SupabaseMockStore; now?: () => number });
  begin(owner: string, setId: string, operationId: string): Promise<unknown>;
  operate(owner: string, id: string, action: string, input: Record<string, unknown>, operationId: string): Promise<unknown>;
}
