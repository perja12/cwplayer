// Public-domain OCR text from the National Library of Norway's NBdigital corpus (CC0):
// https://www.nb.no/sprakbanken/ressurskatalog/en/oai-nb-no-sbr-34/
import type { Collection, TextItem } from "./types";
import chapter01 from "./texts/nansen_ski_over_gronland/nansen_ski_over_gronland_01_forord.txt?raw";
import chapter02 from "./texts/nansen_ski_over_gronland/nansen_ski_over_gronland_02_planen_til_ferden.txt?raw";
import chapter03 from "./texts/nansen_ski_over_gronland/nansen_ski_over_gronland_03_reisen_til_island.txt?raw";
import chapter04 from "./texts/nansen_ski_over_gronland/nansen_ski_over_gronland_04_med_jason.txt?raw";
import chapter05 from "./texts/nansen_ski_over_gronland/nansen_ski_over_gronland_05_gjennom_drivisen.txt?raw";
import chapter06 from "./texts/nansen_ski_over_gronland/nansen_ski_over_gronland_06_eskimoer.txt?raw";
import chapter07 from "./texts/nansen_ski_over_gronland/nansen_ski_over_gronland_07_videre_nordover.txt?raw";
import chapter08 from "./texts/nansen_ski_over_gronland/nansen_ski_over_gronland_08_utrustningen_til_skiferden.txt?raw";
import chapter09 from "./texts/nansen_ski_over_gronland/nansen_ski_over_gronland_09_vi_forlater_ostkysten.txt?raw";
import chapter10 from "./texts/nansen_ski_over_gronland/nansen_ski_over_gronland_10_ensformig_slit.txt?raw";
import chapter11 from "./texts/nansen_ski_over_gronland/nansen_ski_over_gronland_11_storm_pa_innland_sisen.txt?raw";
import chapter12 from "./texts/nansen_ski_over_gronland/nansen_ski_over_gronland_12_ned_fra_innlandsisen.txt?raw";
import chapter13 from "./texts/nansen_ski_over_gronland/nansen_ski_over_gronland_13_i_den_halve_baten.txt?raw";
import chapter14 from "./texts/nansen_ski_over_gronland/nansen_ski_over_gronland_14_godthab.txt?raw";
import chapter15 from "./texts/nansen_ski_over_gronland/nansen_ski_over_gronland_15_de_fire_forlatte.txt?raw";

export const NANSEN_COLLECTION_ID = "nansen-ski-over-gronland";
export const NANSEN_COLLECTION_TITLE = "På ski over Grønland - Fridtjof Nansen";

const chapters = [
  { slug: "forord", title: "Forord", content: chapter01 },
  { slug: "planen-til-ferden", title: "Planen til ferden", content: chapter02 },
  { slug: "reisen-til-island", title: "Reisen til Island", content: chapter03 },
  { slug: "med-jason", title: "Med Jason", content: chapter04 },
  { slug: "gjennom-drivisen", title: "Gjennom drivisen", content: chapter05 },
  { slug: "eskimoer", title: "Eskimoer", content: chapter06 },
  { slug: "videre-nordover", title: "Videre nordover", content: chapter07 },
  { slug: "utrustningen-til-skiferden", title: "Utrustningen til skiferden", content: chapter08 },
  { slug: "vi-forlater-ostkysten", title: "Vi forlater østkysten", content: chapter09 },
  { slug: "ensformig-slit", title: "Ensformig slit", content: chapter10 },
  { slug: "storm-pa-innlandsisen", title: "Storm på innlandsisen", content: chapter11 },
  { slug: "ned-fra-innlandsisen", title: "Ned fra innlandsisen", content: chapter12 },
  { slug: "i-den-halve-baten", title: "I den halve båten", content: chapter13 },
  { slug: "godthab", title: "Godthåb", content: chapter14 },
  { slug: "de-fire-forlatte", title: "De fire forlatte", content: chapter15 },
] as const;

export const nansenTexts: TextItem[] = chapters.map((chapter, index) => ({
  id: `nansen-${String(index + 1).padStart(2, "0")}-${chapter.slug}`,
  title: chapter.title,
  author: "Fridtjof Nansen",
  language: "Norwegian",
  labels: ["På ski over Grønland"],
  content: chapter.content.trim(),
  collectionId: NANSEN_COLLECTION_ID,
  lastPosition: 0,
}));

export const nansenCollection: Collection = {
  id: NANSEN_COLLECTION_ID,
  title: NANSEN_COLLECTION_TITLE,
  itemIds: nansenTexts.map((text) => text.id),
};
