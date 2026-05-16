export function mapBooleanConfig<
  TTargetKey extends string,
  TSourceKey extends string,
>(
  source: Record<TSourceKey, boolean>,
  mapping: Record<TTargetKey, TSourceKey>,
): Record<TTargetKey, boolean> {
  const entries = Object.entries(mapping) as [TTargetKey, TSourceKey][];

  return Object.fromEntries(
    entries.map(([targetKey, sourceKey]) => [targetKey, source[sourceKey]]),
  ) as Record<TTargetKey, boolean>;
}
