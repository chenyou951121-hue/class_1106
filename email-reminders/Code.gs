const REMINDER_KEY_PREFIX = "gmail-reminder-user:";
const REMINDER_DATA_CHUNK_SIZE = 1800;
const TIME_ZONE = "Asia/Taipei";
const MAX_DAILY_RECIPIENTS = 80;

function doPost(event) {
  try {
    const payload = JSON.parse(event?.postData?.contents || "{}");
    const user = verifyFirebaseUser(payload.idToken);
    if (!user) return jsonOutput({ ok: false, error: "Sign in again to sync reminders." });

    const preferences = payload.preferences || {};
    const goals = Array.isArray(payload.goals) ? payload.goals : [];
    const hasEnabledReminder = Boolean(preferences.dailyTaskEmailEnabled) || goals.some((goal) => Boolean(goal.emailReminderEnabled));
    const key = REMINDER_KEY_PREFIX + user.uid;
    const properties = PropertiesService.getScriptProperties();
    if (!hasEnabledReminder) {
      deleteReminderRecord(properties, key);
      return jsonOutput({ ok: true });
    }
    if (!user.email || !user.emailVerified) {
      return jsonOutput({ ok: false, error: "Sign in with a verified Google account to enable Gmail reminders." });
    }

    const recipient = String(preferences.gmailRecipient || "").trim().toLowerCase();
    if (recipient !== user.email.toLowerCase()) {
      return jsonOutput({ ok: false, error: "The reminder recipient must match the signed-in Google account." });
    }

    const previous = JSON.parse(properties.getProperty(key) || "{}");
    const record = {
      uid: user.uid,
      email: user.email,
      preferences: {
        dailyTaskEmailEnabled: Boolean(preferences.dailyTaskEmailEnabled),
        dailyTaskEmailTime: validTime(preferences.dailyTaskEmailTime) ? preferences.dailyTaskEmailTime : "08:00",
      },
      events: (payload.events || []).slice(0, 500).map((item) => ({
        id: String(item.id || "").slice(0, 160),
        title: String(item.title || "").slice(0, 120),
        date: String(item.date || "").slice(0, 10),
        startTime: validTime(item.startTime) ? item.startTime : "09:00",
        done: Boolean(item.done),
      })),
      goals: goals.slice(0, 100).map((item) => ({
        id: String(item.id || "").slice(0, 160),
        title: String(item.title || "").slice(0, 120),
        deadline: String(item.deadline || "").slice(0, 10),
        progress: Math.max(0, Math.min(100, Number(item.progress) || 0)),
        emailReminderEnabled: Boolean(item.emailReminderEnabled),
        emailReminderTime: validTime(item.emailReminderTime) ? item.emailReminderTime : "09:00",
      })),
      lastSentDailyDate: previous.lastSentDailyDate || "",
      lastSentGoalDates: previous.lastSentGoalDates || {},
    };
    storeReminderRecord(properties, key, record);
    return jsonOutput({ ok: true });
  } catch (error) {
    console.error("Reminder sync failed", error);
    return jsonOutput({ ok: false, error: "Reminder sync failed." });
  }
}

function setupEmailReminderTrigger() {
  const existing = ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === "runEmailReminders");
  if (existing.length === 0) {
    ScriptApp.newTrigger("runEmailReminders").timeBased().everyMinutes(1).create();
  }
}

function runEmailReminders() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const now = new Date();
    const today = Utilities.formatDate(now, TIME_ZONE, "yyyy-MM-dd");
    const currentTime = Utilities.formatDate(now, TIME_ZONE, "HH:mm");
    const properties = PropertiesService.getScriptProperties();
    const all = properties.getProperties();

    Object.keys(all).forEach((key) => {
      if (!key.startsWith(REMINDER_KEY_PREFIX) || key.includes(":data:")) return;
      const record = loadReminderRecord(properties, key);
      if (!record) return;
      let changed = false;
      const recipient = String(record.email || "").trim();
      if (!recipient) return;

      const preferences = record.preferences || {};
      if (preferences.dailyTaskEmailEnabled && preferences.dailyTaskEmailTime === currentTime && record.lastSentDailyDate !== today) {
        const pending = (record.events || []).filter((item) => item.date === today && !item.done);
        if (pending.length) {
          const lines = pending
            .sort((a, b) => a.startTime.localeCompare(b.startTime))
            .map((item) => `• ${item.startTime}　${item.title}`);
          if (sendReminderEmail(recipient, `日序｜今日待辦事項（${today}）`, `這是你今天尚未完成的項目：\n\n${lines.join("\n")}\n\n查看日序：https://chenyou951121-hue.github.io/class_1106/`, today, properties)) {
            record.lastSentDailyDate = today;
            changed = true;
          }
        }
      }

      record.lastSentGoalDates = record.lastSentGoalDates || {};
      const dueGoals = (record.goals || []).filter((goal) =>
        goal.emailReminderEnabled && goal.progress < 100 && goal.emailReminderTime === currentTime &&
        record.lastSentGoalDates[goal.id] !== today);
      if (dueGoals.length) {
        const goalLines = dueGoals.map((goal) =>
          `• ${goal.title}（${goal.progress}%）${goal.deadline ? `・期限 ${goal.deadline}` : ""}`);
        if (sendReminderEmail(recipient, `日序｜長期目標提醒（${dueGoals.length} 項）`, `別忘了為你的長期目標留下一步：\n\n${goalLines.join("\n")}\n\n查看日序：https://chenyou951121-hue.github.io/class_1106/`, today, properties)) {
          dueGoals.forEach((goal) => { record.lastSentGoalDates[goal.id] = today; });
          changed = true;
        }
      }

      if (changed) storeReminderRecord(properties, key, record);
    });
  } finally {
    lock.releaseLock();
  }
}

function storeReminderRecord(properties, key, record) {
  const data = JSON.stringify({ events: record.events || [], goals: record.goals || [] });
  const chunks = [];
  for (let index = 0; index < data.length; index += REMINDER_DATA_CHUNK_SIZE) {
    chunks.push(data.slice(index, index + REMINDER_DATA_CHUNK_SIZE));
  }
  const current = properties.getProperties();
  Object.keys(current).forEach((propertyKey) => {
    if (!propertyKey.startsWith(`${key}:data:`)) return;
    const index = Number(propertyKey.slice(`${key}:data:`.length));
    if (!Number.isInteger(index) || index < 0 || index >= chunks.length) properties.deleteProperty(propertyKey);
  });
  chunks.forEach((chunk, index) => properties.setProperty(`${key}:data:${index}`, chunk));
  const manifest = { ...record, events: undefined, goals: undefined, dataChunkCount: chunks.length };
  properties.setProperty(key, JSON.stringify(manifest));
}

function loadReminderRecord(properties, key) {
  const manifest = JSON.parse(properties.getProperty(key) || "null");
  if (!manifest) return null;
  if (manifest.dataChunkCount === undefined) return manifest;
  const data = Array.from({ length: manifest.dataChunkCount }, (_, index) =>
    properties.getProperty(`${key}:data:${index}`) || "").join("");
  const reminderData = JSON.parse(data || "{}");
  return { ...manifest, ...reminderData };
}

function deleteReminderRecord(properties, key) {
  Object.keys(properties.getProperties()).forEach((propertyKey) => {
    if (propertyKey === key || propertyKey.startsWith(`${key}:data:`)) properties.deleteProperty(propertyKey);
  });
}

function sendReminderEmail(recipient, subject, body, today, properties) {
  const dateKey = "gmail-reminder-quota-date";
  const countKey = "gmail-reminder-quota-count";
  const currentDate = properties.getProperty(dateKey) || "";
  const sentCount = currentDate === today ? Number(properties.getProperty(countKey) || 0) : 0;
  if (sentCount >= MAX_DAILY_RECIPIENTS) return false;
  MailApp.sendEmail({ to: recipient, subject, body });
  properties.setProperty(dateKey, today);
  properties.setProperty(countKey, String(sentCount + 1));
  return true;
}

function verifyFirebaseUser(idToken) {
  if (!idToken) return null;
  const apiKey = PropertiesService.getScriptProperties().getProperty("FIREBASE_API_KEY");
  if (!apiKey) throw new Error("Set the FIREBASE_API_KEY script property first.");
  const response = UrlFetchApp.fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ idToken }),
      muteHttpExceptions: true,
    },
  );
  if (response.getResponseCode() !== 200) return null;
  const users = JSON.parse(response.getContentText()).users || [];
  const user = users[0];
  return user ? { uid: user.localId, email: user.email || "", emailVerified: Boolean(user.emailVerified) } : null;
}

function validTime(value) {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function jsonOutput(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
