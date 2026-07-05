const { put, list, del } = require('@vercel/blob');

const BLOB_PREFIX = 'groups-state-';
const GROUP_IDS = ['1', '2', '3', '4', '5', '6'];
const CAPACITY = 5;

const MASTER_NAMES = [
  "Paul Ehrler", "Sina Loeffler", "David Gawron", "Matteo Cavalera", "Josefine Renz",
  "Deni Sahovic", "Karla Pelc", "Arina Buerkle", "Louanne Kuhn", "Alara Kamci",
  "Georgios Sdrolias-Bilias", "Antonia Avallone", "Mailo Lukic", "Marius Loeding",
  "Malik Barth", "Yusuf Oezguel", "Gentian Alimetaj", "Celin Ditz",
  "taylin.tekdemirkoparan", "Lisa Schliwinski",
  "Benjamin Croll", "Michal Bednarczyk", "Leandro Buzov", "Mayla Friedrich",
  "Lilly Weissert", "Linda Kalt", "Kate Dorst", "Alina Laibel", "Franziska Ebers",
  "Gueney Gectan"
];

function emptyState() {
  const state = {};
  GROUP_IDS.forEach(id => { state[id] = []; });
  return state;
}

async function getLatestBlob() {
  const { blobs } = await list({ prefix: BLOB_PREFIX });
  if (!blobs.length) return null;
  blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  return blobs[0];
}

async function readState() {
  const blob = await getLatestBlob();
  if (!blob) return emptyState();

  const res = await fetch(blob.url, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
  });
  if (!res.ok) return emptyState();
  try {
    const data = await res.json();
    const state = emptyState();
    GROUP_IDS.forEach(id => {
      if (Array.isArray(data[id])) state[id] = data[id];
    });
    return state;
  } catch {
    return emptyState();
  }
}

async function writeState(state) {
  const filename = `${BLOB_PREFIX}${Date.now()}.json`;
  await put(filename, JSON.stringify(state), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
  });

  // clean up old files, keep only latest
  const { blobs } = await list({ prefix: BLOB_PREFIX });
  if (blobs.length > 1) {
    blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    const toDelete = blobs.slice(1).map(b => b.url);
    await del(toDelete);
  }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const state = await readState();
    res.status(200).json({ state, capacity: CAPACITY, master: MASTER_NAMES });
    return;
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    body = body || {};
    const { group, name, action } = body;

    if (!GROUP_IDS.includes(String(group))) {
      res.status(400).json({ error: 'Ungültige Gruppe' });
      return;
    }
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Name fehlt' });
      return;
    }
    if (!MASTER_NAMES.includes(name)) {
      res.status(400).json({ error: 'Name nicht in der Liste' });
      return;
    }

    const state = await readState();
    const gid = String(group);

    if (action === 'remove') {
      state[gid] = state[gid].filter(n => n !== name);
      await writeState(state);
      res.status(200).json({ state, capacity: CAPACITY, master: MASTER_NAMES });
      return;
    }

    const alreadyIn = GROUP_IDS.find(id => state[id].includes(name));
    if (alreadyIn) {
      res.status(409).json({ error: `"${name}" ist schon in Gruppe ${alreadyIn} eingetragen`, state, capacity: CAPACITY, master: MASTER_NAMES });
      return;
    }
    if (state[gid].length >= CAPACITY) {
      res.status(409).json({ error: 'Diese Gruppe ist bereits voll (5/5)', state, capacity: CAPACITY, master: MASTER_NAMES });
      return;
    }

    state[gid].push(name);
    await writeState(state);
    res.status(200).json({ state, capacity: CAPACITY, master: MASTER_NAMES });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
