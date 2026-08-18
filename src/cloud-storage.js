import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  collection,
  getDocs,
} from "firebase/firestore";
import { db } from "./firebase.js";

function ref(uid, key, shared) {
  if (shared) return doc(db, "shared_storage", key);
  return doc(db, "users", uid, "storage", key);
}

/**
 * نفس شكل واجهة window.storage تمامًا (get/set/delete/list)
 * بالإضافة إلى subscribe() للمزامنة اللحظية عبر الأجهزة، مبنية على Firestore.
 */
export function createCloudStorage(uid) {
  return {
    async get(key, shared = false) {
      const snap = await getDoc(ref(uid, key, shared));
      if (!snap.exists()) return null;
      return { key, value: snap.data().value, shared };
    },

    async set(key, value, shared = false) {
      await setDoc(ref(uid, key, shared), { value, updatedAt: Date.now() });
      return { key, value, shared };
    },

    async delete(key, shared = false) {
      await deleteDoc(ref(uid, key, shared));
      return { key, deleted: true, shared };
    },

    async list(prefix = "", shared = false) {
      const colRef = shared
        ? collection(db, "shared_storage")
        : collection(db, "users", uid, "storage");
      const snap = await getDocs(colRef);
      const keys = [];
      snap.forEach((d) => {
        if (d.id.startsWith(prefix)) keys.push(d.id);
      });
      return { keys, prefix, shared };
    },

    // يستقبل التحديثات فورًا (سواء من هذا الجهاز أو أي جهاز آخر مسجّل بنفس الحساب)
    subscribe(key, callback, shared = false) {
      return onSnapshot(
        ref(uid, key, shared),
        (snap) => callback(snap.exists() ? snap.data().value : null),
        (err) => console.error("خطأ في المزامنة اللحظية", err)
      );
    },
  };
}
