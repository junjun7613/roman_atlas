#!/usr/bin/env node
// Build a compact search index from public/data/claude/<province>/<place>/*.json
// for in-browser filtering and faceting.
//
// Output (under public/data/index/):
//   inscriptions-<i>.json — one row per inscription with flattened searchable
//                         fields and aggregated text summaries, split into
//                         fixed-size chunks to stay under Cloudflare Workers'
//                         25 MiB per-asset limit.
//   facets.json         — sorted list of distinct values for each facet kind,
//                         plus chunkCount so the client knows how many
//                         inscriptions-<i>.json files to load.
//
// Run: node scripts/build-search-index.mjs
// (also wired as `npm run data:index`).

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeNameKeys } from "./name-normalize.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
// The per-province source tree (claude/<province>/<place>/*_career.json) is the
// 500MB+ corpus produced by the sibling ai_epigraphy_search project. It is NOT
// committed to roman_atlas (only the built index under public/data/index/ is).
// Point CLAUDE_DATA_ROOT at wherever the source lives, or drop the tree into
// roman_atlas/public/data/claude. We default to the sibling project's copy.
const ROOT =
  process.env.CLAUDE_DATA_ROOT ||
  join(
    __dirname,
    "..",
    "..",
    "ai_epigraphy_search",
    "epigraphy-search",
    "public",
    "data",
    "claude",
  );
const OUT_DIR = join(__dirname, "..", "public", "data", "index");

// SPARQL endpoint carrying the structured external-database links (EDCS, SIRAR,
// …) for each inscription. Override with EPIGRAPHY_SPARQL_ENDPOINT. Set it to
// the empty string to skip external-link enrichment (rows then carry none).
const SPARQL_ENDPOINT =
  process.env.EPIGRAPHY_SPARQL_ENDPOINT ??
  "http://54.92.185.36/himiko_epigraphy/sparql";

// Fetch every external-database link and group them by EDCS-ID. Each inscription
// has one or more o:externalLink resources, each carrying a database name, the
// external id, and a ready-to-use schema:url. Returns Map<edcsId, Array<{db,id,url}>>.
async function fetchExternalLinks() {
  if (!SPARQL_ENDPOINT) {
    console.warn("EPIGRAPHY_SPARQL_ENDPOINT empty — skipping external links");
    return new Map();
  }
  const query = `
    PREFIX o: <http://epigraphic-careers.org/ontology#>
    SELECT ?insc ?db ?eid ?url WHERE {
      GRAPH ?g {
        ?insc o:externalLink ?l .
        ?l o:database ?db ;
           <https://schema.org/url> ?url .
        OPTIONAL { ?l o:externalId ?eid }
      }
    }`;
  const res = await fetch(SPARQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/sparql-results+json",
    },
    body: `query=${encodeURIComponent(query)}`,
  });
  if (!res.ok) {
    throw new Error(
      `external-links SPARQL query failed: ${res.status} ${res.statusText}`,
    );
  }
  const data = await res.json();
  const bindings = data?.results?.bindings ?? [];
  const byEdcsId = new Map();
  for (const b of bindings) {
    // Inscription URI ends with the EDCS-ID (…/inscription/EDCS-24300165),
    // which is the same id used as the index row key.
    const inscUri = b.insc?.value;
    if (!inscUri) continue;
    const edcsId = inscUri.split("/").pop();
    const url = b.url?.value;
    const db = b.db?.value;
    if (!edcsId || !url || !db) continue;
    const link = { db, id: b.eid?.value || null, url };
    const list = byEdcsId.get(edcsId);
    if (list) list.push(link);
    else byEdcsId.set(edcsId, [link]);
  }
  // Stable order within each inscription so chunk output is deterministic.
  for (const list of byEdcsId.values()) {
    list.sort((a, b) => a.db.localeCompare(b.db) || a.url.localeCompare(b.url));
  }
  console.log(
    `Fetched ${bindings.length} external links for ${byEdcsId.size} inscriptions`,
  );
  return byEdcsId;
}

function uniqSorted(values) {
  const set = new Set();
  for (const v of values) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) set.add(s);
  }
  return Array.from(set).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}

function personSummary(p) {
  const name = p.person_name_readable || p.person_name_normalized || p.person_name || "?";
  return p.social_status ? `${name} (${p.social_status})` : name;
}

function careerSummary(p) {
  if (!p.has_career || !Array.isArray(p.career_path)) return [];
  const name = p.person_name_readable || p.person_name_normalized || p.person_name || "?";
  return p.career_path
    .map((c) => {
      const pos = c.position_normalized || c.position || c.position_abstract;
      return pos ? `${name}: ${pos}` : null;
    })
    .filter(Boolean);
}

// The right-hand side of a benefaction line: "type / objectType object". This
// is what identifies the benefaction *statement* itself, independent of who
// performed it.
function benefactionBody(b) {
  const parts = [b.benefaction_type || "?"];
  const objSegments = [];
  if (b.object_type) objSegments.push(b.object_type);
  if (b.object) objSegments.push(b.object);
  if (objSegments.length > 0) parts.push(" / " + objSegments.join(" "));
  return parts.join("");
}

// Build the inscription's benefaction lines at STATEMENT granularity, matching
// the himiko model where one benefaction can be shared by several agents (the
// merge that collapsed benefaction/0 + benefaction/1 into a single benefaction/0
// with two epig:agent triples). Persons whose benefaction has the same body
// (type + object) are folded into one line — "Name A, Name B: type / object" —
// so the count here agrees with the network graph's single shared node instead
// of counting one line per person.
function benefactionSummary(persons) {
  // Preserve first-seen order of statements while grouping agents under each.
  const order = [];
  const byBody = new Map();
  for (const p of persons) {
    if (!Array.isArray(p.benefactions)) continue;
    const name =
      p.person_name_readable || p.person_name_normalized || p.person_name || "?";
    for (const b of p.benefactions) {
      const body = benefactionBody(b);
      let names = byBody.get(body);
      if (!names) {
        names = [];
        byBody.set(body, names);
        order.push(body);
      }
      if (!names.includes(name)) names.push(name);
    }
  }
  return order.map((body) => `${byBody.get(body).join(", ")}: ${body}`);
}

function relationshipSummary(rels, persons) {
  if (!Array.isArray(rels)) return [];
  const nameOf = (id) => {
    const p = persons.find((x) => x.person_id === id);
    if (!p) return "?";
    return p.person_name_readable || p.person_name_normalized || p.person_name || "?";
  };
  return rels.map((r) => {
    const src = nameOf(r.source_person_id);
    const tgt = nameOf(r.target_person_id);
    const t = r.type || "rel";
    const prop = r.property ? `/${r.property}` : "";
    return `${src} —[${t}${prop}]→ ${tgt}`;
  });
}

function communitySummary(comms) {
  if (!Array.isArray(comms)) return [];
  return comms.map((c) => {
    const name = c.community_name_normalized || c.community_name || "?";
    return c.community_type ? `${name} (${c.community_type})` : name;
  });
}

function num(x) {
  if (x == null || x === "") return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

async function* walkJson(root) {
  const provinces = await readdir(root, { withFileTypes: true });
  for (const pe of provinces) {
    if (!pe.isDirectory()) continue;
    const places = await readdir(join(root, pe.name), { withFileTypes: true });
    for (const pl of places) {
      if (!pl.isDirectory()) continue;
      const files = await readdir(join(root, pe.name, pl.name), {
        withFileTypes: true,
      });
      for (const f of files) {
        if (!f.isFile() || !f.name.endsWith(".json")) continue;
        yield join(root, pe.name, pl.name, f.name);
      }
    }
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  // External-database links come from the SPARQL endpoint (not the per-province
  // source tree), keyed by EDCS-ID for merging into rows below.
  const externalLinksByEdcsId = await fetchExternalLinks();

  const rowMap = new Map(); // edcsId -> row (dedup: same inscription can sit
  //                                          under multiple place folders)
  const socialStatusSet = [];
  const positionAbstractSet = [];
  const positionNormalizedSet = [];
  const benefactionTypeSet = [];
  const objectTypeSet = [];
  const relationshipTypeSet = [];
  const communityTypeSet = [];
  const divinityTypeSet = [];
  const placeSet = new Map(); // label -> { province?, lat?, lon? }
  const provinceSet = new Set();
  // For each normalized name key, count #inscriptions it appears in, and
  // track the most common raw display form. Only the top display form is
  // exposed to the UI; the key is what users actually filter on.
  // key -> { count, displays: Map<rawDisplay, n> }
  const nomenAgg = new Map();
  const cognomenAgg = new Map();

  let files = 0;
  for await (const path of walkJson(ROOT)) {
    files++;
    let arr;
    try {
      arr = JSON.parse(await readFile(path, "utf-8"));
    } catch (e) {
      console.warn("skip (invalid json):", path, e.message);
      continue;
    }
    if (!Array.isArray(arr)) continue;
    for (const ins of arr) {
      const od = ins.original_data || {};
      const edcsId = ins.edcs_id || od["EDCS-ID"] || null;
      if (!edcsId) continue;
      const province = od.province || null;
      const place = od.place || null;
      if (province) provinceSet.add(province);
      if (place) {
        const existing = placeSet.get(place) || {};
        placeSet.set(place, {
          province: existing.province ?? province ?? undefined,
          lat: existing.lat ?? num(od.latitude) ?? undefined,
          lon: existing.lon ?? num(od.longitude) ?? undefined,
        });
      }

      const persons = Array.isArray(ins.persons) ? ins.persons : [];
      const rels = Array.isArray(ins.person_relationships)
        ? ins.person_relationships
        : [];
      const comms = Array.isArray(ins.communities) ? ins.communities : [];

      const personLabels = persons.map(personSummary);
      const careerLines = persons.flatMap(careerSummary);
      const benefLines = benefactionSummary(persons);
      const relLines = relationshipSummary(rels, persons);
      const commLines = communitySummary(comms);

      // Per-person (nomen-key, cognomen-key) tuples. We keep them PER PERSON
      // (not flattened across the inscription) so the search side can enforce
      // the same-person constraint: nomen="Iulius" & cognomen="Caesar" should
      // require a single person to match both — not Iulius-X plus Y-Caesar
      // showing up separately in the same inscription.
      const personTuples = persons.map((p) => ({
        nomen: normalizeNameKeys(p.nomen),
        cognomen: normalizeNameKeys(p.cognomen),
      }));

      // Per-inscription distinct keys (used for facet count aggregation).
      const inscriptionNomenKeys = new Set();
      const inscriptionCognomenKeys = new Set();
      for (let i = 0; i < persons.length; i++) {
        const t = personTuples[i];
        const raw = persons[i];
        for (const k of t.nomen) {
          inscriptionNomenKeys.add(k);
          const e = nomenAgg.get(k) || { count: 0, displays: new Map() };
          if (raw.nomen) e.displays.set(raw.nomen, (e.displays.get(raw.nomen) || 0) + 1);
          nomenAgg.set(k, e);
        }
        for (const k of t.cognomen) {
          inscriptionCognomenKeys.add(k);
          const e = cognomenAgg.get(k) || { count: 0, displays: new Map() };
          if (raw.cognomen) e.displays.set(raw.cognomen, (e.displays.get(raw.cognomen) || 0) + 1);
          cognomenAgg.set(k, e);
        }
      }
      for (const k of inscriptionNomenKeys) nomenAgg.get(k).count++;
      for (const k of inscriptionCognomenKeys) cognomenAgg.get(k).count++;

      const socialStatuses = uniqSorted(persons.map((p) => p.social_status));
      const positionAbstracts = uniqSorted(
        persons.flatMap((p) =>
          (p.career_path || []).map((c) => c.position_abstract),
        ),
      );
      const positionNormalizeds = uniqSorted(
        persons.flatMap((p) =>
          (p.career_path || []).map((c) => c.position_normalized),
        ),
      );
      const benefactionTypes = uniqSorted(
        persons.flatMap((p) => (p.benefactions || []).map((b) => b.benefaction_type)),
      );
      const objectTypes = uniqSorted(
        persons.flatMap((p) =>
          (p.benefactions || []).flatMap((b) => {
            const direct = b.object_type ? [b.object_type] : [];
            const fromList = Array.isArray(b.objects)
              ? b.objects.map((o) => o.object_type)
              : [];
            return [...direct, ...fromList];
          }),
        ),
      );
      const relationshipTypes = uniqSorted(rels.map((r) => r.type));
      const communityTypes = uniqSorted(comms.map((c) => c.community_type));

      // Numeric-stats fields used by the client-side statistics panel. These
      // are NOT facets — they feed aggregate charts (avg age, cost stats,
      // divinity-type frequency), so we keep them as parallel arrays rather
      // than deduping/sorting like the facet vocabularies above.
      const ageAtDeath = persons
        .map((p) => num(p.age_at_death))
        .filter((n) => n != null);
      const divinityTypes = uniqSorted(
        persons
          .filter((p) => p.divinity === true)
          .map((p) => p.divinity_type),
      );
      // Each benefaction with a parseable numeric cost, paired with its type
      // so the panel can break cost stats down by benefaction type.
      // Cost stats are per benefaction STATEMENT, not per agent. A benefaction
      // shared by several agents (himiko's merged benefaction) must be counted
      // once, else its cost is double-summed. Dedupe on the same statement body
      // (type + object) used for the benefaction lines above.
      const seenBenefBodies = new Set();
      const benefactionCosts = persons.flatMap((p) =>
        (p.benefactions || [])
          .filter((b) => {
            const body = benefactionBody(b);
            if (seenBenefBodies.has(body)) return false;
            seenBenefBodies.add(body);
            return true;
          })
          .map((b) => ({
            type: b.benefaction_type || undefined,
            cost: num(b.cost_numeric),
          }))
          .filter((b) => b.cost != null),
      );

      socialStatusSet.push(...socialStatuses);
      positionAbstractSet.push(...positionAbstracts);
      positionNormalizedSet.push(...positionNormalizeds);
      benefactionTypeSet.push(...benefactionTypes);
      objectTypeSet.push(...objectTypes);
      relationshipTypeSet.push(...relationshipTypes);
      communityTypeSet.push(...communityTypes);
      divinityTypeSet.push(...divinityTypes);

      // Same EDCS-ID can appear under multiple place folders. Keep the first
      // copy and skip subsequent duplicates so downstream React keys stay
      // unique. The duplicates in this dataset are identical content.
      if (rowMap.has(edcsId)) continue;

      rowMap.set(edcsId, {
        id: edcsId,
        place: place || undefined,
        province: province || undefined,
        text: od.inscription || undefined,
        publication: od.publication || undefined,
        datingFrom: num(od.dating_from) ?? undefined,
        datingTo: num(od.dating_to) ?? undefined,
        lat: num(od.latitude) ?? undefined,
        lon: num(od.longitude) ?? undefined,
        socialStatuses,
        positionAbstracts,
        positionNormalizeds,
        benefactionTypes,
        objectTypes,
        relationshipTypes,
        communityTypes,
        ageAtDeath,
        divinityTypes,
        benefactionCosts,
        persons: personLabels,
        personTuples,
        careers: careerLines,
        benefactions: benefLines,
        relationships: relLines,
        communities: commLines,
      });
    }
  }
  const rows = Array.from(rowMap.values());

  // Attach external-database links to each row (omit the field when none).
  let rowsWithLinks = 0;
  for (const row of rows) {
    const links = externalLinksByEdcsId.get(row.id);
    if (links && links.length > 0) {
      row.externalLinks = links;
      rowsWithLinks++;
    }
  }

  console.log(
    `Read ${files} files, ${rows.length} inscriptions (${rowsWithLinks} with external links)`,
  );

  const places = Array.from(placeSet.entries())
    .map(([label, meta]) => ({
      label,
      province: meta.province,
      lat: meta.lat,
      lon: meta.lon,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const provinces = Array.from(provinceSet).sort();

  function nameVocab(agg) {
    const out = [];
    for (const [key, { count, displays }] of agg) {
      let bestDisp = key;
      let bestN = -1;
      for (const [d, n] of displays) {
        if (n > bestN) {
          bestDisp = d;
          bestN = n;
        }
      }
      out.push({ key, display: bestDisp, count });
    }
    // Sort by descending count so the autocomplete shows the most common
    // names first when the user has typed only a couple letters.
    out.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
    return out;
  }

  const facets = {
    province: provinces,
    place: places,
    socialStatus: uniqSorted(socialStatusSet),
    positionAbstract: uniqSorted(positionAbstractSet),
    positionNormalized: uniqSorted(positionNormalizedSet),
    benefactionType: uniqSorted(benefactionTypeSet),
    objectType: uniqSorted(objectTypeSet),
    relationshipType: uniqSorted(relationshipTypeSet),
    communityType: uniqSorted(communityTypeSet),
    divinityType: uniqSorted(divinityTypeSet),
    nomen: nameVocab(nomenAgg),
    cognomen: nameVocab(cognomenAgg),
  };

  const generatedAt = new Date().toISOString();

  // Cloudflare Workers caps static assets at 25 MiB per file, and the full
  // index is well over that. Split the rows into fixed-size chunks written as
  // inscriptions-<i>.json; the client reads the chunk count from facets.json
  // (which it already fetches first) and loads them in parallel.
  const CHUNK_SIZE = 10000;
  const chunkCount = Math.max(1, Math.ceil(rows.length / CHUNK_SIZE));
  for (let i = 0; i < chunkCount; i++) {
    const slice = rows.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    await writeFile(
      join(OUT_DIR, `inscriptions-${i}.json`),
      JSON.stringify({ generatedAt, count: slice.length, inscriptions: slice }),
    );
  }
  await writeFile(
    join(OUT_DIR, "facets.json"),
    JSON.stringify(
      { generatedAt, count: rows.length, chunkCount, facets },
      null,
      2,
    ),
  );

  console.log(
    `Wrote ${chunkCount} inscriptions chunk(s) (${rows.length} rows) and facets.json to ${OUT_DIR}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
