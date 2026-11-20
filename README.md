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

資料模型使用 Enterprise Native mode 資料庫 `daily-sequence`（`asia-east1`，台灣）。資料按 Firebase UID 分隔：`users/{uid}` 是不含個資的父文件，另有 `users/{uid}/events`、`users/{uid}/goals` 和 `users/{uid}/settings/preferences`。首次登入會把頁面上的範例行程與目標，以及通知偏好，匯入該帳號；後續新增、完成、調整或刪除都會寫入 Firestore。

此工作區未安裝 Firebase CLI，所以資料庫尚未建立或部署。請先在 Firebase Console 建立 **Enterprise → Firestore Native mode** 資料庫，ID 設為 `daily-sequence`、位置設為 `asia-east1`，選 **Production mode**。若已安裝並登入 Firebase CLI，再於專案目錄執行：

```bash
firebase login
firebase firestore:databases:create daily-sequence --project class-1106 --location asia-east1 --edition enterprise --firestore-data-access ENABLED --mongodb-compatible-data-access DISABLED
firebase deploy --only firestore --project class-1106
```

若已在 Console 建立資料庫，略過 `firestore:databases:create`，只部署規則和索引。`firestore.rules` 是依目前頁面資料模型撰寫的安全規則原型；上線前請檢查並驗證規則與資料存取。Enterprise 的操作計價與 Standard 不同，請在 Firebase Console 確認目前方案和用量。

若暫時沒有 Firebase CLI，也可以在 Firestore 的 **Rules** 頁籤貼上 `firestore.rules` 並按 **Publish**；Enterprise 目前可在沒有自訂索引時執行這些小型個人集合查詢，`firestore.indexes.json` 可之後再部署以改善查詢效率。
