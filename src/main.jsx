import React, { useMemo } from "react";
import ReactDOM from "react-dom/client";
import { signOut } from "firebase/auth";
import "./index.css";
import { auth } from "./firebase.js";
import { createCloudStorage } from "./cloud-storage.js";
import AuthGate from "./AuthGate.jsx";
import TeacherRegister from "./App.jsx";

function AuthedApp({ user }) {
  // إنشاء واجهة تخزين سحابية خاصة بهذا المستخدم مرة واحدة فقط
  const storage = useMemo(() => createCloudStorage(user.uid), [user.uid]);
  window.storage = storage;

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => signOut(auth)}
        className="no-print"
        style={{
          position: "fixed",
          top: 8,
          insetInlineStart: 8,
          zIndex: 9999,
          background: "#fff",
          border: "1px solid #D8CDAF",
          borderRadius: 8,
          padding: "4px 10px",
          fontSize: 11,
          cursor: "pointer",
          fontFamily: "Tajawal, sans-serif",
        }}
        title={user.email}
      >
        تسجيل الخروج
      </button>
      <TeacherRegister />
    </div>
  );
}

function Root() {
  return <AuthGate>{(user) => <AuthedApp user={user} />}</AuthGate>;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
