import { firebaseConfig, firestoreDatabaseId } from "./firebase-config.js";

const statusElement = document.getElementById("authStatus");
const signInButton = document.getElementById("googleSignInButton");
const googleGateSignInButton = document.getElementById("googleGateSignInButton");
const lineGateSignInButton = document.getElementById("lineGateSignInButton");
const signInButtons = [signInButton, googleGateSignInButton, lineGateSignInButton].filter(Boolean);
const appRoot = document.getElementById("appRoot");
const authGate = document.getElementById("authGate");
const authGateTitle = document.getElementById("authGateTitle");
const authGateIntro = document.getElementById("authGateIntro");
const authGateMessage = document.getElementById("authGateMessage");
const authGateRecoveryActions = document.getElementById("authGateRecoveryActions");
const authGateRetryButton = document.getElementById("authGateRetryButton");
const authGateSignOutButton = document.getElementById("authGateSignOutButton");
const accountMenu = document.getElementById("accountMenu");
const accountAvatar = document.getElementById("accountAvatar");
const accountInitial = document.getElementById("accountInitial");
const accountName = document.getElementById("accountName");
const signOutButton = document.getElementById("signOutButton");

function setStatus(message) {
  if (statusElement) statusElement.textContent = message;
  if (authGateMessage && appRoot?.hidden) authGateMessage.textContent = message;
}

function setSignInButtonsDisabled(disabled) {
  signInButtons.forEach((button) => {
    button.disabled = disabled;
  });
}

function showError(message) {
  if (authGate && !authGate.hidden) {
    authGateMessage.textContent = message;
    return;
  }
  if (typeof window.toast === "function") {
    window.toast(message);
  } else {
    setStatus(message);
  }
}

function hasFirebaseConfig(config) {
  return ["apiKey", "authDomain", "projectId", "appId"].every((key) => {
    const value = config[key];
    return typeof value === "string" && value.trim() !== "" && !value.includes("YOUR_");
  });
}

function renderUser(user) {
  const isAuthenticated = Boolean(user);
  appRoot.hidden = !isAuthenticated;
  authGate.hidden = isAuthenticated;
  signInButtons.forEach((button) => {
    button.hidden = isAuthenticated;
  });
  accountMenu.hidden = !isAuthenticated;

  if (!user) {
    authGateTitle.textContent = "登入後開始使用日序";
    authGateIntro.hidden = false;
    authGateRecoveryActions.hidden = true;
    authGateMessage.classList.remove("auth-gate-error");
    accountAvatar.hidden = true;
    accountInitial.hidden = false;
    accountName.textContent = "";
    setStatus("尚未登入");
    return;
  }

  const label = user.displayName || user.email || "Google 使用者";
  accountName.textContent = label;
  accountInitial.textContent = [...label][0]?.toUpperCase() || "G";
  setStatus("已登入");

  if (user.photoURL) {
    accountAvatar.src = user.photoURL;
    accountAvatar.alt = `${label} 的 Google 大頭貼`;
    accountAvatar.referrerPolicy = "no-referrer";
    accountAvatar.hidden = false;
    accountInitial.hidden = true;
  } else {
    accountAvatar.removeAttribute("src");
    accountAvatar.hidden = true;
    accountInitial.hidden = false;
  }
}

function showSignedInFirestoreError(user, error) {
  const providerIds = user.providerData?.map(({ providerId }) => providerId) || [];
  const providerName = providerIds.includes("google.com")
    ? "Google"
    : providerIds.includes("oidc.line")
      ? "LINE"
      : "帳號";

  appRoot.hidden = true;
  authGate.hidden = false;
  accountMenu.hidden = true;
  signInButtons.forEach((button) => {
    button.hidden = true;
  });
  authGateTitle.textContent = `${providerName} 登入成功，但資料無法載入`;
  authGateIntro.hidden = true;
  authGateMessage.classList.add("auth-gate-error");
  authGateMessage.textContent = explainFirestoreError(error);
  authGateRecoveryActions.hidden = false;
}

function explainAuthError(error) {
  switch (error?.code) {
    case "auth/popup-closed-by-user":
      return "已關閉 Google 登入視窗。";
    case "auth/popup-blocked":
      return "瀏覽器封鎖了登入視窗，請允許此網站開啟彈出視窗。";
    case "auth/unauthorized-domain":
      return "這個網站網域尚未加入 Firebase 授權網域。";
    case "auth/operation-not-allowed":
      return "Firebase 尚未啟用這個登入方式。";
    case "auth/network-request-failed":
      return "網路連線失敗，請檢查網路後重試。";
    default:
      return "登入失敗，請稍後再試。";
  }
}

function explainFirestoreError(error) {
  console.error("Firestore user data error.", error);
  const detail = String(error?.code || error?.message || error?.name || "未知錯誤")
    .replace(/\s+/g, " ")
    .slice(0, 160);
  if (error?.code === "permission-denied" || error?.code === "firestore/permission-denied") {
    return `Firestore 拒絕這個帳號存取資料（${detail}）。`;
  }
  if (error?.code === "not-found" || error?.code === "firestore/not-found") {
    return `找不到 Firestore 資料庫或文件（${detail}）。`;
  }
  return `無法載入 Firestore 資料（${detail}）。`;
}

if (!hasFirebaseConfig(firebaseConfig)) {
  setSignInButtonsDisabled(true);
  setStatus("登入服務尚未設定，請檢查 Firebase 設定。");
} else if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
  setSignInButtonsDisabled(true);
  setStatus("登入需要 HTTPS 或 localhost。");
} else {
  let firebaseModules;
  try {
    firebaseModules = await Promise.all([
      import("https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js"),
      import("./firestore-data.js?v=2026-11-23-1"),
      import("./taiwan-market.js?v=2026-11-23-2"),
    ]);
  } catch (error) {
    console.error("Could not load Firebase SDK.", error);
    setSignInButtonsDisabled(true);
    setStatus("無法載入 Firebase 服務，請檢查網路連線。");
  }

  if (firebaseModules) {
    const [appSdk, authSdk, firestoreSdk, { createFirestoreStore }, { initTaiwanMarketBoard }] = firebaseModules;
    const { initializeApp } = appSdk;
    const { getAuth, GoogleAuthProvider, OAuthProvider, signInWithPopup, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } = authSdk;

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = firestoreSdk.getFirestore(app, firestoreDatabaseId);
    const googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: "select_account" });
    const lineProvider = new OAuthProvider("oidc.line");
    lineProvider.addScope("profile");

    try {
      await setPersistence(auth, browserLocalPersistence);
    } catch (error) {
      console.warn("Could not set local Firebase Auth persistence.", error);
    }

    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.firestoreStore = null;
        renderUser(null);
        return;
      }

      window.firestoreStore = null;
      renderUser(null);
      setStatus("正在載入你的 Firestore 資料…");
      try {
        const store = createFirestoreStore({
          db,
          firestore: firestoreSdk,
          uid: user.uid,
        });
        const userData = await store.load(window.collectInitialFirestoreData);
        window.firestoreStore = store;
        window.renderFirestoreData(userData);
        renderUser(user);
        initTaiwanMarketBoard();
      } catch (error) {
        window.firestoreStore = null;
        showSignedInFirestoreError(user, error);
      }
    }, (error) => {
      console.error("Firebase Auth state error.", error);
      window.firestoreStore = null;
      renderUser(null);
      setStatus("無法載入登入狀態");
    });

    async function signIn(provider, providerName) {
      setSignInButtonsDisabled(true);
      setStatus(`正在開啟 ${providerName} 登入…`);
      try {
        await signInWithPopup(auth, provider);
      } catch (error) {
        console.error(`${providerName} sign-in failed.`, error);
        showError(explainAuthError(error));
      } finally {
        setSignInButtonsDisabled(false);
      }
    }

    signInButton?.addEventListener("click", () => signIn(googleProvider, "Google"));
    googleGateSignInButton?.addEventListener("click", () => signIn(googleProvider, "Google"));
    lineGateSignInButton?.addEventListener("click", () => signIn(lineProvider, "LINE"));

    async function handleSignOut(button) {
      button.disabled = true;
      try {
        await signOut(auth);
        showError("已登出。");
      } catch (error) {
        console.error("Firebase sign-out failed.", error);
        showError("登出失敗，請稍後再試。");
      } finally {
        button.disabled = false;
      }
    }

    signOutButton?.addEventListener("click", () => handleSignOut(signOutButton));
    authGateSignOutButton?.addEventListener("click", () => handleSignOut(authGateSignOutButton));
    authGateRetryButton?.addEventListener("click", () => location.reload());
  }
}
