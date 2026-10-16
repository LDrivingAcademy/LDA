export class MockError extends Error {
  status: number;
  constructor(status: number, message: string);
}
export function validatedSets(manifests: unknown[], catalog: unknown[]): Array<{set_id: string; clips: unknown[]}>;
export function practiceSets(catalog: unknown[]): Array<{set_id:string; mode:'practice'; clips:unknown[]}>;
