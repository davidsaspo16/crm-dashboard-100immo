export const config = { maxDuration: 30 };

const FIELDS = [
  "Date",
  "Code Postal",
  "Source du lead",
  "statut du lead",
  "Statut du logement",
  "Commercial",
  "Agent affilié au secteur",
  "Prénom",
  "Nom",
  "Numéro de téléphone",
  "Email",
];

function toDept(codePostal) {
  if (!codePostal) return null;
  const digits = String(codePostal).replace(/\D/g, "");
  if (digits.length < 5) return null;
  return digits.startsWith("97") || digits.startsWith("98") ? digits.slice(0, 3) : digits.slice(0, 2);
}

function toType(statutLogement) {
  const t = String(statutLogement || "").toLowerCase();
  if (t.includes("maison")) return "Maison";
  if (t.includes("appart")) return "Appartement";
  return "Non renseigné";
}

async function fetchAllRecords(baseId, tableId, token) {
  const records = [];
  let offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${tableId}`);
    url.searchParams.set("pageSize", "100");
    FIELDS.forEach((f) => url.searchParams.append("fields[]", f));
    if (offset) url.searchParams.set("offset", offset);

    let resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (resp.status === 429) {
      await new Promise((r) => setTimeout(r, 1000));
      resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    }
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Airtable API error ${resp.status}: ${text}`);
    }
    const data = await resp.json();
    records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records;
}

export default async function handler(req, res) {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID || "appueNPpMZC1Kgi3Q";
  const tableId = process.env.AIRTABLE_TABLE_ID || "tblaRhtCYr2gOG7Xw";

  if (!token) {
    res.status(500).json({ error: "AIRTABLE_TOKEN n'est pas configuré sur ce déploiement." });
    return;
  }

  try {
    const raw = await fetchAllRecords(baseId, tableId, token);
    const records = raw
      .map((r) => {
        const f = r.fields;
        const agence = f["Agent affilié au secteur"];
        return {
          created: f["Date"] || null,
          dept: toDept(f["Code Postal"]),
          codePostal: f["Code Postal"] || null,
          source: f["Source du lead"] || "Non renseigné",
          statut: f["statut du lead"] || "piste",
          type: toType(f["Statut du logement"]),
          commercial: f["Commercial"] || "Non assigné",
          agence: agence ? String(agence).split(",")[0].trim() : "Non renseigné",
          prenom: f["Prénom"] || null,
          nom: f["Nom"] || null,
          telephone: f["Numéro de téléphone"] || null,
          email: f["Email"] || null,
        };
      })
      .filter((r) => r.created);

    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=600");
    res.status(200).json({ records, fetchedAt: new Date().toISOString() });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}
