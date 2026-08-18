import React, { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "./firebase.js";

const ERROR_MESSAGES = {
  "auth/invalid-email": "البريد الإلكتروني غير صالح",
  "auth/user-not-found": "لا يوجد حساب بهذا البريد",
  "auth/wrong-password": "كلمة المرور غير صحيحة",
  "auth/invalid-credential": "البريد الإلكتروني أو كلمة المرور غير صحيحة",
  "auth/email-already-in-use": "هذا البريد مستخدم بالفعل، سجّل الدخول بدلًا من إنشاء حساب",
  "auth/weak-password": "كلمة المرور يجب أن تكون 6 أحرف على الأقل",
  "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "مفتاح Firebase غير صحيح — راجع src/firebase.js",
  "auth/invalid-api-key": "مفتاح Firebase غير صحيح — راجع src/firebase.js",
  "auth/network-request-failed": "تعذّر الاتصال بالإنترنت، جرّب تاني",
};

const inputStyle = {
  border: "1px solid #D8CDAF",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
};

const CHECKING_TIMEOUT_MS = 3500;

/**
 * يعرض شاشة دخول/تسجيل حتى تتحقق الهوية، ثم يعطي الأبناء (render prop)
 * كائن المستخدم (user) بعد نجاح تسجيل الدخول، ليستخدم uid في مزامنة البيانات.
 */
export default function AuthGate({ children }) {
  const [user, setUser] = useState(undefined); // undefined = جاري التحقق
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState(""); // خطأ عام أثناء التحقق التلقائي
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured) return; // مفيش داعي نحاول نتصل ببيانات وهمية
    const unsub = onAuthStateChanged(
      auth,
      (u) => setUser(u),
      (err) => {
        console.error("خطأ في التحقق من الحساب", err);
        setAuthError(err.message || String(err));
        setUser(null); // اسمح بظهور شاشة تسجيل الدخول بدل التعليق للأبد
      }
    );
    return unsub;
  }, []);

  // شبكة أمان: لو التحقق التلقائي فضل معلّق أكتر من كذا ثانية (مشكلة شبكة/تخزين المتصفح)
  useEffect(() => {
    if (user !== undefined) return;
    const t = setTimeout(() => setTimedOut(true), CHECKING_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [user]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      setError(ERROR_MESSAGES[err.code] || err.message || "حدث خطأ، حاول مرة أخرى");
    } finally {
      setBusy(false);
    }
  }

  if (!isFirebaseConfigured) {
    return (
      <div
        dir="rtl"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Tajawal, sans-serif",
          background: "#1F3D33",
          padding: 20,
        }}
      >
        <div
          style={{
            background: "#F4EFE3",
            borderRadius: 16,
            padding: 24,
            maxWidth: 420,
            color: "#1F3D33",
            lineHeight: 1.8,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>
            الإعداد لسه ناقص خطوة
          </div>
          <div style={{ fontSize: 14 }}>
            ملف <code>src/firebase.js</code> لسه فيه قيم وهمية (placeholder) بدل بيانات مشروعك
            الحقيقي على Firebase. افتح الملف، حط بيانات مشروعك (من Firebase Console → Project
            settings)، وبعدين شغّل <code>npm run build</code> تاني وارفع النسخة الجديدة.
          </div>
        </div>
      </div>
    );
  }

  if (user === undefined && !timedOut) {
    return (
      <div
        dir="rtl"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          height: "100vh",
          fontFamily: "Tajawal, sans-serif",
          color: "#1F3D33",
          padding: 20,
          textAlign: "center",
        }}
      >
        <div>جاري التحقق من الحساب...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div
        dir="rtl"
        style={{
          minHeight: "100vh",
          background: "#1F3D33",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Tajawal, sans-serif",
          padding: 16,
        }}
      >
        <form
          onSubmit={submit}
          style={{
            background: "#F4EFE3",
            borderRadius: 18,
            padding: 30,
            width: "100%",
            maxWidth: 360,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            boxShadow: "0 12px 32px rgba(0,0,0,.28)",
          }}
        >
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 999,
              background: "#E8C468",
              color: "#1F3D33",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: 18,
              marginBottom: 2,
            }}
          >
            ✓
          </div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#1F3D33" }}>
            متابعة حضور
          </h1>
          {timedOut && user === undefined && (
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: "#B3492E",
                background: "#F0E4DC",
                borderRadius: 8,
                padding: "8px 10px",
              }}
            >
              تعذّر التعرّف التلقائي على جلستك المحفوظة في هذا المتصفح (شائع لما تفتح رابط من كاميرا
              الموبايل). سجّل دخولك يدويًا هنا مرة، وهيتسجل حضور الطالب فورًا بعدها.
              {authError && <span style={{ display: "block", opacity: 0.7, marginTop: 4 }}>({authError})</span>}
            </p>
          )}
          <p style={{ margin: 0, fontSize: 13, color: "#5b5647" }}>
            {mode === "login"
              ? "سجّل الدخول لمزامنة بياناتك عبر كل أجهزتك"
              : "أنشئ حسابًا لأول مرة (ثم استخدم نفس البيانات على أي جهاز آخر)"}
          </p>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="البريد الإلكتروني"
            style={inputStyle}
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="كلمة المرور"
            style={inputStyle}
          />
          {error && <div style={{ color: "#B3492E", fontSize: 12 }}>{error}</div>}
          <button
            disabled={busy}
            type="submit"
            style={{
              background: "#1F3D33",
              color: "#F4EFE3",
              borderRadius: 10,
              padding: "10px 0",
              fontWeight: 700,
              border: "none",
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? "جاري التحميل..." : mode === "login" ? "تسجيل الدخول" : "إنشاء حساب"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError("");
            }}
            style={{
              background: "none",
              border: "none",
              color: "#1F3D33",
              fontSize: 12,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            {mode === "login" ? "أول مرة تستخدم النظام؟ أنشئ حسابًا" : "عندك حساب بالفعل؟ سجّل الدخول"}
          </button>
        </form>
      </div>
    );
  }

  return children(user);
}
