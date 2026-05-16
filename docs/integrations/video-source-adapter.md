# Video Source Adapter

This document describes the third-party video source adapter added under
`src/integrations/video-sources`.

## Scope

The adapter is an integration layer only. It normalizes third-party video source
protocols into MixTV data structures, but it does not:

- read admin video source configuration
- apply user permissions
- filter adult content
- expose Next.js API routes
- update the search page UI
- persist cache records

Those responsibilities belong to feature modules such as `src/modules/search`
or server route handlers that call this adapter later.

## Supported Source Shape

The adapter accepts a `VideoSourceEndpoint`:

```ts
type VideoSourceEndpoint = {
  apiUrl: string;
  detailUrl?: string;
  key: string;
  name: string;
};
```

`apiUrl` should point at a standard vod provider endpoint, for example:

```text
https://source.example/api.php/provide/vod
```

`detailUrl` is optional. When present, detail lookup uses an HTML detail page:

```text
{detailUrl}/index.php/vod/detail/id/{id}.html
```

When `detailUrl` is absent, detail lookup uses the standard JSON endpoint.

## Standard Vod Protocol

Search requests use:

```text
{apiUrl}?ac=videolist&wd={query}
```

Additional pages use:

```text
{apiUrl}?ac=videolist&wd={query}&pg={page}
```

Detail requests use:

```text
{apiUrl}?ac=videolist&ids={id}
```

The adapter expects JSON responses with a `list` array. It reads common vod
fields such as `vod_id`, `vod_name`, `vod_pic`, `vod_play_url`, `vod_year`,
`vod_content`, `vod_class`, `vod_remarks`, `type_name`, and `vod_douban_id`.
If a provider encodes a clarity label in `vod_remarks`, the adapter exposes it
as `quality` on the normalized result.

## Normalized Result

Third-party items are normalized into `VideoSourceResource`:

```ts
type VideoSourceResource = {
  id: string;
  title: string;
  posterUrl: string;
  episodes: string[];
  episodeTitles: string[];
  sourceKey: string;
  sourceName: string;
  className?: string;
  year: string;
  description: string;
  typeName?: string;
  doubanId?: number;
  remarks?: string;
  quality?: string;
};
```

Only playable `.m3u8` URLs are included in `episodes`. Search results without
playable `.m3u8` episodes are ignored. Detail lookup can also extract fallback
`.m3u8` links from `vod_content`.

## Search Variants

`generateVideoSourceSearchVariants` mirrors the useful dependency-free parts of
the LunaTV downstream strategy:

- ordinary queries return the original query only
- `第3季` can generate `第三季`
- `第二季` can generate `2`
- full-width and half-width colons can generate a space variant
- book title brackets can be removed
- multi-word queries can generate a no-space variant

Traditional-to-simplified Chinese conversion is not included in this adapter
because MixTV does not currently depend on a conversion library. Add it in this
integration layer later if the project adopts a converter dependency.

## Public API

Import from the integration boundary:

```ts
import {
  generateVideoSourceSearchVariants,
  getVideoSourceDetail,
  searchVideoSource,
} from "@/integrations/video-sources";
```

The adapter functions accept an optional `fetcher`, `timeoutMs`, and search
options so module services can test and compose them without global state.

## Next Integration Step

The next layer should be a `src/modules/search/server` service that:

- reads enabled sources from the admin video source store
- applies user and site filtering rules
- calls `searchVideoSource`
- handles aggregate timeout/error behavior
- exposes JSON and SSE through thin API routes
