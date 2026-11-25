(function () {
  const defaultDate = formatIsoDate(new Date());
  let selectedDate = defaultDate;
  let cachedData = null;

  const categoryLabels = {
    task: "任務",
    appointment: "行程",
    short_goal: "短期目標",
    habit: "習慣",
  };

  function getSettingCards() {
    return [...document.querySelectorAll("#settings .setting-card")];
  }

  function ensureGmailReminderSettingsCard() {
    const grid = document.querySelector("#settings .settings-grid");
    if (!grid || document.getElementById("gmailReminderSettingsCard")) return;
    const card = document.createElement("section");
    card.className = "setting-card";
    card.id = "gmailReminderSettingsCard";
    card.innerHTML = `
      <h3>Gmail 每日代辦提醒</h3>
      <p>每天在你設定的時間寄送尚未完成的今日代辦事項。</p>
      <div class="field"><label for="gmailRecipient">通知寄送到登入的 Google 信箱</label><input id="gmailRecipient" type="email" autocomplete="email" placeholder="請用 Google 帳號登入" readonly></div>
      <div class="switch-row"><span>啟用每日代辦郵件</span><input id="dailyTaskEmailEnabled" type="checkbox" class="switch" aria-label="啟用每日代辦郵件"></div>
      <div class="field"><label for="dailyTaskEmailTime">寄送時間</label><input id="dailyTaskEmailTime" type="time" value="08:00"></div>
      <p class="email-reminder-status" id="gmailReminderSetupStatus" aria-live="polite"></p>`;
    grid.appendChild(card);
    const style = document.createElement("style");
    style.textContent = ".email-reminder-status{margin:10px 0 0!important;padding:9px 10px;border-radius:9px;background:#f7f5ec;color:#786b42!important;font-size:11px!important}.email-reminder-status.ready{background:#edf4ed;color:#426447!important}.goal-reminder-settings{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;padding:10px 0;border-top:1px solid #f0f1ed;font-size:12px}.goal-reminder-settings label{display:flex;align-items:center;gap:7px}.goal-reminder-settings input[type=time]{width:112px;padding:5px;border:1px solid #e1e5de;border-radius:8px;background:#fff}.goal-summary-empty,.goal-empty-state{margin:0;color:#798078;font-size:12px}.goal-empty-state{padding:18px;background:#fff;border:1px dashed #dfe3dc;border-radius:14px;grid-column:1/-1}";
    document.head.appendChild(style);
  }

  ensureGmailReminderSettingsCard();

  function readPreferencesFromForm() {
    const cards = getSettingCards();
    const notificationWindow = cards[0]?.querySelector("select")?.selectedIndex ?? 0;
    const repeatText = cards[1]?.querySelector("select")?.value ?? "每 1 小時";
    const snoozeText = cards[2]?.querySelector("select")?.value ?? "1 小時後";
    const reviewText = cards[3]?.querySelector("select")?.value ?? "每週";
    const checkboxes = (card) => [...(card?.querySelectorAll('input[type="checkbox"]') ?? [])];
    const quietTimes = [...(cards[1]?.querySelectorAll('input[type="time"]') ?? [])];
    const card1Checks = checkboxes(cards[0]);
    const card2Checks = checkboxes(cards[1]);
    const card3Checks = checkboxes(cards[2]);
    const card4Checks = checkboxes(cards[3]);

    return {
      lineNotifications: card1Checks[0]?.checked ?? true,
      notificationWindow: ["per_item", "all_day", "weekdays"][notificationWindow] ?? "per_item",
      repeatReminderHours: Number((repeatText.match(/\d+/) ?? ["1"])[0]),
      quietStart: quietTimes[0]?.value || "22:00",
      quietEnd: quietTimes[1]?.value || "08:00",
      resumeAfterQuiet: card2Checks[0]?.checked ?? true,
      quickComplete: card3Checks[0]?.checked ?? true,
      allowSnooze: card3Checks[1]?.checked ?? true,
      defaultSnooze: snoozeText.includes("30") ? "30m" : snoozeText.includes("明天") ? "tomorrow" : "1h",
      goalReviewFrequency: reviewText.includes("每日") ? "daily" : reviewText.includes("每月") ? "monthly" : "weekly",
      progressSuggestions: card4Checks[0]?.checked ?? true,
      gmailRecipient: document.getElementById("gmailRecipient")?.value.trim() || "",
      dailyTaskEmailEnabled: document.getElementById("dailyTaskEmailEnabled")?.checked ?? false,
      dailyTaskEmailTime: document.getElementById("dailyTaskEmailTime")?.value || "08:00",
    };
  }

  function applyPreferences(preferences) {
    if (!preferences) return;
    const cards = getSettingCards();
    const setChecks = (card, values) => {
      [...(card?.querySelectorAll('input[type="checkbox"]') ?? [])].forEach((input, index) => {
        if (values[index] !== undefined) input.checked = values[index];
      });
    };
    const setSelectText = (select, text) => {
      if (!select) return;
      const option = [...select.options].find((item) => item.textContent.trim() === text);
      if (option) select.value = option.value;
    };

    setChecks(cards[0], [preferences.lineNotifications]);
    setSelectText(cards[0]?.querySelector("select"), {
      per_item: "依照各項目設定",
      all_day: "全天通知",
      weekdays: "僅限工作日",
    }[preferences.notificationWindow]);
    setSelectText(cards[1]?.querySelector("select"), `每 ${preferences.repeatReminderHours} 小時`);
    const quietTimes = [...(cards[1]?.querySelectorAll('input[type="time"]') ?? [])];
    if (quietTimes[0]) quietTimes[0].value = preferences.quietStart;
    if (quietTimes[1]) quietTimes[1].value = preferences.quietEnd;
    setChecks(cards[1], [preferences.resumeAfterQuiet]);
    setChecks(cards[2], [preferences.quickComplete, preferences.allowSnooze]);
    setSelectText(cards[2]?.querySelector("select"), {
      "30m": "30 分鐘後",
      "1h": "1 小時後",
      tomorrow: "明天早上",
    }[preferences.defaultSnooze]);
    setSelectText(cards[3]?.querySelector("select"), {
      daily: "每日",
      weekly: "每週",
      monthly: "每月",
    }[preferences.goalReviewFrequency]);
    setChecks(cards[3], [preferences.progressSuggestions]);
    const recipient = document.getElementById("gmailRecipient");
    if (recipient) recipient.value = preferences.gmailRecipient || "";
    const dailyEnabled = document.getElementById("dailyTaskEmailEnabled");
    if (dailyEnabled) dailyEnabled.checked = Boolean(preferences.dailyTaskEmailEnabled);
    const dailyTime = document.getElementById("dailyTaskEmailTime");
    if (dailyTime) dailyTime.value = preferences.dailyTaskEmailTime || "08:00";
  }

  window.setGmailReminderRecipientDefault = (email) => {
    const recipient = document.getElementById("gmailRecipient");
    if (recipient) recipient.value = email;
  };

  window.setGmailReminderAccount = ({ email, hasGoogleAccount }) => {
    const recipient = document.getElementById("gmailRecipient");
    const enabled = document.getElementById("dailyTaskEmailEnabled");
    if (recipient) recipient.value = hasGoogleAccount ? (email || "") : "";
    if (enabled) {
      enabled.disabled = !hasGoogleAccount;
      if (!hasGoogleAccount) enabled.checked = false;
    }
    if (!hasGoogleAccount) {
      window.setGmailReminderServiceStatus("Gmail 提醒需使用已驗證的 Google 帳號登入。", false);
    }
  };

  window.setGmailReminderServiceStatus = (message, ready) => {
    const status = document.getElementById("gmailReminderSetupStatus");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("ready", Boolean(ready));
    window.gmailReminderServiceReady = Boolean(ready);
  };

  function mapCategory(label) {
    if (label.includes("習慣")) return "habit";
    if (label.includes("行程")) return "appointment";
    if (label.includes("短期目標")) return "short_goal";
    return "task";
  }

  function collectInitialData() {
    return { events: [], goals: [], preferences: readPreferencesFromForm() };
  }

  function formatIsoDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatDateLabel(isoDate) {
    const date = new Date(`${isoDate}T00:00:00`);
    return new Intl.DateTimeFormat("zh-TW", { month: "long", day: "numeric", weekday: "short" }).format(date);
  }

  function setSelectedDate(isoDate) {
    selectedDate = isoDate;
    const dateLabel = document.getElementById("dateLabel");
    const todayLabel = isoDate === formatIsoDate(new Date()) ? "・今天" : "・所選日期";
    if (dateLabel) dateLabel.textContent = `${formatDateLabel(isoDate)}${todayLabel}`;
    const dayBanner = document.querySelector(".day-banner strong");
    if (dayBanner) dayBanner.textContent = formatDateLabel(isoDate);
    if (cachedData) renderData(cachedData);
  }

  function createEventCard(item, indexInHour) {
    const element = document.createElement("div");
    element.className = `event${item.done ? " done" : ""}`;
    element.dataset.firestoreId = item.id;
    element.style.top = `${4 + indexInHour * 52}px`;

    const details = document.createElement("div");
    const title = document.createElement("div");
    title.className = "event-title";
    title.textContent = item.title;
    const meta = document.createElement("div");
    meta.className = "event-meta";
    meta.textContent = `${item.startTime} – ${item.endTime} ・${categoryLabels[item.category] || "任務"}`;
    details.append(title, meta);

    const controls = document.createElement("div");
    controls.className = "event-controls";
    const check = document.createElement("span");
    check.className = "check";
    check.textContent = item.done ? "✓" : "";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "delete-item";
    remove.title = "刪除項目";
    remove.setAttribute("aria-label", `刪除${item.title}`);
    remove.textContent = "×";
    remove.onclick = (event) => {
      event.stopPropagation();
      window.deleteItem(remove);
    };
    controls.append(check, remove);
    element.append(details, controls);
    return element;
  }

  function renderEvents(data) {
    document.querySelectorAll("#timeline .time-row[data-generated='true']").forEach((row) => row.remove());
    document.querySelectorAll("#timeline .time-row").forEach((row) => {
      row.style.height = "";
    });
    document.querySelectorAll("#timeline .event").forEach((element) => element.remove());
    const hourlyCounts = new Map();
    const dayEvents = data.events.filter((item) => item.date === selectedDate);

    dayEvents.forEach((item) => {
      const hourLabel = `${item.startTime.slice(0, 2)}:00`;
      let row = [...document.querySelectorAll("#timeline .time-row")]
        .find((candidate) => candidate.querySelector(".time-label")?.textContent.trim() === hourLabel);
      if (!row) {
        row = document.createElement("div");
        row.className = "time-row";
        row.dataset.generated = "true";
        const label = document.createElement("span");
        label.className = "time-label";
        label.textContent = hourLabel;
        row.appendChild(label);
        document.getElementById("timeline").appendChild(row);
      }
      const count = hourlyCounts.get(hourLabel) || 0;
      hourlyCounts.set(hourLabel, count + 1);
      row.style.height = `${Math.max(66, 58 + count * 52)}px`;
      row.appendChild(createEventCard(item, count));
    });

    window.updateCounts();
  }

  function renderGoals(data) {
    const grid = document.getElementById("goalGrid");
    grid.replaceChildren();
    if (!data.goals.length) {
      const empty = document.createElement("p");
      empty.className = "goal-empty-state";
      empty.textContent = "目前沒有長期目標。按右上角「新增目標」，建立你的第一個目標。";
      grid.appendChild(empty);
    }
    data.goals.forEach((item) => {
      const card = document.createElement("article");
      card.className = "goal-card";
      card.dataset.firestoreId = item.id;
      const head = document.createElement("div");
      head.className = "goal-card-head";
      const title = document.createElement("h3");
      title.textContent = item.title;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "delete-item";
      remove.textContent = "×";
      remove.title = "刪除目標";
      remove.setAttribute("aria-label", `刪除${item.title}`);
      remove.onclick = () => window.deleteGoal(remove);
      head.append(title, remove);

      const description = document.createElement("p");
      description.textContent = item.description;
      const progress = document.createElement("div");
      progress.className = "progress";
      const bar = document.createElement("span");
      bar.style.width = `${item.progress}%`;
      progress.appendChild(bar);
      const detail = document.createElement("div");
      detail.className = "goal-detail";
      const progressLabel = document.createElement("span");
      progressLabel.textContent = `目前進度 ${item.progress}%`;
      const deadline = document.createElement("span");
      deadline.textContent = `期限 ${item.deadline || "未設定"}`;
      detail.append(progressLabel, deadline);
      const detail2 = document.createElement("div");
      detail2.className = "goal-detail";
      const hours = document.createElement("span");
      hours.textContent = `每週投入 ${item.weeklyHours} 小時`;
      const adjust = document.createElement("button");
      adjust.className = "text-link";
      adjust.textContent = "滾動調整 →";
      adjust.onclick = () => window.adjustGoal(adjust);
      detail2.append(hours, adjust);
      card.append(head, description, progress, detail, detail2);

      const reminderSettings = document.createElement("div");
      reminderSettings.className = "goal-reminder-settings";
      const reminderLabel = document.createElement("label");
      const reminderEnabled = document.createElement("input");
      reminderEnabled.type = "checkbox";
      reminderEnabled.checked = Boolean(item.emailReminderEnabled);
      reminderEnabled.setAttribute("aria-label", `啟用${item.title}的 Gmail 提醒`);
      const reminderText = document.createElement("span");
      reminderText.textContent = "每日 Gmail 提醒";
      reminderLabel.append(reminderEnabled, reminderText);
      const reminderTime = document.createElement("input");
      reminderTime.type = "time";
      reminderTime.value = item.emailReminderTime || "09:00";
      reminderTime.setAttribute("aria-label", `${item.title} 的 Gmail 提醒時間`);
      reminderEnabled.addEventListener("change", async () => {
        try {
          renderData(await getStore().updateGoal(item.id, { emailReminderEnabled: reminderEnabled.checked }));
          window.toast(reminderEnabled.checked ? "已啟用目標 Gmail 提醒" : "已關閉目標 Gmail 提醒");
        } catch (error) {
          showSaveError(error);
        }
      });
      reminderTime.addEventListener("change", async () => {
        try {
          renderData(await getStore().updateGoal(item.id, { emailReminderTime: reminderTime.value || "09:00" }));
          window.toast("已儲存目標提醒時間");
        } catch (error) {
          showSaveError(error);
        }
      });
      reminderSettings.append(reminderLabel, reminderTime);
      card.appendChild(reminderSettings);
      grid.appendChild(card);
    });

    const summaryPanel = document.querySelector("#home .sidecol .panel");
    if (summaryPanel) {
      const panelHead = summaryPanel.querySelector(".panel-head");
      summaryPanel.replaceChildren(panelHead);
      if (!data.goals.length) {
        const empty = document.createElement("p");
        empty.className = "goal-summary-empty";
        empty.textContent = "目前沒有長期目標，新增後會顯示在這裡。";
        summaryPanel.appendChild(empty);
      } else {
        data.goals.slice(0, 2).forEach((item) => {
          const goal = document.createElement("div");
          goal.className = "goal";
          const top = document.createElement("div");
          top.className = "goal-top";
          const name = document.createElement("span");
          name.className = "goal-name";
          name.textContent = item.title;
          const deadline = document.createElement("span");
          deadline.className = "goal-date";
          deadline.textContent = item.deadline || "持續進行";
          top.append(name, deadline);
          const bar = document.createElement("div");
          bar.className = "progress";
          const fill = document.createElement("span");
          fill.style.width = `${item.progress}%`;
          bar.appendChild(fill);
          const meta = document.createElement("div");
          meta.className = "goal-meta";
          const progressLabel = document.createElement("span");
          progressLabel.textContent = `進度 ${item.progress}%`;
          const hoursLabel = document.createElement("span");
          hoursLabel.textContent = `每週投入 ${item.weeklyHours} 小時`;
          meta.append(progressLabel, hoursLabel);
          goal.append(top, bar, meta);
          summaryPanel.appendChild(goal);
        });
      }
    }
  }

  function renderWeek(data) {
    const selected = new Date(`${selectedDate}T00:00:00`);
    const monday = new Date(selected);
    monday.setDate(selected.getDate() - ((selected.getDay() + 6) % 7));
    const container = document.getElementById("weekView");
    container.replaceChildren();
    for (let offset = 0; offset < 7; offset += 1) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + offset);
      const iso = formatIsoDate(date);
      const day = document.createElement("div");
      day.className = `week-day${iso === selectedDate ? " today" : ""}`;
      day.onclick = () => setSelectedDate(iso);
      const label = document.createElement("div");
      label.className = "week-day-head";
      label.textContent = `${new Intl.DateTimeFormat("zh-TW", { weekday: "short" }).format(date)} ${date.getMonth() + 1}/${date.getDate()}`;
      day.appendChild(label);
      data.events.filter((item) => item.date === iso).forEach((item) => {
        const mini = document.createElement("div");
        mini.className = "week-mini";
        mini.textContent = item.title;
        const time = document.createElement("small");
        time.textContent = item.startTime;
        mini.appendChild(time);
        day.appendChild(mini);
      });
      container.appendChild(day);
    }
  }

  function renderMonth(data) {
    const selected = new Date(`${selectedDate}T00:00:00`);
    const firstOfMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
    const offset = (firstOfMonth.getDay() + 6) % 7;
    const firstCell = new Date(firstOfMonth);
    firstCell.setDate(firstOfMonth.getDate() - offset);
    const container = document.getElementById("monthView");
    container.replaceChildren();

    ["一", "二", "三", "四", "五", "六", "日"].forEach((label) => {
      const heading = document.createElement("div");
      heading.className = "month-day-head";
      heading.style.padding = "0 7px 5px";
      heading.style.color = "#828980";
      heading.textContent = label;
      container.appendChild(heading);
    });

    for (let index = 0; index < 42; index += 1) {
      const date = new Date(firstCell);
      date.setDate(firstCell.getDate() + index);
      const iso = formatIsoDate(date);
      const entries = data.events.filter((item) => item.date === iso);
      const cell = document.createElement("div");
      cell.className = `month-day${date.getMonth() === selected.getMonth() ? "" : " outside"}${iso === selectedDate ? " today" : ""}`;
      cell.onclick = () => setSelectedDate(iso);
      const head = document.createElement("div");
      head.className = "month-day-head";
      const dayNumber = document.createElement("span");
      dayNumber.textContent = String(date.getDate());
      const count = document.createElement("span");
      count.style.color = "#71836c";
      count.textContent = entries.length ? `${entries.length} 項` : "";
      head.append(dayNumber, count);
      cell.appendChild(head);
      entries.slice(0, 2).forEach((item) => {
        const entry = document.createElement("div");
        entry.className = "month-entry";
        entry.textContent = item.title;
        cell.appendChild(entry);
      });
      if (entries.length > 2) {
        const more = document.createElement("div");
        more.className = "month-entry more";
        more.textContent = `+${entries.length - 2} 項`;
        cell.appendChild(more);
      }
      container.appendChild(cell);
    }
  }

  function renderData(data) {
    cachedData = data;
    applyPreferences(data.preferences);
    renderEvents(data);
    renderGoals(data);
    renderWeek(data);
    if (document.getElementById("calendar")?.classList.contains("monthmode")) renderMonth(data);
    updateScheduleSummary(data);
  }

  function updateScheduleSummary(data) {
    const dayEvents = data.events
      .filter((item) => item.date === selectedDate)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    const upcoming = dayEvents.find((item) => !item.done) || dayEvents[0];
    const nextStat = document.querySelector(".summary .stat:nth-child(3)");
    if (nextStat) {
      nextStat.querySelector(".stat-value").textContent = upcoming?.startTime || "尚無行程";
      nextStat.querySelector(".stat-note").textContent = upcoming?.title || "新增項目開始安排";
    }

    const weekStart = new Date(`${selectedDate}T00:00:00`);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const startDate = formatIsoDate(weekStart);
    const endDate = formatIsoDate(weekEnd);
    const weekEvents = data.events.filter((item) => item.date >= startDate && item.date <= endDate);
    const completed = weekEvents.filter((item) => item.done).length;
    const progress = weekEvents.length ? Math.round((completed / weekEvents.length) * 100) : 0;
    const weekCard = document.querySelector(".week-card");
    if (weekCard) {
      weekCard.querySelector("p").textContent = `本週已完成 ${completed} / ${weekEvents.length} 項目`;
      weekCard.querySelector(".progress span").style.width = `${progress}%`;
      weekCard.querySelector(".week-foot strong").textContent = `${progress}%`;
    }
  }

  function getStore() {
    if (!window.firestoreStore) throw new Error("Firestore 尚未載入，請重新登入後再試。");
    return window.firestoreStore;
  }

  function showSaveError(error) {
    console.error("Could not save Firestore data.", error);
    window.toast("資料儲存失敗，請檢查 Firestore 設定與網路後重試。");
  }

  const originalOpenModal = window.openModal;
  window.openModal = (type) => {
    originalOpenModal(type);
    const content = document.getElementById("modalContent");
    if (type === "goal") {
      const deadline = content.querySelector('input[type="date"]');
      const hours = content.querySelector('input[type="number"]');
      if (deadline) deadline.id = "goalDeadline";
      if (hours) hours.id = "goalHours";
      const reminder = document.createElement("div");
      reminder.className = "goal-reminder-settings";
      reminder.innerHTML = '<label><input id="goalEmailReminderEnabled" type="checkbox"><span>每日寄送此目標提醒</span></label><input id="goalEmailReminderTime" type="time" value="09:00" aria-label="目標提醒時間">';
      content.appendChild(reminder);
      return;
    }
    const date = content.querySelector('input[type="date"]');
    const times = [...content.querySelectorAll('input[type="time"]')];
    const selects = [...content.querySelectorAll("select")];
    if (date) {
      date.id = "itemDate";
      date.value = selectedDate;
    }
    if (times[0]) times[0].id = "itemStartTime";
    if (times[1]) times[1].id = "itemEndTime";
    if (selects[1]) selects[1].id = "itemReminder";
  };

  window.collectInitialFirestoreData = collectInitialData;
  window.renderFirestoreData = renderData;
  window.setFirestoreSelectedDate = setSelectedDate;

  window.shiftDate = (amount) => {
    const date = new Date(`${selectedDate}T00:00:00`);
    date.setDate(date.getDate() + amount);
    setSelectedDate(formatIsoDate(date));
  };

  window.setCalendarView = (view) => {
    document.getElementById("calendar").classList.toggle("weekmode", view === "week");
    document.getElementById("calendar").classList.toggle("monthmode", view === "month");
    document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
    if (view === "week" && cachedData) renderWeek(cachedData);
    if (view === "month" && cachedData) renderMonth(cachedData);
  };

  window.selectMonthDay = (day) => {
    const date = new Date(`${selectedDate}T00:00:00`);
    date.setDate(1);
    date.setDate(day);
    setSelectedDate(formatIsoDate(date));
    window.setCalendarView("day");
  };

  window.saveItem = async () => {
    const content = document.getElementById("modalContent");
    const title = content.querySelector("#itemName")?.value.trim();
    if (!title) {
      window.toast("請先輸入名稱");
      return;
    }
    try {
      if (content.querySelector("#itemType")) {
        const label = content.querySelector("#itemType").value;
        const reminderLabel = content.querySelector("#itemReminder")?.value || "不提醒";
        const date = content.querySelector("#itemDate")?.value || selectedDate;
        const result = await getStore().addEvent({
          title,
          category: mapCategory(label),
          date,
          startTime: content.querySelector("#itemStartTime")?.value || "15:00",
          endTime: content.querySelector("#itemEndTime")?.value || "16:00",
          reminder: reminderLabel.includes("LINE") ? "line" : "none",
          done: false,
        });
        selectedDate = date;
        setSelectedDate(date);
        renderData(result);
      } else {
        const hours = Number(content.querySelector("#goalHours")?.value || 3);
        const result = await getStore().addGoal({
          title,
          description: content.querySelector("#goalDescription")?.value.trim() || "持續前進，定期檢視並調整計畫。",
          deadline: content.querySelector("#goalDeadline")?.value || "",
          weeklyHours: hours,
          progress: 0,
          emailReminderEnabled: content.querySelector("#goalEmailReminderEnabled")?.checked || false,
          emailReminderTime: content.querySelector("#goalEmailReminderTime")?.value || "09:00",
        });
        renderData(result);
      }
      window.closeModal();
      window.toast(`已新增「${title}」並儲存`);
    } catch (error) {
      showSaveError(error);
    }
  };

  window.deleteItem = async (button) => {
    const card = button.closest(".event[data-firestore-id]");
    if (!card) return;
    const name = card.querySelector(".event-title")?.textContent || "這個項目";
    if (!confirm(`確定刪除「${name}」？此操作無法復原。`)) return;
    try {
      renderData(await getStore().removeEvent(card.dataset.firestoreId));
      window.toast(`已刪除「${name}」`);
    } catch (error) {
      showSaveError(error);
    }
  };

  window.deleteGoal = async (button) => {
    const card = button.closest(".goal-card[data-firestore-id]");
    if (!card) return;
    const name = card.querySelector("h3")?.textContent || "這個目標";
    if (!confirm(`確定刪除「${name}」？此操作無法復原。`)) return;
    try {
      renderData(await getStore().removeGoal(card.dataset.firestoreId));
      window.toast(`已刪除「${name}」`);
    } catch (error) {
      showSaveError(error);
    }
  };

  window.adjustGoal = async (button) => {
    const card = button.closest(".goal-card[data-firestore-id]");
    if (!card) return;
    const goal = cachedData?.goals.find((item) => item.id === card.dataset.firestoreId);
    if (!goal) return;
    const answer = prompt(`調整「${goal.title}」的每週投入時間（0–168 小時）：`, String(goal.weeklyHours));
    if (answer === null || !answer.trim()) return;
    const weeklyHours = Number(answer);
    if (!Number.isFinite(weeklyHours) || weeklyHours < 0 || weeklyHours > 168) {
      window.toast("請輸入 0 到 168 之間的數字");
      return;
    }
    try {
      renderData(await getStore().updateGoal(goal.id, { weeklyHours }));
      window.toast(`已更新「${goal.title}」`);
    } catch (error) {
      showSaveError(error);
    }
  };

  window.saveSettings = async () => {
    const preferences = readPreferencesFromForm();
    if (preferences.dailyTaskEmailEnabled && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(preferences.gmailRecipient)) {
      window.toast("請輸入有效的收件 Gmail 地址");
      return;
    }
    try {
      renderData(await getStore().savePreferences(preferences));
      window.toast(window.gmailReminderServiceReady
        ? "通知設定已儲存，Gmail 提醒已同步"
        : "通知設定已儲存；完成 Gmail 寄送服務設定後才會寄出");
    } catch (error) {
      showSaveError(error);
    }
  };

  document.addEventListener("click", async (event) => {
    const card = event.target.closest(".event[data-firestore-id]");
    if (!card || event.target.closest("button")) return;
    const item = cachedData?.events.find((candidate) => candidate.id === card.dataset.firestoreId);
    if (!item) return;
    try {
      renderData(await getStore().updateEvent(item.id, { done: !item.done }));
      window.toast(!item.done ? "已標記完成並儲存" : "已恢復未完成並儲存");
    } catch (error) {
      showSaveError(error);
    }
  });
})();
