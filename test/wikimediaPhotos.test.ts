import { describe, expect, it, vi } from "vitest";
import { normalizeCatalog } from "../src/catalog.js";
import {
  lookupWikimediaPhoto,
  mergePhotosIntoCatalog,
  emptyPhotoCache,
} from "../src/catalog/wikimediaPhotos.js";

describe("lookupWikimediaPhoto", () => {
  it("resolves a football player with P18 image", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("wbsearchentities")) {
        return new Response(
          JSON.stringify({
            search: [{ id: "Q128746", label: "Pelé", description: "Brazilian footballer" }],
          }),
        );
      }
      if (url.includes("wbgetentities")) {
        return new Response(
          JSON.stringify({
            entities: {
              Q128746: {
                id: "Q128746",
                labels: { en: { value: "Pelé" } },
                claims: {
                  P106: [
                    {
                      mainsnak: {
                        datavalue: { value: { id: "Q937857" } },
                      },
                    },
                  ],
                  P18: [
                    {
                      mainsnak: {
                        datavalue: { value: "Pele_con_brasil_(cropped).jpg" },
                      },
                    },
                  ],
                },
              },
            },
          }),
        );
      }
      throw new Error(`unexpected url ${url}`);
    });

    const result = await lookupWikimediaPhoto("Pelé", "Brazil", {
      fetch: fetchMock as typeof fetch,
    });

    expect(result?.wikidataId).toBe("Q128746");
    expect(result?.photoUrl).toContain("Pele_con_brasil");
    expect(result?.photoSource).toBe("wikimedia");
  });
});

describe("mergePhotosIntoCatalog", () => {
  it("does not overwrite curated photos", async () => {
    const catalog = normalizeCatalog({
      scenarios: [
        {
          id: "brazil-1970",
          team: "Brazil",
          cup: 1970,
          players: [
            {
              id: "br70-pele",
              name: "Pelé",
              naturalPosition: "ST",
              force: 245,
              overall: 99,
              photoUrl: "https://example.com/pele.jpg",
              photoSource: "curated",
            },
          ],
        },
      ],
    });

    const fetchMock = vi.fn();
    const result = await mergePhotosIntoCatalog(catalog, {
      cache: emptyPhotoCache(),
      fetch: fetchMock as typeof fetch,
      delayMs: 0,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.catalog.players["br70-pele"]!.photoUrl).toBe(
      "https://example.com/pele.jpg",
    );
    expect(result.protected).toBe(0);
    expect(result.matched).toBe(0);
  });
});
