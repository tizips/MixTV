// src/shared/db/db-port.ts
export interface DbPort<TValue, TKey = string> {
  set(key: TKey, value: TValue): Promise<void>;
  get(key: TKey): Promise<TValue | null>;
  del(key: TKey): Promise<void>;
}
