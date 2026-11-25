export function createFirestoreStore({ db, firestore, uid }) {
  const {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
  } = firestore;
  const userPath = `users/${uid}`;
  const settingsRef = doc(db, userPath, "settings", "preferences");
  let state = { events: [], goals: [], preferences: null };

  function collectionPath(name) {
    return `${userPath}/${name}`;
  }

  async function readCollection(name, orderFields) {
    const collectionQuery = query(
      collection(db, collectionPath(name)),
      ...orderFields.map((fieldName) => orderBy(fieldName)),
    );
    const snapshot = await getDocs(collectionQuery);
    let documents = snapshot.docs;
    const demoPattern = name === "events" ? /^demo-event-\d+$/ : name === "goals" ? /^demo-goal-\d+$/ : null;
    if (demoPattern) {
      const demoDocuments = documents.filter(({ id }) => demoPattern.test(id));
      await Promise.all(demoDocuments.map((document) => deleteDoc(document.ref)));
      documents = documents.filter(({ id }) => !demoPattern.test(id));
    }
    if (name === "goals") {
      const goalsWithoutReminderFields = documents.filter((document) => {
        const data = document.data();
        return data.emailReminderEnabled === undefined || data.emailReminderTime === undefined;
      });
      await Promise.all(goalsWithoutReminderFields.map((document) => updateDoc(document.ref, {
        emailReminderEnabled: false,
        emailReminderTime: "09:00",
        updatedAt: serverTimestamp(),
      })));
    }
    return documents.map((document) => ({
      id: document.id,
      ...document.data(),
      ...(name === "goals" ? {
        emailReminderEnabled: document.data().emailReminderEnabled ?? false,
        emailReminderTime: document.data().emailReminderTime ?? "09:00",
      } : {}),
    }));
  }

  async function syncReminders() {
    if (typeof window.syncGmailReminders !== "function") return;
    await window.syncGmailReminders(state);
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
      readCollection("events", ["date", "startTime"]),
      readCollection("goals", ["title"]),
      getDoc(settingsRef),
    ]);

    state = {
      events,
      goals,
      preferences: preferencesSnapshot.data(),
    };
    await syncReminders();
    return state;
  }

  async function addEvent(data) {
    const ref = await addDoc(collection(db, collectionPath("events")), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    state.events.push({ ...data, id: ref.id });
    await syncReminders();
    return state;
  }

  async function updateEvent(id, patch) {
    await updateDoc(doc(db, collectionPath("events"), id), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
    state.events = state.events.map((item) => item.id === id ? { ...item, ...patch } : item);
    await syncReminders();
    return state;
  }

  async function removeEvent(id) {
    await deleteDoc(doc(db, collectionPath("events"), id));
    state.events = state.events.filter((item) => item.id !== id);
    await syncReminders();
    return state;
  }

  async function addGoal(data) {
    const ref = await addDoc(collection(db, collectionPath("goals")), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    state.goals.push({ ...data, id: ref.id });
    await syncReminders();
    return state;
  }

  async function updateGoal(id, patch) {
    await updateDoc(doc(db, collectionPath("goals"), id), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
    state.goals = state.goals.map((item) => item.id === id ? { ...item, ...patch } : item);
    await syncReminders();
    return state;
  }

  async function removeGoal(id) {
    await deleteDoc(doc(db, collectionPath("goals"), id));
    state.goals = state.goals.filter((item) => item.id !== id);
    await syncReminders();
    return state;
  }

  async function savePreferences(preferences) {
    await updateDoc(settingsRef, {
      ...preferences,
      updatedAt: serverTimestamp(),
    });
    state.preferences = { ...state.preferences, ...preferences };
    await syncReminders();
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
