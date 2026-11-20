export function createFirestoreStore({ db, firestore, pipelines, uid }) {
  const {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    serverTimestamp,
    setDoc,
    updateDoc,
  } = firestore;
  const { execute, field } = pipelines;
  const userPath = `users/${uid}`;
  const settingsRef = doc(db, userPath, "settings", "preferences");
  let state = { events: [], goals: [], preferences: null };

  function collectionPath(name) {
    return `${userPath}/${name}`;
  }

  async function readCollection(name, orderings) {
    const query = db.pipeline().collection(collectionPath(name)).sort(...orderings);
    const snapshot = await execute(query);
    return snapshot.results.map((result) => ({
      id: result.ref.id,
      ...result.data(),
    }));
  }

  async function seedOnce(initialData) {
    const userRef = doc(db, "users", uid);
    const userSnapshot = await getDoc(userRef);
    if (!userSnapshot.exists()) {
      await setDoc(userRef, {
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const settingsSnapshot = await getDoc(settingsRef);
    if (settingsSnapshot.exists()) return;

    const seed = typeof initialData === "function" ? initialData() : initialData;
    const writes = [];

    for (const event of seed.events) {
      const { id, ...data } = event;
      const ref = doc(db, collectionPath("events"), id);
      writes.push(getDoc(ref).then((snapshot) => {
        if (snapshot.exists()) return undefined;
        return setDoc(ref, {
          ...data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }));
    }

    for (const goal of seed.goals) {
      const { id, ...data } = goal;
      const ref = doc(db, collectionPath("goals"), id);
      writes.push(getDoc(ref).then((snapshot) => {
        if (snapshot.exists()) return undefined;
        return setDoc(ref, {
          ...data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }));
    }

    await Promise.all(writes);
    await setDoc(settingsRef, {
      ...seed.preferences,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async function load(initialData) {
    await seedOnce(initialData);
    const [events, goals, preferencesSnapshot] = await Promise.all([
      readCollection("events", [
        field("date").ascending(),
        field("startTime").ascending(),
        field("__name__").ascending(),
      ]),
      readCollection("goals", [
        field("title").ascending(),
        field("__name__").ascending(),
      ]),
      getDoc(settingsRef),
    ]);

    state = {
      events,
      goals,
      preferences: preferencesSnapshot.data(),
    };
    return state;
  }

  async function addEvent(data) {
    const ref = await addDoc(collection(db, collectionPath("events")), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    state.events.push({ ...data, id: ref.id });
    return state;
  }

  async function updateEvent(id, patch) {
    await updateDoc(doc(db, collectionPath("events"), id), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
    state.events = state.events.map((item) => item.id === id ? { ...item, ...patch } : item);
    return state;
  }

  async function removeEvent(id) {
    await deleteDoc(doc(db, collectionPath("events"), id));
    state.events = state.events.filter((item) => item.id !== id);
    return state;
  }

  async function addGoal(data) {
    const ref = await addDoc(collection(db, collectionPath("goals")), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    state.goals.push({ ...data, id: ref.id });
    return state;
  }

  async function updateGoal(id, patch) {
    await updateDoc(doc(db, collectionPath("goals"), id), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
    state.goals = state.goals.map((item) => item.id === id ? { ...item, ...patch } : item);
    return state;
  }

  async function removeGoal(id) {
    await deleteDoc(doc(db, collectionPath("goals"), id));
    state.goals = state.goals.filter((item) => item.id !== id);
    return state;
  }

  async function savePreferences(preferences) {
    await updateDoc(settingsRef, {
      ...preferences,
      updatedAt: serverTimestamp(),
    });
    state.preferences = { ...state.preferences, ...preferences };
    return state;
  }

  return {
    addEvent,
    addGoal,
    load,
    removeEvent,
    removeGoal,
    savePreferences,
    updateEvent,
    updateGoal,
  };
}
