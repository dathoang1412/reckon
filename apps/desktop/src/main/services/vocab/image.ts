const WIKIPEDIA_API_URL = "https://en.wikipedia.org/w/api.php";

export interface ImageCandidate {
  id: string;
  url: string;
  thumbUrl: string;
  // Wikipedia article the image came from — shown as the credit/attribution
  // (see VocabDetailModal's "Ảnh minh họa" section) and used as alt text.
  title: string;
  pageUrl: string;
}

interface WikipediaThumbnail {
  source: string;
  width: number;
  height: number;
}

interface WikipediaPage {
  pageid: number;
  title: string;
  fullurl?: string;
  thumbnail?: WikipediaThumbnail;
}

interface WikipediaQueryResponse {
  query?: { pages?: Record<string, WikipediaPage> };
}

// No API key, no signup, no attribution/rate-limit obligations to manage —
// unlike the Unsplash integration this replaced, Wikipedia's action API is
// fully open (CORS via origin=*, no auth) and free to call from a desktop
// app. generator=search + prop=pageimages combines "find matching articles"
// and "get each one's lead image" into a single request, instead of a
// search call followed by one thumbnail lookup per result.
export async function searchImages(query: string): Promise<ImageCandidate[]> {
  const url = new URL(WIKIPEDIA_API_URL);
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", query);
  url.searchParams.set("gsrlimit", "8");
  url.searchParams.set("prop", "pageimages|info");
  url.searchParams.set("pithumbsize", "400");
  url.searchParams.set("inprop", "url");

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Wikipedia HTTP ${res.status}`);

  const json = (await res.json()) as WikipediaQueryResponse;
  const pages = Object.values(json.query?.pages ?? {});
  // Not every matching article has a lead image (pageimages returns nothing
  // for text-only pages) — those are useless as an illustration, so they're
  // dropped rather than shown as a broken picker entry.
  return pages
    .filter((page): page is WikipediaPage & { thumbnail: WikipediaThumbnail; fullurl: string } => !!page.thumbnail)
    .map((page) => ({
      id: String(page.pageid),
      url: page.thumbnail.source,
      thumbUrl: page.thumbnail.source,
      title: page.title,
      pageUrl: page.fullurl,
    }));
}
