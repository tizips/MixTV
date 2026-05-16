export function mapBooleanConfig<
  TTargetKey extends string,
  TSourceKey extends string,
>(
  source: Record<TSourceKey, boolean>,
  mapping: Record<TTargetKey, TSourceKey>,
): Record<TTargetKey, boolean> {
  return Object.fromEntries(
    Object.entries(mapping).map(([targetKey, sourceKey]) => [targetKey, source[sourceKey]]),
  ) as Record<TTargetKey, boolean>;
}
