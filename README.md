# 日序｜個人行程與目標

日序是個人行程、任務與長期目標管理的網頁原型。Google 與 LINE 登入程式已接入 Firebase Authentication；Firebase Console 的提供者設定仍須完成，Web app 設定放在 `firebase-config.js`。

## 在本機使用 Google 登入

1. 在專案目錄執行 `python -m http.server 8000`。
2. 開啟 `http://localhost:8000`，在登入頁按「使用 Google 登入」。未登入時，行程與目標畫面會保持隱藏；登入後才能使用。
3. GitHub Pages 網址是 `https://chenyou951121-hue.github.io/class_1106/`。在 Firebase Console 的 **Authentication → Settings → Authorized domains** 加入主機名稱 `chenyou951121-hue.github.io`（不含 `https://`、路徑或連接埠）；正式網站需使用 HTTPS。若改用其他網域，也要加入該網域。

## 啟用 LINE 登入

LINE 登入透過 Firebase 的 OpenID Connect (OIDC) 提供者進行：

1. 在 LINE Developers 建立 LINE Login channel，取得 Channel ID 和 Channel secret。
2. 若 Firebase 專案尚未升級，先啟用 Firebase Authentication with Identity Platform；Firebase 的 OIDC 登入需要此功能。
3. 在 Firebase Console 的 **Authentication → Sign-in method → Add new provider → OpenID Connect** 新增提供者，Provider ID 設為 `oidc.line`、Issuer 設為 `https://access.line.me`，選擇授權碼流程，並填入 Channel ID 和 Channel secret。
4. 在 LINE channel 的 Callback URL 加入 `https://class-1106.firebaseapp.com/__/auth/handler`；若使用其他 Firebase Auth 網域，請改成該網域的 `/__/auth/handler`。

Firebase Web app 設定會出現在前端，因此不是私密憑證。請勿放入 Firebase service account 私鑰或 LINE Channel secret；LINE Channel secret 只能填在 Firebase Console。並在 Google Cloud/Firebase 限制 API key 可使用的網站網域。登入閘門在前端控制畫面顯示；真正的資料隔離由 Firestore 安全規則控制。

## Firestore 資料庫

資料模型使用 Enterprise Native mode 資料庫 `daily-sequence`（`asia-east1`，台灣）。資料按 Firebase UID 分隔：`users/{uid}` 是不含個資的父文件，另有 `users/{uid}/events`、`users/{uid}/goals` 和 `users/{uid}/settings/preferences`。新帳號的行程與長期目標從空白開始；舊版 `demo-event-*` 和 `demo-goal-*` 範例文件會在該帳號下次登入時移除。新增、完成、調整或刪除都會寫入該 UID 專屬的 Firestore 路徑。

## Gmail 每日提醒

前端可設定每日待辦寄送時間，也可為每個長期目標各自設定每日提醒時間。網站關閉時仍要寄信，需要一個持續執行的排程；`email-reminders/Code.gs` 使用 Google Apps Script，信件由部署者的 Google 帳號寄出。腳本每分鐘檢查一次，時區為台北；Apps Script 時間觸發器可能有少量延遲，並受 Google 每日寄信額度限制。Apps Script 通常不另收主機費，但仍適用 Google 額度；Firebase 費用則依目前專案方案與用量計算。

啟用寄信前需完成下列設定：

1. 在 `script.google.com` 建立 Apps Script 專案，貼入 `email-reminders/Code.gs`，並啟用 `email-reminders/appsscript.json` manifest。
2. 在專案 Script Properties 新增 `FIREBASE_API_KEY`，值取自 `firebase-config.js` 的公開 Web API key。
3. 將專案時區設為 `Asia/Taipei`，執行一次 `setupEmailReminderTrigger()`，並授權 Apps Script 寄送郵件與建立時間觸發器。
4. 部署為 Web app，執行身分選「我」，存取權選「任何人」。首次執行時需授權 Apps Script 建立觸發器、驗證 Firebase 登入，以及從你的 Gmail 寄信。端點會驗證 Firebase ID token，並只接受寄給登入且已驗證 Google 帳號信箱的資料。
5. 將部署取得的 Web app URL 設定到 `firebase-config.js` 的 `gmailReminderEndpoint`，再推送網站更新。

排程只會寄送當日尚未完成的行程/代辦；長期目標則依每個目標各自設定的時間提醒。只有開啟提醒的待辦或目標會同步至 Apps Script 專案的 Script Properties，並由該專案寄至登入 Google 帳號的信箱；停用所有提醒時，腳本會刪除該帳號的排程資料。尚未設定 `gmailReminderEndpoint` 時，網頁只會儲存提醒偏好，不會寄出郵件。

目前 Firebase 專案使用 **Enterprise Native mode** 資料庫 `daily-sequence`（`asia-east1`）；資料庫與 Firestore 規則已在 Firebase Console 設定。若日後需要更新規則，且已安裝並登入 Firebase CLI，可在專案目錄執行：

```bash
firebase login
firebase firestore:databases:create daily-sequence --project class-1106 --location asia-east1 --edition enterprise --firestore-data-access ENABLED --mongodb-compatible-data-access DISABLED
firebase deploy --only firestore --project class-1106
```

若已在 Console 建立資料庫，略過 `firestore:databases:create`，只部署規則和索引。`firestore.rules` 是依目前頁面資料模型撰寫的安全規則原型；上線前請檢查並驗證規則與資料存取。Enterprise 的操作計價與 Standard 不同，請在 Firebase Console 確認目前方案和用量。

若暫時沒有 Firebase CLI，也可以在 Firestore 的 **Rules** 頁籤貼上 `firestore.rules` 並按 **Publish**；Enterprise 目前可在沒有自訂索引時執行這些小型個人集合查詢，`firestore.indexes.json` 可之後再部署以改善查詢效率。
