export const config = { maxDuration: 30 };

const AIRTABLE_BASE_ID = "appueNPpMZC1Kgi3Q";
const AIRTABLE_TABLE_ID = "tblaRhtCYr2gOG7Xw";
const AIRTABLE_LEAD_FIELDS = ["Nom", "Code Postal", "Date"];

function parseFrenchNumber(v) {
  if (!v) return null;
  const n = Number(String(v).replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseFrenchDDMMYYYY(v) {
  if (!v) return null;
  const m = String(v).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo}-${d}T00:00:00.000Z`;
}

function parseMsDate(v) {
  if (!v) return null;
  const n = Number(v);
  return n > 0 ? new Date(n).toISOString() : null;
}

function toDept(codePostal) {
  if (!codePostal) return null;
  const digits = String(codePostal).replace(/\D/g, "");
  if (digits.length < 5) return null;
  return digits.startsWith("97") || digits.startsWith("98") ? digits.slice(0, 3) : digits.slice(0, 2);
}

function normalizeName(s) {
  if (!s) return "";
  return String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

function normalizeCP(s) {
  return String(s || "").replace(/\D/g, "");
}

async function fetchAirtableLeads(token) {
  const records = [];
  let offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`);
    url.searchParams.set("pageSize", "100");
    AIRTABLE_LEAD_FIELDS.forEach((f) => url.searchParams.append("fields[]", f));
    if (offset) url.searchParams.set("offset", offset);

    let resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (resp.status === 429) {
      await new Promise((r) => setTimeout(r, 1000));
      resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    }
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Airtable API erreur ${resp.status}: ${text}`);
    }
    const data = await resp.json();
    records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records;
}

function buildLeadIndex(leadRecords) {
  const index = new Map();
  leadRecords.forEach((r) => {
    const nom = normalizeName(r.fields["Nom"]);
    const cp = normalizeCP(r.fields["Code Postal"]);
    const date = r.fields["Date"] || null;
    if (!nom || !date) return;
    const key = `${nom}|${cp}`;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(date);
    const nameOnlyKey = `${nom}|`;
    if (!index.has(nameOnlyKey)) index.set(nameOnlyKey, []);
    index.get(nameOnlyKey).push(date);
  });
  return index;
}

// Pas d'ID commun entre Airtable et MyProprio : rapprochement approximatif par
// nom de propriétaire + code postal, avec vérification que le lead précède le bien.
function matchOrigin(property, leadIndex) {
  const owners = property.owners || [];
  const cp = normalizeCP(property.code);
  const propDate = property.dateCreate ? new Date(Number(property.dateCreate)) : null;

  let bestConfidence = null;
  let bestLeadDate = null;
  let bestOwner = null;

  for (const owner of owners) {
    const nom = normalizeName(owner);
    if (!nom) continue;

    const exactDates = leadIndex.get(`${nom}|${cp}`) || [];
    for (const leadDate of exactDates) {
      if (!propDate || new Date(leadDate) <= propDate) {
        bestConfidence = "confirmed";
        bestLeadDate = leadDate;
        bestOwner = owner;
        break;
      }
    }
    if (bestConfidence === "confirmed") break;

    if (!bestConfidence) {
      const nameOnlyDates = leadIndex.get(`${nom}|`) || [];
      const priorDates = nameOnlyDates.filter((d) => !propDate || new Date(d) <= propDate);
      if (priorDates.length > 0) {
        bestConfidence = "possible";
        bestLeadDate = priorDates.sort().pop();
        bestOwner = owner;
      }
    }
  }

  if (!bestConfidence) return null;
  return { confidence: bestConfidence, leadDate: bestLeadDate, matchedName: bestOwner };
}

export default async function handler(req, res) {
  const apiKey = process.env.MYPROPRIO_API_KEY;
  const airtableToken = process.env.AIRTABLE_TOKEN;
  if (!apiKey) {
    res.status(500).json({ error: "MYPROPRIO_API_KEY n'est pas configuré sur ce déploiement." });
    return;
  }

  try {
    const resp = await fetch("https://us-central1-myproprio-5b58f.cloudfunctions.net/apiProperties/properties?limit=200", {
      headers: { "x-api-key": apiKey },
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`API MyProprio erreur ${resp.status}: ${text}`);
    }
    const data = await resp.json();
    const raw = data.data || [];

    let leadIndex = null;
    if (airtableToken) {
      const leadRecords = await fetchAirtableLeads(airtableToken);
      leadIndex = buildLeadIndex(leadRecords);
    }

    const properties = raw
      .filter((p) => !p.isArchived)
      .map((p) => ({
        id: p.id,
        city: p.city || null,
        dept: toDept(p.code),
        agence: p.creatorAgence || "Non renseigné",
        agent: [p.creatorName, p.creatorSurname].filter(Boolean).join(" ") || null,
        price: parseFrenchNumber(p.price),
        priceFinal: parseFrenchNumber(p.priceFinal),
        dateCreate: parseMsDate(p.dateCreate),
        dateMandat: parseMsDate(p.dateMandat),
        dateCompromis: parseFrenchDDMMYYYY(p.dateCompromis),
        dateActeAuthentique: parseFrenchDDMMYYYY(p.dateActeAuthentique),
        origin: leadIndex ? matchOrigin(p, leadIndex) : undefined,
      }));

    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=600");
    res.status(200).json({
      properties,
      fetchedAt: new Date().toISOString(),
      cappedAt: raw.length >= 200 ? 200 : null,
      originMatchingEnabled: !!airtableToken,
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}
