export function log(msg: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ t: new Date().toISOString(), msg, ...fields }));
}

export function errorLog(msg: string, err: unknown, fields: Record<string, unknown> = {}): void {
  const detail = err instanceof Error ? err.message : String(err);
  console.error(JSON.stringify({ t: new Date().toISOString(), level: "error", msg, error: detail, ...fields }));
}
