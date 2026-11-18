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

export async function syncFirestore(lang, fresh, database) {
  const db = database || await getDb();
  if (!db) return { enabled: false, written: 0 };
  let written = 0;
  // Chunk transactions, not article count: retain every incoming story.
  const batchItems = fresh.filter(a => a?.fingerprint);
  for (let i = 0; i < batchItems.length; i += 400) {
    const batch = db.batch();
    for (const a of batchItems.slice(i, i + 400)) {
      if (!a?.fingerprint) continue;
      const ref = db.collection("articles").doc(String(a.fingerprint));
      batch.create(ref, { ...JSON.parse(JSON.stringify(a)), lang, stored_at: new Date().toISOString() });
    }
    try {
      await batch.commit();
      written += batchItems.slice(i, i + 400).length;
    } catch (e) {
      // ALREADY_EXISTS => commit per doc so existing ones are never overwritten
      if (e?.code === 6) {
        for (const a of batchItems.slice(i, i + 400)) {
          try { await db.collection("articles").doc(String(a.fingerprint)).create({ ...JSON.parse(JSON.stringify(a)), lang, stored_at: new Date().toISOString() }); written++; } catch (error) { if (error?.code !== 6) throw error; }
        }
      } else throw e;
    }
  }
  return { enabled: true, written };
}
