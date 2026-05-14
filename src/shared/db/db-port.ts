// src/shared/db/db-port.ts
export type DbScriptArgument = string | number | boolean | null;

export interface DbScriptOptions<TKey = string> {
  keys?: TKey[];
  args?: DbScriptArgument[];
  readOnly?: boolean;
}

export interface DbPort<TValue, TKey = string> {
  set(key: TKey, value: TValue): Promise<void>;
  get(key: TKey): Promise<TValue | null>;
  del(key: TKey): Promise<void>;
  script<TResult = unknown>(
    script: string,
    options?: DbScriptOptions<TKey>,
  ): Promise<TResult>;
}
