import { createFavoriteKey, listFavorites } from "@/modules/favorites";
import type { HistoryItem } from "@/modules/history/server/history-service";

export type HistoryApiItem = HistoryItem & {
  is_favorite: boolean;
};

function createHistoryResourceKey(item: Pick<HistoryItem, "id" | "source">) {
  return createFavoriteKey(item.source, item.id);
}

export async function listHistoryResponse(userId: string, history: HistoryItem[]) {
  const favorites = await listFavorites(userId);
  const favoriteKeys = new Set(favorites.map((favorite) => createFavoriteKey(favorite.source, favorite.id)));

  return history.map<HistoryApiItem>((item) => ({
    ...item,
    is_favorite: favoriteKeys.has(createHistoryResourceKey(item)),
  }));
}
