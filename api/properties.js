export const config = { maxDuration: 30 };

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

export default async function handler(req, res) {
  const apiKey = process.env.MYPROPRIO_API_KEY;
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
      }));

    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=600");
    res.status(200).json({
      properties,
      fetchedAt: new Date().toISOString(),
      cappedAt: raw.length >= 200 ? 200 : null,
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}
