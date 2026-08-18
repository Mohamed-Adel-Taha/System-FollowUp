import { initializeApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

/*
  اذهب إلى https://console.firebase.google.com
  1) أنشئ مشروعًا جديدًا (مجاني)
  2) من إعدادات المشروع (Project settings) → "Your apps" → أضف تطبيق ويب (</>) وانسخ القيم هنا
  3) من القائمة الجانبية: Build → Authentication → Sign-in method → فعّل "Email/Password"
  4) من القائمة الجانبية: Build → Firestore Database → أنشئ قاعدة بيانات (ابدأ بوضع production)
  5) بعد الإنشاء، من تبويب Rules، الصق القواعد الموجودة في ملف firestore.rules في هذا المشروع
*/
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBzUmpgeVDMfU5LS0beUDQMoF5sAjuORaY",
  authDomain: "ahmed-eldomery.firebaseapp.com",
  projectId: "ahmed-eldomery",
  storageBucket: "ahmed-eldomery.firebasestorage.app",
  messagingSenderId: "570342144219",
  appId: "1:570342144219:web:809888249e1ac4a948f4fe",
  measurementId: "G-42L03S0EZ0"
};

// true لو لسه القيم الوهمية موجودة (يعني الملف ده متعدّلش بعد)
export const isFirebaseConfigured = !Object.values(firebaseConfig).some((v) =>
  String(v).includes("ضع_")
);

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// بعض السياقات المقيّدة (زي معاينة الروابط جوه تطبيق الكاميرا) بتمنع IndexedDB.
// جرّب أفضل طريقة حفظ متاحة، وارجع للأبسط لو فشلت، عشان الشاشة متفضلش معلّقة.
setPersistence(auth, browserLocalPersistence).catch(() =>
  setPersistence(auth, browserSessionPersistence).catch(() =>
    setPersistence(auth, inMemoryPersistence).catch(() => {})
  )
);
