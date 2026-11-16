// Stores only NEW incoming articles in Firebase Firestore (free Spark plan).
// Never imports the old archive. Silently skips when the service account
// secret is missing or Firestore is not enabled yet, so fetching never stops.
let dbPromise = null;

async function getDb() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  if (!dbPromise) {
    dbPromise = (async () => {
      const { initializeApp, cert, getApps } = await import("firebase-admin/app");
      const { getFirestore } = await import("firebase-admin/firestore");
      const app = getApps()[0] || initializeApp({ credential: cert(JSON.parse(raw)) });
      return getFirestore(app);
    })();
  }
  return dbPromise;
}

export async function syncFirestore(lang, fresh) {
  const db = await getDb();
  if (!db) return { enabled: false, written: 0 };
  let written = 0;
  // stay far below the free 20k writes/day: at most 400 docs per run & language
  const batchItems = fresh.slice(0, 400);
  for (let i = 0; i < batchItems.length; i += 400) {
    const batch = db.batch();
    for (const a of batchItems.slice(i, i + 400)) {
      if (!a?.fingerprint) continue;
      const ref = db.collection("articles").doc(String(a.fingerprint));
      batch.create(ref, { ...JSON.parse(JSON.stringify(a)), lang, stored_at: new Date().toISOString() });
      written++;
    }
    try {
      await batch.commit();
    } catch (e) {
      // ALREADY_EXISTS => commit per doc so existing ones are never overwritten
      if (e?.code === 6) {
        written = 0;
        for (const a of batchItems) {
          try { await db.collection("articles").doc(String(a.fingerprint)).create({ ...JSON.parse(JSON.stringify(a)), lang, stored_at: new Date().toISOString() }); written++; } catch { /* exists */ }
        }
      } else throw e;
    }
  }
  return { enabled: true, written };
}
