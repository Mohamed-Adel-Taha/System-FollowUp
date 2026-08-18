import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Users,
  ClipboardCheck,
  GraduationCap,
  Plus,
  X,
  Check,
  Clock,
  Trash2,
  Search,
  ChevronRight,
  Stamp,
  BookOpen,
  Calendar,
  Percent,
  Loader2,
  Phone,
  QrCode,
  Printer,
  ScanLine,
  AlertCircle,
  FileText,
  MessageCircle,
  Pencil,
  CheckCircle2,
  XCircle,
  Download,
} from "lucide-react";

/* -------------------------------------------------------------------- */
/*  توكنز التصميم                                                        */
/*  خلفية ورقية دافئة + لوحة طباشير خضراء داكنة + دمغة (ختم) لهوية الطالب  */
/* -------------------------------------------------------------------- */
const COLORS = {
  paper: "#F4EFE3",
  paperDark: "#E8E0CC",
  ink: "#2B3A34",
  board: "#1F3D33",
  boardSoft: "#2C4F42",
  chalk: "#E8C468",
  sage: "#5C8A66",
  brick: "#B3492E",
  amber: "#C98A2E",
  line: "#D8CDAF",
  card: "#FBF8F0",
};

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&family=IBM+Plex+Mono:wght@500;600&display=swap');`;

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const todayISO = () => new Date().toISOString().slice(0, 10);

const QR_CODE_PREFIX = "STUDENT:";
const QR_LIB_SRC = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
const GRADES = ["الصف الأول الثانوي", "الصف الثاني الثانوي"];
const GRADE_PREFIXES = { [GRADES[0]]: "G1", [GRADES[1]]: "G2" };

function gradePrefix(grade) {
  return GRADE_PREFIXES[grade] || "GX";
}

/* أول رقم متاح تالي لكود صف معيّن، عشان الأكواد تتولّد بالترتيب حتى لو اتولّدت دفعات كبيرة */
function nextGradeCodeStart(students, grade) {
  const prefix = gradePrefix(grade);
  const nums = students
    .filter((s) => (s.code || "").startsWith(prefix + "-"))
    .map((s) => parseInt(s.code.split("-")[1], 10))
    .filter((n) => !isNaN(n));
  return (nums.length ? Math.max(...nums) : 0) + 1;
}

function buildGradeCode(grade, n) {
  return `${gradePrefix(grade)}-${String(n).padStart(4, "0")}`;
}

/* الرابط اللي هيتشفّر جوه كود QR — بيه نفس الموقع + كود الطالب، عشان أي كاميرا موبايل عادية
   تقدر تتعرف عليه كرابط قابل للفتح، وبمجرد فتحه يتسجل حضور الطالب أوتوماتيك */
function buildAttendUrl(code) {
  if (typeof window === "undefined") return `${QR_CODE_PREFIX}${code}`;
  return `${window.location.origin}${window.location.pathname}?attend=${encodeURIComponent(code)}`;
}


/* تحميل مكتبة توليد رموز QR ديناميكيًا (مرة واحدة فقط) */
function useQrLibrary() {
  const [ready, setReady] = useState(
    () => typeof window !== "undefined" && !!window.QRCode
  );
  useEffect(() => {
    if (ready) return;
    if (window.QRCode) {
      setReady(true);
      return;
    }
    const existing = document.querySelector(`script[src="${QR_LIB_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => setReady(true));
      return;
    }
    const script = document.createElement("script");
    script.src = QR_LIB_SRC;
    script.async = true;
    script.onload = () => setReady(true);
    document.head.appendChild(script);
  }, [ready]);
  return ready;
}

/* -------------------------------------------------------------------- */
export default function TeacherRegister() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]); // {id, studentId, date, status}
  const [assessments, setAssessments] = useState([]); // {id, type, title, date, maxScore}
  const [scores, setScores] = useState([]); // {assessmentId, studentId, score}

  const [tab, setTab] = useState("students"); // students | attendance | grades | scan
  const [profileId, setProfileId] = useState(null);
  const [toast, setToast] = useState(null);
  const [qrStudent, setQrStudent] = useState(null);
  const [showPrintAll, setShowPrintAll] = useState(false);
  const [undo, setUndo] = useState(null); // { message, action }
  const [scanResult, setScanResult] = useState(null); // نتيجة المسح القادمة من رابط QR (كاميرا الموبايل)
  const urlScanHandled = useRef(false);

  const qrReady = useQrLibrary();
  const hydrated = useRef(false);
  const lastSynced = useRef(null);

  function applyData(raw) {
    try {
      const d = JSON.parse(raw);
      setStudents(d.students || []);
      setAttendance(d.attendance || []);
      setAssessments(d.assessments || []);
      setScores(d.scores || []);
    } catch (e) {
      /* بيانات غير صالحة، تجاهلها */
    }
  }

  /* تحميل أولي + اشتراك في التحديثات اللحظية إن كانت متاحة (مزامنة عبر الأجهزة) */
  useEffect(() => {
    let unsub;
    if (window.storage.subscribe) {
      unsub = window.storage.subscribe(
        "app-data",
        (raw) => {
          if (raw && raw !== lastSynced.current) {
            lastSynced.current = raw;
            applyData(raw);
          }
          hydrated.current = true;
          setLoading(false);
        },
        false
      );
    } else {
      (async () => {
        try {
          const res = await window.storage.get("app-data", false);
          if (res && res.value) {
            lastSynced.current = res.value;
            applyData(res.value);
          }
        } catch (e) {
          /* لا توجد بيانات محفوظة بعد */
        } finally {
          hydrated.current = true;
          setLoading(false);
        }
      })();
    }
    return () => unsub && unsub();
  }, []);

  /* معالجة تلقائية لو الصفحة اتفتحت برابط مسح QR (مثلاً من كاميرا الموبايل: ?attend=ST-001) */
  useEffect(() => {
    if (loading || urlScanHandled.current) return;
    urlScanHandled.current = true;
    try {
      const params = new URLSearchParams(window.location.search);
      const attend = params.get("attend");
      if (attend) {
        const res = recordAttendanceByCode(attend, todayISO());
        setScanResult(
          res.ok
            ? { ok: true, student: res.student }
            : { ok: false, raw: attend, reason: res.reason, student: res.student }
        );
        params.delete("attend");
        const cleanUrl =
          window.location.pathname + (params.toString() ? `?${params.toString()}` : "") + window.location.hash;
        window.history.replaceState({}, "", cleanUrl);
      }
    } catch (e) {
      /* تجاهل لو تعذّر التعامل مع الرابط */
    }
  }, [loading]);

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 6000);
    return () => clearTimeout(t);
  }, [undo]);

  useEffect(() => {
    if (!hydrated.current) return;
    const payload = JSON.stringify({ students, attendance, assessments, scores });
    if (payload === lastSynced.current) return; // لا تغيير فعلي (تجنّب حلقة تكرار مع التحديث اللحظي)
    (async () => {
      try {
        await window.storage.set("app-data", payload, false);
        lastSynced.current = payload;
      } catch (e) {
        console.error("تعذر الحفظ", e);
      }
    })();
  }, [students, attendance, assessments, scores]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  /* ---------------- طلاب ---------------- */
  function addStudent(name, phone, guardianPhone, grade) {
    const g = grade || GRADES[0];
    const code = buildGradeCode(g, nextGradeCodeStart(students, g));
    setStudents((s) => [
      ...s,
      { id: uid(), code, name, phone, guardianPhone, grade: g, createdAt: todayISO() },
    ]);
    showToast(`تمت إضافة ${name} برقم ${code}`);
  }

  /* توليد دفعة أكواد QR فارغة (غير مخصصة لطالب بعد) لصف معيّن، لطباعتها وتوزيعها الأول
     وبعدين تعديل كل كود بعد ما تعرف مين الطالب اللي معاه */
  function bulkGenerateCodes(grade, count) {
    setStudents((s) => {
      const start = nextGradeCodeStart(s, grade);
      const additions = [];
      for (let i = 0; i < count; i++) {
        additions.push({
          id: uid(),
          code: buildGradeCode(grade, start + i),
          name: "",
          phone: "",
          guardianPhone: "",
          grade,
          unassigned: true,
          createdAt: todayISO(),
        });
      }
      return [...s, ...additions];
    });
    showToast(`تم توليد ${count} كود QR لـ ${grade}`);
  }

  function updateStudent(id, patch) {
    setStudents((s) =>
      s.map((x) => (x.id === id ? { ...x, ...patch, unassigned: patch.name ? false : x.unassigned } : x))
    );
    showToast("تم تحديث بيانات الطالب");
  }
  function deleteStudent(id) {
    const removed = students.find((s) => s.id === id);
    const removedAttendance = attendance.filter((x) => x.studentId === id);
    const removedScores = scores.filter((x) => x.studentId === id);
    setStudents((s) => s.filter((x) => x.id !== id));
    setAttendance((a) => a.filter((x) => x.studentId !== id));
    setScores((s) => s.filter((x) => x.studentId !== id));
    if (profileId === id) setProfileId(null);
    setUndo({
      message: `تم حذف ${removed?.name || "الطالب"}`,
      action: () => {
        setStudents((s) => [...s, removed]);
        setAttendance((a) => [...a, ...removedAttendance]);
        setScores((s) => [...s, ...removedScores]);
      },
    });
  }

  /* ---------------- حضور ---------------- */
  function setStatus(studentId, date, status) {
    setAttendance((prev) => {
      const idx = prev.findIndex(
        (r) => r.studentId === studentId && r.date === date
      );
      if (idx === -1) return [...prev, { id: uid(), studentId, date, status }];
      const copy = [...prev];
      copy[idx] = { ...copy[idx], status };
      return copy;
    });
  }

  /* ---------------- تسجيل الحضور عبر الماسح ---------------- */
  function extractStudentCode(raw) {
    let val = (raw || "").trim();
    if (!val) return "";
    // لو كان القيمة رابط كامل (زي اللي بتفتحه كاميرا الموبايل)، استخرج ?attend=
    try {
      if (/^https?:\/\//i.test(val)) {
        const url = new URL(val);
        const fromQuery = url.searchParams.get("attend");
        if (fromQuery) return fromQuery.trim();
      }
    } catch (e) {
      /* ليس رابطًا صالحًا، تجاهل */
    }
    return val.replace(new RegExp(`^${QR_CODE_PREFIX}`, "i"), "");
  }

  function recordAttendanceByCode(rawCode, date) {
    const clean = extractStudentCode(rawCode);
    if (!clean) return { ok: false, reason: "empty" };
    const student = students.find(
      (s) => s.code.toLowerCase() === clean.toLowerCase()
    );
    if (!student) return { ok: false, reason: "notfound", raw: clean };
    if (!student.name) return { ok: false, reason: "unassigned", raw: clean, student };
    setStatus(student.id, date, "present");
    return { ok: true, student };
  }

  /* ---------------- درجات ---------------- */
  function addAssessment(type, title, date, maxScore) {
    setAssessments((a) => [
      ...a,
      { id: uid(), type, title, date, maxScore: Number(maxScore) || 0 },
    ]);
  }
  function deleteAssessment(id) {
    setAssessments((a) => a.filter((x) => x.id !== id));
    setScores((s) => s.filter((x) => x.assessmentId !== id));
  }
  function setScore(assessmentId, studentId, value) {
    setScores((prev) => {
      const idx = prev.findIndex(
        (r) => r.assessmentId === assessmentId && r.studentId === studentId
      );
      const num = value === "" ? "" : Number(value);
      if (idx === -1)
        return [...prev, { assessmentId, studentId, score: num }];
      const copy = [...prev];
      copy[idx] = { ...copy[idx], score: num };
      return copy;
    });
  }

  /* ---------------- إحصائيات لكل طالب ---------------- */
  const statsByStudent = useMemo(() => {
    const map = {};
    students.forEach((st) => {
      const recs = attendance.filter((a) => a.studentId === st.id);
      const present = recs.filter((r) => r.status === "present").length;
      const late = recs.filter((r) => r.status === "late").length;
      const absent = recs.filter((r) => r.status === "absent").length;
      const total = recs.length;
      const rate = total ? Math.round(((present + late * 0.5) / total) * 100) : null;

      const stScores = scores.filter(
        (s) => s.studentId === st.id && s.score !== ""
      );
      let avg = null;
      if (stScores.length) {
        const pct = stScores.map((s) => {
          const a = assessments.find((x) => x.id === s.assessmentId);
          if (!a || !a.maxScore) return null;
          return (s.score / a.maxScore) * 100;
        }).filter((v) => v !== null);
        if (pct.length) avg = Math.round(pct.reduce((a, b) => a + b, 0) / pct.length);
      }
      map[st.id] = { present, late, absent, total, rate, avg };
    });
    return map;
  }, [students, attendance, scores, assessments]);

  if (loading) {
    return (
      <div
        style={{ background: COLORS.paper, minHeight: 500 }}
        className="flex items-center justify-center rounded-xl"
      >
        <style>{FONT_IMPORT}</style>
        <div style={{ color: COLORS.board, fontFamily: "Tajawal, sans-serif" }} className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin" size={28} />
          <span>جاري تحميل السجل...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      style={{
        background: COLORS.paper,
        color: COLORS.ink,
        fontFamily: "'Tajawal', sans-serif",
        minHeight: 600,
      }}
      className="rounded-xl overflow-hidden"
    >
      <style>{`
        ${FONT_IMPORT}
        .mono { font-family: 'IBM Plex Mono', monospace; }
        .stamp {
          border: 2.5px dashed ${COLORS.board};
          color: ${COLORS.board};
        }
        .tabbtn { transition: all .15s ease; }
        input[type=date], input[type=text], input[type=tel], input[type=number], select {
          font-family: 'Tajawal', sans-serif;
        }
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: fixed; inset: 0; margin: 0; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* ------------------------------------------------------------ */}
      {/* الهيدر */}
      <div
        style={{ background: COLORS.board, boxShadow: "0 2px 10px rgba(0,0,0,.18)" }}
        className="px-6 py-5 flex items-center justify-between flex-wrap gap-3 relative z-10"
      >
        <div className="flex items-center gap-3">
          <div
            style={{ background: COLORS.chalk, color: COLORS.board, boxShadow: "0 2px 6px rgba(0,0,0,.25)" }}
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
          >
            <Stamp size={22} />
          </div>
          <div>
            <h1 style={{ color: COLORS.paper }} className="text-xl font-black leading-tight">
              متابعة حضور
            </h1>
            <p style={{ color: COLORS.chalk }} className="text-xs">
              نظام إدارة الحضور والدرجات
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs mono">
          {GRADES.map((g) => {
            const total = students.filter((s) => s.grade === g).length;
            const assigned = students.filter((s) => s.grade === g && s.name).length;
            if (total === 0) return null;
            return (
              <span
                key={g}
                style={{ background: "rgba(255,255,255,.08)", color: COLORS.paper }}
                className="rounded-full px-2.5 py-1 flex items-center gap-1"
              >
                <span style={{ width: 6, height: 6, borderRadius: 999, background: GRADE_COLORS[g] }} />
                {assigned}/{total}
              </span>
            );
          })}
          <span style={{ color: COLORS.paper }} className="opacity-70">
            {students.length} إجمالي
          </span>
        </div>
      </div>

      {/* التبويبات */}
      <div style={{ borderBottom: `1px solid ${COLORS.line}` }} className="flex px-4 bg-transparent">
        {[
          { id: "students", label: "الطلاب", icon: Users },
          { id: "scan", label: "مسح الحضور", icon: ScanLine },
          { id: "attendance", label: "الحضور", icon: ClipboardCheck },
          { id: "grades", label: "الدرجات", icon: GraduationCap },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                setProfileId(null);
              }}
              className="tabbtn flex items-center gap-2 px-4 py-3 text-sm font-bold"
              style={{
                color: active ? COLORS.board : "#8a8272",
                borderBottom: active ? `3px solid ${COLORS.chalk}` : "3px solid transparent",
              }}
            >
              <Icon size={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="p-5">
        {profileId ? (
          <StudentProfile
            student={students.find((s) => s.id === profileId)}
            stats={statsByStudent[profileId]}
            attendance={attendance.filter((a) => a.studentId === profileId)}
            assessments={assessments}
            scores={scores.filter((s) => s.studentId === profileId)}
            onBack={() => setProfileId(null)}
            onShowQR={() => setQrStudent(students.find((s) => s.id === profileId))}
            onUpdate={(patch) => updateStudent(profileId, patch)}
          />
        ) : tab === "students" ? (
          <StudentsTab
            students={students}
            stats={statsByStudent}
            onAdd={addStudent}
            onDelete={deleteStudent}
            onUpdate={updateStudent}
            onOpen={setProfileId}
            onShowQR={setQrStudent}
            onPrintAll={() => setShowPrintAll(true)}
            onBulkGenerate={bulkGenerateCodes}
            allData={{ students, attendance, assessments, scores }}
          />
        ) : tab === "scan" ? (
          <ScanTab students={students} onScan={recordAttendanceByCode} />
        ) : tab === "attendance" ? (
          <AttendanceTab
            students={students}
            attendance={attendance}
            onSetStatus={setStatus}
          />
        ) : (
          <GradesTab
            students={students}
            assessments={assessments}
            scores={scores}
            onAddAssessment={addAssessment}
            onDeleteAssessment={deleteAssessment}
            onSetScore={setScore}
          />
        )}
      </div>

      {toast && (
        <div
          style={{ background: COLORS.board, color: COLORS.paper }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-sm shadow-lg z-50"
        >
          {toast}
        </div>
      )}

      {undo && (
        <div
          style={{ background: COLORS.ink, color: COLORS.paper }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-sm shadow-lg z-50 flex items-center gap-3"
        >
          <span>{undo.message}</span>
          <button
            onClick={() => {
              undo.action();
              setUndo(null);
            }}
            style={{ color: COLORS.chalk }}
            className="font-bold underline"
          >
            تراجع
          </button>
        </div>
      )}

      {qrStudent && (
        <QRModal student={qrStudent} ready={qrReady} onClose={() => setQrStudent(null)} />
      )}
      {showPrintAll && (
        <PrintAllModal students={students} ready={qrReady} onClose={() => setShowPrintAll(false)} />
      )}
      {scanResult && <ScanResultOverlay result={scanResult} onClose={() => setScanResult(null)} />}
    </div>
  );
}

/* ====================================================================== */
/*  تبويب: الطلاب                                                          */
/* ====================================================================== */
const GRADE_COLORS = {
  [GRADES[0]]: COLORS.sage,
  [GRADES[1]]: COLORS.amber,
};

function StudentsTab({ students, stats, onAdd, onDelete, onUpdate, onOpen, onShowQR, onPrintAll, onBulkGenerate, allData }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [grade, setGrade] = useState(GRADES[0]);
  const [q, setQ] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [editingStudent, setEditingStudent] = useState(null);
  const [showBulkGenerate, setShowBulkGenerate] = useState(false);

  const bySearch = students.filter((s) => {
    const query = q.trim().toLowerCase();
    if (!query) return true;
    return (
      s.name.toLowerCase().includes(query) ||
      s.code.toLowerCase().includes(query) ||
      (s.phone && s.phone.toLowerCase().includes(query)) ||
      (s.guardianPhone && s.guardianPhone.toLowerCase().includes(query))
    );
  });
  const byGrade =
    gradeFilter === "unassigned"
      ? bySearch.filter((s) => !s.name)
      : gradeFilter === "all"
      ? bySearch
      : bySearch.filter((s) => s.grade === gradeFilter);
  const filtered = byGrade.slice().sort((a, b) => {
    if (!!a.name !== !!b.name) return a.name ? -1 : 1; // المسجّلين بأسمائهم أولًا
    return (a.name || a.code).localeCompare(b.name || b.code, "ar");
  });
  const unassignedCount = students.filter((s) => !s.name).length;

  function submitNewStudent() {
    if (!name.trim()) return;
    onAdd(name.trim(), phone.trim(), guardianPhone.trim(), grade);
    setName("");
    setPhone("");
    setGuardianPhone("");
  }

  function confirmDelete(s) {
    if (window.confirm(`متأكد إنك عايز تحذف "${s.name || s.code}"؟ هيتحذف معاه كل سجلات الحضور والدرجات الخاصة بيه.`)) {
      onDelete(s.id);
    }
  }

  function downloadBackup() {
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `نسخة-احتياطية-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex flex-col gap-2 mb-5">
        <div className="flex flex-1 flex-col sm:flex-row gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitNewStudent()}
            placeholder="اسم الطالب"
            style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, color: COLORS.ink }}
            className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
          />
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, color: COLORS.ink }}
            className="rounded-lg px-3 py-2 text-sm outline-none"
          >
            {GRADES.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitNewStudent()}
            placeholder="رقم هاتف الطالب (اختياري)"
            style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, color: COLORS.ink }}
            className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
          />
          <input
            value={guardianPhone}
            onChange={(e) => setGuardianPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitNewStudent()}
            placeholder="رقم ولي الأمر (اختياري)"
            style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, color: COLORS.ink }}
            className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
          />
          <button
            onClick={submitNewStudent}
            style={{ background: COLORS.board, color: COLORS.paper }}
            className="rounded-lg px-4 py-2 text-sm font-bold flex items-center justify-center gap-1 shrink-0"
          >
            <Plus size={16} /> إضافة طالب
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {["all", ...GRADES].map((g) => {
          const active = gradeFilter === g;
          const color = g === "all" ? COLORS.board : GRADE_COLORS[g];
          return (
            <button
              key={g}
              onClick={() => setGradeFilter(g)}
              style={{
                background: active ? color : "transparent",
                color: active ? "#fff" : color,
                border: `1.5px solid ${color}`,
              }}
              className="rounded-full px-3 py-1.5 text-xs font-bold transition-colors"
            >
              {g === "all" ? "كل الصفوف" : g}
            </button>
          );
        })}
        {unassignedCount > 0 && (
          <button
            onClick={() => setGradeFilter("unassigned")}
            style={{
              background: gradeFilter === "unassigned" ? COLORS.brick : "transparent",
              color: gradeFilter === "unassigned" ? "#fff" : COLORS.brick,
              border: `1.5px solid ${COLORS.brick}`,
            }}
            className="rounded-full px-3 py-1.5 text-xs font-bold transition-colors"
          >
            غير مخصصة ({unassignedCount})
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative max-w-xs flex-1">
          <Search size={15} style={{ color: "#8a8272" }} className="absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث بالاسم أو الرقم أو الهاتف..."
            style={{ background: COLORS.card, border: `1px solid ${COLORS.line}` }}
            className="w-full rounded-lg pr-9 pl-3 py-2 text-sm outline-none"
          />
        </div>
        <button
          onClick={() => setShowBulkGenerate(true)}
          style={{ background: COLORS.board, color: COLORS.paper }}
          className="rounded-lg px-3 py-2 text-xs font-bold flex items-center gap-1.5"
        >
          <QrCode size={14} /> توليد أكواد QR بالجملة
        </button>
        {students.length > 0 && (
          <button
            onClick={onPrintAll}
            style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, color: COLORS.board }}
            className="rounded-lg px-3 py-2 text-xs font-bold flex items-center gap-1.5"
          >
            <Printer size={14} /> طباعة بطاقات QR
          </button>
        )}
        <button
          onClick={downloadBackup}
          style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, color: COLORS.board }}
          className="rounded-lg px-3 py-2 text-xs font-bold flex items-center gap-1.5"
          title="تنزيل نسخة احتياطية من كل البيانات"
        >
          <Download size={14} /> نسخة احتياطية
        </button>
      </div>

      {showBulkGenerate && (
        <BulkGenerateModal
          onClose={() => setShowBulkGenerate(false)}
          onGenerate={(g, count) => {
            onBulkGenerate(g, count);
            setShowBulkGenerate(false);
          }}
        />
      )}

      {filtered.length === 0 ? (
        <EmptyState text="لا يوجد طلاب في هذا الصف بعد." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((s) => {
            const st = stats[s.id] || {};
            const gc = GRADE_COLORS[s.grade] || COLORS.board;
            const unassigned = !s.name;
            return (
              <div
                key={s.id}
                style={{
                  background: COLORS.card,
                  border: unassigned ? `1.5px dashed ${COLORS.line}` : `1px solid ${COLORS.line}`,
                  borderRight: `4px solid ${gc}`,
                  boxShadow: unassigned ? "none" : "0 1px 3px rgba(31,61,51,.06)",
                }}
                className="rounded-xl p-4 flex flex-col gap-3 transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <button
                    onClick={() => (unassigned ? setEditingStudent(s) : onOpen(s.id))}
                    className="flex items-center gap-3 text-right"
                  >
                    <div className="stamp w-11 h-11 rounded-full flex items-center justify-center rotate-[-8deg] shrink-0">
                      <span className="mono text-[10px] font-bold">{s.code}</span>
                    </div>
                    <div>
                      {unassigned ? (
                        <div className="text-sm font-bold flex items-center gap-1.5" style={{ color: "#a89f8a" }}>
                          <AlertCircle size={13} /> غير مخصص بعد
                        </div>
                      ) : (
                        <div className="font-bold text-sm">{s.name}</div>
                      )}
                      {s.grade && (
                        <div className="text-[11px] font-bold" style={{ color: gc }}>{s.grade}</div>
                      )}
                      {s.phone && <div className="text-xs opacity-60 mono">{s.phone}</div>}
                      {s.guardianPhone && (
                        <div className="text-xs opacity-60 mono flex items-center gap-1">
                          <Phone size={10} /> ولي الأمر: {s.guardianPhone}
                        </div>
                      )}
                    </div>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setEditingStudent(s)} style={{ color: COLORS.board }} className="opacity-60 hover:opacity-100">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => confirmDelete(s)} style={{ color: COLORS.brick }} className="opacity-60 hover:opacity-100">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                {!unassigned && (
                  <div className="flex gap-2 text-[11px]">
                    <Pill color={COLORS.sage}>
                      حضور {st.rate !== null && st.rate !== undefined ? `${st.rate}%` : "—"}
                    </Pill>
                    <Pill color={COLORS.amber}>
                      متوسط {st.avg !== null && st.avg !== undefined ? `${st.avg}%` : "—"}
                    </Pill>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  {unassigned ? (
                    <button
                      onClick={() => setEditingStudent(s)}
                      className="text-xs font-bold flex items-center gap-1"
                      style={{ color: COLORS.board }}
                    >
                      <Pencil size={13} /> تخصيص الكود لطالب
                    </button>
                  ) : (
                    <button
                      onClick={() => onOpen(s.id)}
                      className="text-xs font-bold flex items-center gap-1"
                      style={{ color: COLORS.board }}
                    >
                      عرض الملف <ChevronRight size={13} className="rotate-180" />
                    </button>
                  )}
                  <button
                    onClick={() => onShowQR(s)}
                    style={{ color: COLORS.board }}
                    className="text-xs font-bold flex items-center gap-1"
                  >
                    <QrCode size={14} /> QR
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editingStudent && (
        <EditStudentModal
          student={editingStudent}
          onClose={() => setEditingStudent(null)}
          onSave={(patch) => {
            onUpdate(editingStudent.id, patch);
            setEditingStudent(null);
          }}
        />
      )}
    </div>
  );
}

function Pill({ color, children }) {
  return (
    <span
      style={{ background: color + "22", color }}
      className="px-2 py-1 rounded-full font-bold"
    >
      {children}
    </span>
  );
}

/* ====================================================================== */
/*  تبويب: الحضور                                                          */
/* ====================================================================== */
function AttendanceTab({ students, attendance, onSetStatus }) {
  const [date, setDate] = useState(todayISO());
  const [gradeFilter, setGradeFilter] = useState("all");

  const assignedStudents = students.filter((s) => s.name);
  const shown = gradeFilter === "all" ? assignedStudents : assignedStudents.filter((s) => s.grade === gradeFilter);

  const recFor = (studentId) =>
    attendance.find((a) => a.studentId === studentId && a.date === date);

  const dayStats = useMemo(() => {
    const ids = new Set(shown.map((s) => s.id));
    const recs = attendance.filter((a) => a.date === date && ids.has(a.studentId));
    return {
      present: recs.filter((r) => r.status === "present").length,
      absent: recs.filter((r) => r.status === "absent").length,
      late: recs.filter((r) => r.status === "late").length,
    };
  }, [attendance, date, shown]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 mb-3">
        <label className="flex items-center gap-2 text-sm font-bold">
          <Calendar size={16} />
          اختر اليوم:
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ background: COLORS.card, border: `1px solid ${COLORS.line}` }}
            className="rounded-lg px-3 py-1.5 text-sm outline-none mono"
          />
        </label>
        {date !== todayISO() && (
          <button
            onClick={() => setDate(todayISO())}
            style={{ color: COLORS.board, border: `1px solid ${COLORS.line}` }}
            className="rounded-full px-3 py-1 text-xs font-bold"
          >
            اليوم
          </button>
        )}
        <div className="flex gap-2 text-xs">
          <Pill color={COLORS.sage}>حاضر {dayStats.present}</Pill>
          <Pill color={COLORS.brick}>غائب {dayStats.absent}</Pill>
          <Pill color={COLORS.amber}>متأخر {dayStats.late}</Pill>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        {["all", ...GRADES].map((g) => {
          const active = gradeFilter === g;
          const color = g === "all" ? COLORS.board : GRADE_COLORS[g];
          return (
            <button
              key={g}
              onClick={() => setGradeFilter(g)}
              style={{
                background: active ? color : "transparent",
                color: active ? "#fff" : color,
                border: `1.5px solid ${color}`,
              }}
              className="rounded-full px-3 py-1.5 text-xs font-bold"
            >
              {g === "all" ? "كل الصفوف" : g}
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <EmptyState text="لا يوجد طلاب في هذا الصف." />
      ) : (
        <div className="flex flex-col gap-2">
          {shown.map((s) => {
            const rec = recFor(s.id);
            return (
              <div
                key={s.id}
                style={{ background: COLORS.card, border: `1px solid ${COLORS.line}` }}
                className="rounded-lg px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <span className="mono text-[10px] opacity-60">{s.code}</span>
                  <span className="font-bold text-sm">{s.name}</span>
                </div>
                <div className="flex gap-2">
                  <StatusButton
                    active={rec?.status === "present"}
                    color={COLORS.sage}
                    icon={Check}
                    label="حاضر"
                    onClick={() => onSetStatus(s.id, date, "present")}
                  />
                  <StatusButton
                    active={rec?.status === "late"}
                    color={COLORS.amber}
                    icon={Clock}
                    label="متأخر"
                    onClick={() => onSetStatus(s.id, date, "late")}
                  />
                  <StatusButton
                    active={rec?.status === "absent"}
                    color={COLORS.brick}
                    icon={X}
                    label="غائب"
                    onClick={() => onSetStatus(s.id, date, "absent")}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusButton({ active, color, icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? color : "transparent",
        color: active ? "#fff" : color,
        border: `1.5px solid ${color}`,
      }}
      className="rounded-lg px-2.5 py-1.5 text-xs font-bold flex items-center gap-1 transition-all"
    >
      <Icon size={13} />
      {label}
    </button>
  );
}

/* ====================================================================== */
/*  تبويب: الدرجات                                                         */
/* ====================================================================== */
function GradesTab({ students, assessments, scores, onAddAssessment, onDeleteAssessment, onSetScore }) {
  const [openId, setOpenId] = useState(null);
  const [form, setForm] = useState({ type: "quiz", title: "", date: todayISO(), maxScore: 10 });

  const assignedStudents = students.filter((s) => s.name);
  const sorted = [...assessments].sort((a, b) => (a.date < b.date ? 1 : -1));

  function submitNewAssessment() {
    if (!form.title.trim()) return;
    onAddAssessment(form.type, form.title.trim(), form.date, form.maxScore);
    setForm({ type: "quiz", title: "", date: todayISO(), maxScore: 10 });
  }

  return (
    <div>
      <div
        style={{ background: COLORS.card, border: `1px solid ${COLORS.line}` }}
        className="rounded-xl p-4 mb-5 flex flex-wrap items-end gap-3"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold opacity-70">النوع</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            style={{ background: "#fff", border: `1px solid ${COLORS.line}` }}
            className="rounded-lg px-2 py-2 text-sm outline-none"
          >
            <option value="quiz">كويز أسبوعي</option>
            <option value="exam">امتحان شهري</option>
          </select>
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
          <label className="text-xs font-bold opacity-70">العنوان</label>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && submitNewAssessment()}
            placeholder="مثال: كويز الوحدة الثالثة"
            style={{ background: "#fff", border: `1px solid ${COLORS.line}` }}
            className="rounded-lg px-3 py-2 text-sm outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold opacity-70">التاريخ</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            style={{ background: "#fff", border: `1px solid ${COLORS.line}` }}
            className="rounded-lg px-3 py-2 text-sm outline-none mono"
          />
        </div>
        <div className="flex flex-col gap-1 w-24">
          <label className="text-xs font-bold opacity-70">الدرجة الكلية</label>
          <input
            type="number"
            min="1"
            value={form.maxScore}
            onChange={(e) => setForm({ ...form, maxScore: e.target.value })}
            style={{ background: "#fff", border: `1px solid ${COLORS.line}` }}
            className="rounded-lg px-3 py-2 text-sm outline-none mono"
          />
        </div>
        <button
          onClick={submitNewAssessment}
          style={{ background: COLORS.board, color: COLORS.paper }}
          className="rounded-lg px-4 py-2 text-sm font-bold flex items-center gap-1"
        >
          <Plus size={15} /> إضافة تقييم
        </button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState text="لم تُضف أي كويزات أو امتحانات بعد." />
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map((a) => {
            const isOpen = openId === a.id;
            return (
              <div key={a.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.line}` }} className="rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3">
                  <button onClick={() => setOpenId(isOpen ? null : a.id)} className="flex items-center gap-3 text-right flex-1">
                    <div
                      style={{ background: a.type === "quiz" ? COLORS.sage + "22" : COLORS.amber + "22", color: a.type === "quiz" ? COLORS.sage : COLORS.amber }}
                      className="w-9 h-9 rounded-full flex items-center justify-center"
                    >
                      <BookOpen size={16} />
                    </div>
                    <div>
                      <div className="font-bold text-sm">{a.title}</div>
                      <div className="text-xs opacity-60 mono">
                        {a.date} · {a.type === "quiz" ? "كويز أسبوعي" : "امتحان شهري"} · من {a.maxScore}
                      </div>
                    </div>
                  </button>
                  <button onClick={() => onDeleteAssessment(a.id)} style={{ color: COLORS.brick }} className="opacity-60 hover:opacity-100 shrink-0">
                    <Trash2 size={15} />
                  </button>
                </div>
                {isOpen && (
                  <div style={{ borderTop: `1px solid ${COLORS.line}` }} className="p-4">
                    {assignedStudents.length === 0 ? (
                      <EmptyState text="لا يوجد طلاب لإدخال درجاتهم." />
                    ) : (
                      <div className="flex flex-col gap-2">
                        {assignedStudents.map((s) => {
                          const rec = scores.find((sc) => sc.assessmentId === a.id && sc.studentId === s.id);
                          return (
                            <div key={s.id} className="flex items-center justify-between gap-3">
                              <span className="text-sm">
                                <span className="mono text-[10px] opacity-60 ml-2">{s.code}</span>
                                {s.name}
                              </span>
                              <input
                                type="number"
                                min="0"
                                max={a.maxScore}
                                value={rec ? rec.score : ""}
                                onChange={(e) => onSetScore(a.id, s.id, e.target.value)}
                                placeholder={`/${a.maxScore}`}
                                style={{ background: "#fff", border: `1px solid ${COLORS.line}` }}
                                className="w-20 rounded-lg px-2 py-1.5 text-sm outline-none mono text-center"
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ====================================================================== */
/*  ملف الطالب                                                             */
/* ====================================================================== */
function StudentProfile({ student, stats, attendance, assessments, scores, onBack, onShowQR, onUpdate }) {
  const [showReport, setShowReport] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  if (!student) return null;
  const sortedAtt = [...attendance].sort((a, b) => (a.date < b.date ? 1 : -1));
  const statusLabel = { present: "حاضر", absent: "غائب", late: "متأخر" };
  const statusColor = { present: COLORS.sage, absent: COLORS.brick, late: COLORS.amber };

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 text-sm font-bold mb-4" style={{ color: COLORS.board }}>
        <ChevronRight size={16} /> رجوع
      </button>

      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="stamp w-16 h-16 rounded-full flex items-center justify-center rotate-[-6deg]">
            <span className="mono text-xs font-bold">{student.code}</span>
          </div>
          <div>
            <h2 className="text-lg font-black flex items-center gap-2">
              {student.name}
              <button onClick={() => setShowEdit(true)} style={{ color: COLORS.board }} className="opacity-60 hover:opacity-100">
                <Pencil size={14} />
              </button>
            </h2>
            {student.grade && (
              <div className="text-xs font-bold mb-0.5" style={{ color: GRADE_COLORS[student.grade] || COLORS.board }}>
                {student.grade}
              </div>
            )}
            {student.phone && (
              <div className="text-xs opacity-60 mono flex items-center gap-1">
                <Phone size={11} /> الطالب: {student.phone}
              </div>
            )}
            {student.guardianPhone && (
              <div className="text-xs opacity-60 mono flex items-center gap-1">
                <Phone size={11} /> ولي الأمر: {student.guardianPhone}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowReport(true)}
            style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, color: COLORS.board }}
            className="rounded-lg px-3 py-2 text-xs font-bold flex items-center gap-1.5"
          >
            <FileText size={15} /> تقرير الحصة
          </button>
          <button
            onClick={onShowQR}
            style={{ background: COLORS.board, color: COLORS.paper }}
            className="rounded-lg px-3 py-2 text-xs font-bold flex items-center gap-1.5"
          >
            <QrCode size={15} /> عرض كود QR
          </button>
        </div>
      </div>

      {showReport && (
        <ReportModal
          student={student}
          stats={stats}
          attendance={attendance}
          assessments={assessments}
          scores={scores}
          onClose={() => setShowReport(false)}
        />
      )}

      {showEdit && (
        <EditStudentModal
          student={student}
          onClose={() => setShowEdit(false)}
          onSave={(patch) => {
            onUpdate(patch);
            setShowEdit(false);
          }}
        />
      )}

      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label="نسبة الحضور" value={stats.rate !== null ? `${stats.rate}%` : "—"} color={COLORS.sage} icon={ClipboardCheck} />
        <StatCard label="متوسط الدرجات" value={stats.avg !== null ? `${stats.avg}%` : "—"} color={COLORS.amber} icon={Percent} />
        <StatCard label="أيام مسجّلة" value={stats.total} color={COLORS.board} icon={Calendar} />
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <h3 className="font-bold text-sm mb-2">سجل الحضور</h3>
          {sortedAtt.length === 0 ? (
            <EmptyState text="لا توجد سجلات حضور بعد." />
          ) : (
            <div className="flex flex-col gap-1.5 max-h-72 overflow-auto pl-1">
              {sortedAtt.map((r) => (
                <div key={r.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.line}` }} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm">
                  <span className="mono text-xs opacity-70">{r.date}</span>
                  <Pill color={statusColor[r.status]}>{statusLabel[r.status]}</Pill>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <h3 className="font-bold text-sm mb-2">الكويزات والامتحانات</h3>
          {assessments.length === 0 ? (
            <EmptyState text="لا توجد تقييمات بعد." />
          ) : (
            <div className="flex flex-col gap-1.5 max-h-72 overflow-auto pl-1">
              {assessments
                .slice()
                .sort((a, b) => (a.date < b.date ? 1 : -1))
                .map((a) => {
                  const rec = scores.find((s) => s.assessmentId === a.id);
                  return (
                    <div key={a.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.line}` }} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm">
                      <div>
                        <div className="font-bold">{a.title}</div>
                        <div className="text-[11px] opacity-60 mono">{a.date}</div>
                      </div>
                      <span className="mono font-bold">
                        {rec && rec.score !== "" ? `${rec.score}/${a.maxScore}` : "—"}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, icon: Icon }) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}` }} className="rounded-xl p-3 flex flex-col gap-1.5">
      <div style={{ color }} className="flex items-center gap-1.5 text-xs font-bold">
        <Icon size={14} /> {label}
      </div>
      <div className="text-xl font-black mono">{value ?? "—"}</div>
    </div>
  );
}

/* ====================================================================== */
/*  تبويب: مسح الحضور (بالماسح اليدوي أو الكيبورد)                          */
/* ====================================================================== */
function ScanTab({ students, onScan }) {
  const [date, setDate] = useState(todayISO());
  const [value, setValue] = useState("");
  const [log, setLog] = useState([]);
  const [manualId, setManualId] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current && inputRef.current.focus();
  }, [log]);

  function process(raw) {
    if (!raw.trim()) return;
    const res = onScan(raw, date);
    if (res.ok) {
      setLog((l) => [
        { id: uid(), ok: true, text: `${res.student.name} (${res.student.code})`, time: new Date().toLocaleTimeString("ar-EG") },
        ...l,
      ]);
    } else if (res.reason === "unassigned") {
      setLog((l) => [
        { id: uid(), ok: false, text: `الكود ${res.student.code} لسه مش متخصص لطالب — عدّله من تبويب الطلاب الأول`, time: new Date().toLocaleTimeString("ar-EG") },
        ...l,
      ]);
    } else {
      setLog((l) => [
        { id: uid(), ok: false, text: `كود غير معروف: ${raw}`, time: new Date().toLocaleTimeString("ar-EG") },
        ...l,
      ]);
    }
    setValue("");
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <label className="flex items-center gap-2 text-sm font-bold">
          <Calendar size={16} />
          يوم الحصة:
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ background: COLORS.card, border: `1px solid ${COLORS.line}` }}
            className="rounded-lg px-3 py-1.5 text-sm outline-none mono"
          />
        </label>
        {date !== todayISO() && (
          <button
            onClick={() => setDate(todayISO())}
            style={{ color: COLORS.board, border: `1px solid ${COLORS.line}` }}
            className="rounded-full px-3 py-1 text-xs font-bold"
          >
            اليوم
          </button>
        )}
      </div>

      <div
        style={{ background: COLORS.board }}
        className="rounded-xl p-6 mb-5 flex flex-col items-center gap-3 text-center"
      >
        <ScanLine size={30} style={{ color: COLORS.chalk }} />
        <div style={{ color: COLORS.paper }} className="font-bold text-sm">
          وجّه الماسح اليدوي نحو كود الطالب، أو اضغط هنا واكتب الكود واضغط Enter
        </div>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && process(value)}
          onBlur={() => inputRef.current && inputRef.current.focus()}
          autoFocus
          placeholder="بانتظار المسح..."
          style={{ background: COLORS.paper, color: COLORS.ink, border: `2px solid ${COLORS.chalk}` }}
          className="w-full max-w-sm rounded-lg px-4 py-3 text-center mono text-lg outline-none"
        />
        <div style={{ color: COLORS.chalk }} className="text-[11px] flex items-center gap-1 opacity-90">
          <AlertCircle size={12} />
          معظم أجهزة مسح QR اليدوية تعمل كلوحة مفاتيح تلقائيًا وتُدخل الكود مباشرة هنا
        </div>
        <div style={{ color: COLORS.chalk, borderTop: "1px dashed rgba(255,255,255,.25)" }} className="text-[11px] flex items-center gap-1 opacity-90 pt-2 mt-1">
          <ScanLine size={12} />
          أو من موبايلك: افتح كاميرا الموبايل العادية ووجّهها لكود QR الطالب — هتظهر إشعار برابط، دوس عليه وهيتسجل الحضور فورًا
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2 mb-6">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold opacity-70">تسجيل يدوي بدون ماسح</label>
          <select
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            style={{ background: COLORS.card, border: `1px solid ${COLORS.line}` }}
            className="rounded-lg px-3 py-2 text-sm outline-none min-w-[200px]"
          >
            <option value="">اختر طالبًا...</option>
            {GRADES.map((g) => {
              const group = students.filter((s) => s.grade === g && s.name);
              if (group.length === 0) return null;
              return (
                <optgroup key={g} label={g}>
                  {group.map((s) => (
                    <option key={s.id} value={s.code}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </optgroup>
              );
            })}
            {students.filter((s) => !GRADES.includes(s.grade) && s.name).map((s) => (
              <option key={s.id} value={s.code}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => manualId && process(manualId)}
          disabled={!manualId}
          style={{ background: manualId ? COLORS.board : COLORS.line, color: COLORS.paper }}
          className="rounded-lg px-4 py-2 text-sm font-bold flex items-center gap-1"
        >
          <Check size={15} /> تسجيل حضور
        </button>
      </div>

      <h3 className="font-bold text-sm mb-2">آخر عمليات المسح ({log.length})</h3>
      {log.length === 0 ? (
        <EmptyState text="لم يتم مسح أي كود بعد اليوم." />
      ) : (
        <div className="flex flex-col gap-1.5 max-h-72 overflow-auto">
          {log.map((l) => (
            <div
              key={l.id}
              style={{ background: COLORS.card, border: `1px solid ${l.ok ? COLORS.sage : COLORS.brick}` }}
              className="rounded-lg px-3 py-2 text-sm flex items-center justify-between"
            >
              <span className="flex items-center gap-2" style={{ color: l.ok ? COLORS.sage : COLORS.brick }}>
                {l.ok ? <Check size={14} /> : <X size={14} />} {l.text}
              </span>
              <span className="mono text-[11px] opacity-50">{l.time}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ====================================================================== */
/*  رمز QR: توليد وعرض وطباعة                                              */
/* ====================================================================== */
function QRBox({ value, size = 160, ready }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ready || !ref.current || !window.QRCode) return;
    ref.current.innerHTML = "";
    try {
      new window.QRCode(ref.current, {
        text: value,
        width: size,
        height: size,
        colorDark: COLORS.board,
        colorLight: "#ffffff",
        correctLevel: window.QRCode.CorrectLevel.M,
      });
    } catch (e) {
      /* تجاهل أخطاء التوليد */
    }
  }, [ready, value, size]);

  if (!ready) {
    return (
      <div style={{ width: size, height: size }} className="flex items-center justify-center">
        <Loader2 className="animate-spin" size={18} />
      </div>
    );
  }
  return <div ref={ref} style={{ width: size, height: size }} />;
}

/* ====================================================================== */
/*  تقرير الحصة: عرض، طباعة، وإرسال لولي الأمر عبر واتساب                    */
/* ====================================================================== */
function normalizePhoneForWhatsapp(raw) {
  let p = (raw || "").replace(/[^\d+]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  else if (p.startsWith("00")) p = p.slice(2);
  else if (p.startsWith("0")) p = "20" + p.slice(1); // افتراض رقم مصري محلي
  return p;
}

function ReportModal({ student, stats, attendance, assessments, scores, onClose }) {
  const [date, setDate] = useState(todayISO());
  const statusLabel = { present: "حاضر", absent: "غائب", late: "متأخر" };
  const statusColor = { present: COLORS.sage, absent: COLORS.brick, late: COLORS.amber };
  const rec = attendance.find((a) => a.date === date);

  const recentScores = [...scores]
    .map((s) => ({ ...s, assessment: assessments.find((a) => a.id === s.assessmentId) }))
    .filter((s) => s.assessment)
    .sort((a, b) => (a.assessment.date < b.assessment.date ? 1 : -1))
    .slice(0, 6);

  function buildMessage() {
    const lines = [];
    lines.push(`تقرير حصة الطالب/ة: ${student.name}`);
    if (student.grade) lines.push(student.grade);
    lines.push(`التاريخ: ${date}`);
    lines.push(`الحالة في هذه الحصة: ${rec ? statusLabel[rec.status] : "لم تُسجَّل بعد"}`);
    lines.push(`نسبة الحضور الإجمالية: ${stats.rate !== null && stats.rate !== undefined ? stats.rate + "%" : "—"}`);
    lines.push(`متوسط الدرجات: ${stats.avg !== null && stats.avg !== undefined ? stats.avg + "%" : "—"}`);
    if (recentScores.length) {
      lines.push("");
      lines.push("آخر الدرجات:");
      recentScores.forEach((s) => {
        lines.push(`- ${s.assessment.title}: ${s.score === "" ? "—" : s.score}/${s.assessment.maxScore}`);
      });
    }
    lines.push("");
    lines.push("مع تحيات مستر أحمد الدميري");
    return lines.join("\n");
  }

  function sendWhatsapp() {
    const phone = normalizePhoneForWhatsapp(student.guardianPhone);
    if (!phone) return;
    const text = encodeURIComponent(buildMessage());
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
  }

  return (
    <div
      onClick={onClose}
      style={{ background: "rgba(20,25,22,.55)" }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff" }}
        className="print-area rounded-2xl p-6 w-full max-w-sm flex flex-col gap-3 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="font-black text-base" style={{ color: COLORS.ink }}>{student.name}</div>
            <div className="mono text-xs opacity-60">{student.code} {student.grade ? `· ${student.grade}` : ""}</div>
          </div>
          <label className="no-print flex items-center gap-1.5 text-xs font-bold">
            <Calendar size={13} />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ background: COLORS.card, border: `1px solid ${COLORS.line}` }}
              className="rounded-lg px-2 py-1 text-xs outline-none mono"
            />
          </label>
        </div>

        <div style={{ borderTop: `1px dashed ${COLORS.line}` }} className="pt-3 flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="opacity-70">التاريخ</span>
            <span className="mono font-bold">{date}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="opacity-70">حالة هذه الحصة</span>
            <Pill color={rec ? statusColor[rec.status] : "#8a8272"}>{rec ? statusLabel[rec.status] : "لم تُسجَّل"}</Pill>
          </div>
          <div className="flex items-center justify-between">
            <span className="opacity-70">نسبة الحضور الإجمالية</span>
            <span className="mono font-bold">{stats.rate !== null && stats.rate !== undefined ? `${stats.rate}%` : "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="opacity-70">متوسط الدرجات</span>
            <span className="mono font-bold">{stats.avg !== null && stats.avg !== undefined ? `${stats.avg}%` : "—"}</span>
          </div>
        </div>

        {recentScores.length > 0 && (
          <div style={{ borderTop: `1px dashed ${COLORS.line}` }} className="pt-3">
            <div className="text-xs font-bold opacity-70 mb-1.5">آخر الدرجات</div>
            <div className="flex flex-col gap-1">
              {recentScores.map((s) => (
                <div key={s.assessmentId} className="flex items-center justify-between text-xs">
                  <span>{s.assessment.title}</span>
                  <span className="mono font-bold">{s.score === "" ? "—" : s.score}/{s.assessment.maxScore}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="no-print flex flex-col gap-2 mt-1">
          {student.guardianPhone ? (
            <button
              onClick={sendWhatsapp}
              style={{ background: "#25D366", color: "#fff" }}
              className="rounded-lg px-4 py-2 text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <MessageCircle size={14} /> إرسال لولي الأمر عبر واتساب
            </button>
          ) : (
            <div style={{ color: COLORS.brick }} className="text-[11px] flex items-center gap-1">
              <AlertCircle size={12} /> لا يوجد رقم ولي أمر مسجّل لهذا الطالب
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              style={{ background: COLORS.board, color: COLORS.paper }}
              className="flex-1 rounded-lg px-4 py-2 text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <Printer size={14} /> طباعة
            </button>
            <button
              onClick={onClose}
              style={{ background: COLORS.card, border: `1px solid ${COLORS.line}` }}
              className="flex-1 rounded-lg px-4 py-2 text-xs font-bold"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function QRModal({ student, ready, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{ background: "rgba(20,25,22,.55)" }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff" }}
        className="print-area rounded-2xl p-6 flex flex-col items-center gap-3 shadow-xl"
      >
        <div className="text-center">
          <div className="font-black text-base" style={{ color: COLORS.ink }}>{student.name}</div>
          <div className="mono text-xs opacity-60">{student.code}</div>
        </div>
        <QRBox value={buildAttendUrl(student.code)} ready={ready} />
        <div className="no-print flex gap-2 mt-1">
          <button
            onClick={() => window.print()}
            style={{ background: COLORS.board, color: COLORS.paper }}
            className="rounded-lg px-4 py-2 text-xs font-bold flex items-center gap-1.5"
          >
            <Printer size={14} /> طباعة
          </button>
          <button
            onClick={onClose}
            style={{ background: COLORS.card, border: `1px solid ${COLORS.line}` }}
            className="rounded-lg px-4 py-2 text-xs font-bold"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}

function PrintAllModal({ students, ready, onClose }) {
  const [gradeFilter, setGradeFilter] = useState("all");
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);

  const shown = students
    .filter((s) => gradeFilter === "all" || s.grade === gradeFilter)
    .filter((s) => !onlyUnassigned || !s.name);

  return (
    <div
      style={{ background: "rgba(20,25,22,.55)" }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        style={{ background: "#fff" }}
        className="rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-auto flex flex-col"
      >
        <div className="no-print flex flex-col gap-3 px-5 py-3 sticky top-0 bg-white border-b">
          <div className="flex items-center justify-between">
            <div className="font-bold text-sm" style={{ color: COLORS.ink }}>
              بطاقات QR ({shown.length} من {students.length})
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                style={{ background: COLORS.board, color: COLORS.paper }}
                className="rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1.5"
              >
                <Printer size={13} /> طباعة
              </button>
              <button onClick={onClose} style={{ background: COLORS.card, border: `1px solid ${COLORS.line}` }} className="rounded-lg px-3 py-1.5 text-xs font-bold">
                إغلاق
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {["all", ...GRADES].map((g) => {
              const active = gradeFilter === g;
              const color = g === "all" ? COLORS.board : GRADE_COLORS[g];
              return (
                <button
                  key={g}
                  onClick={() => setGradeFilter(g)}
                  style={{
                    background: active ? color : "transparent",
                    color: active ? "#fff" : color,
                    border: `1.5px solid ${color}`,
                  }}
                  className="rounded-full px-3 py-1 text-[11px] font-bold"
                >
                  {g === "all" ? "كل الصفوف" : g}
                </button>
              );
            })}
            <button
              onClick={() => setOnlyUnassigned((v) => !v)}
              style={{
                background: onlyUnassigned ? COLORS.brick : "transparent",
                color: onlyUnassigned ? "#fff" : COLORS.brick,
                border: `1.5px solid ${COLORS.brick}`,
              }}
              className="rounded-full px-3 py-1 text-[11px] font-bold"
            >
              غير المخصصة فقط
            </button>
          </div>
        </div>
        <div className="print-area grid grid-cols-2 sm:grid-cols-3 gap-4 p-5">
          {shown.length === 0 ? (
            <EmptyState text="لا يوجد أكواد مطابقة." />
          ) : (
            shown.map((s) => (
              <div
                key={s.id}
                style={{ border: `1px solid ${COLORS.line}` }}
                className="rounded-xl p-3 flex flex-col items-center gap-1.5 break-inside-avoid"
              >
                <div className="font-bold text-xs text-center" style={{ color: COLORS.ink }}>
                  {s.name || <span style={{ color: "#a89f8a" }}>غير مخصص</span>}
                </div>
                <div className="mono text-[10px] opacity-60">{s.code}</div>
                <QRBox value={buildAttendUrl(s.code)} ready={ready} size={110} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ====================================================================== */
/*  نافذة تأكيد كبيرة تظهر لما الصفحة تُفتح عبر رابط مسح QR (كاميرا الموبايل) */
/* ====================================================================== */
function ScanResultOverlay({ result, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4500);
    return () => clearTimeout(t);
  }, [onClose]);

  const ok = result.ok;
  const unassigned = !ok && result.reason === "unassigned";
  const bg = ok ? COLORS.sage : unassigned ? COLORS.amber : COLORS.brick;

  return (
    <div
      onClick={onClose}
      style={{ background: "rgba(20,25,22,.7)" }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: bg, color: "#fff" }}
        className="rounded-2xl p-8 flex flex-col items-center gap-3 shadow-2xl max-w-xs w-full text-center"
      >
        {ok ? <CheckCircle2 size={56} /> : unassigned ? <AlertCircle size={56} /> : <XCircle size={56} />}
        <div className="font-black text-lg">
          {ok ? "تم تسجيل الحضور" : unassigned ? "الكود لسه مش متخصص" : "كود غير معروف"}
        </div>
        <div className="text-sm opacity-90">
          {ok
            ? `${result.student.name} (${result.student.code})`
            : unassigned
            ? `اكتب اسم الطالب لكود ${result.student.code} من تبويب الطلاب الأول`
            : result.raw}
        </div>
        <button
          onClick={onClose}
          style={{ background: "rgba(255,255,255,.2)" }}
          className="mt-2 rounded-lg px-5 py-2 text-sm font-bold"
        >
          تمام
        </button>
      </div>
    </div>
  );
}

/* ====================================================================== */
/*  تعديل بيانات طالب موجود                                                */
/* ====================================================================== */
/* ====================================================================== */
/*  توليد دفعة أكواد QR فارغة (قبل معرفة أسماء الطلاب)                       */
/* ====================================================================== */
function BulkGenerateModal({ onClose, onGenerate }) {
  const [grade, setGrade] = useState(GRADES[0]);
  const [count, setCount] = useState(100);

  const safeCount = Math.min(2000, Math.max(1, Math.floor(Number(count) || 0)));

  return (
    <div
      onClick={onClose}
      style={{ background: "rgba(20,25,22,.55)" }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff" }}
        className="rounded-2xl p-6 w-full max-w-sm flex flex-col gap-3 shadow-xl"
      >
        <div className="font-black text-base" style={{ color: COLORS.ink }}>
          توليد أكواد QR بالجملة
        </div>
        <p className="text-xs opacity-70" style={{ color: COLORS.ink }}>
          بيولّد أكواد وأكواد QR فاضية (من غير أسماء) عشان تطبعها وتوزّعها الأول، وبعدين تعرف كل
          كود راح لمين، تدوس "تخصيص" وتكتب اسمه.
        </p>

        <label className="flex flex-col gap-1 text-xs font-bold opacity-70">
          الصف الدراسي
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, color: COLORS.ink }}
            className="rounded-lg px-3 py-2 text-sm outline-none font-normal"
          >
            {GRADES.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-bold opacity-70">
          عدد الأكواد
          <input
            type="number"
            min={1}
            max={2000}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, color: COLORS.ink }}
            className="rounded-lg px-3 py-2 text-sm outline-none font-normal mono"
          />
        </label>

        <div className="flex flex-wrap gap-1.5">
          {[100, 200, 500, 800, 1000].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCount(n)}
              style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, color: COLORS.board }}
              className="rounded-full px-2.5 py-1 text-[11px] font-bold"
            >
              {n}
            </button>
          ))}
        </div>

        {safeCount > 300 && (
          <div style={{ color: COLORS.amber }} className="text-[11px] flex items-center gap-1">
            <AlertCircle size={12} /> توليد عدد كبير قد ياخد لحظات، وطباعة كل الأكواد مرة واحدة
            هتاخد وقت أطول شوية.
          </div>
        )}

        <div className="flex gap-2 mt-1">
          <button
            onClick={() => onGenerate(grade, safeCount)}
            style={{ background: COLORS.board, color: COLORS.paper }}
            className="flex-1 rounded-lg px-4 py-2 text-xs font-bold"
          >
            توليد {safeCount} كود
          </button>
          <button
            onClick={onClose}
            style={{ background: COLORS.card, border: `1px solid ${COLORS.line}` }}
            className="flex-1 rounded-lg px-4 py-2 text-xs font-bold"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

function EditStudentModal({ student, onSave, onClose }) {
  const [name, setName] = useState(student.name);
  const [grade, setGrade] = useState(student.grade || GRADES[0]);
  const [phone, setPhone] = useState(student.phone || "");
  const [guardianPhone, setGuardianPhone] = useState(student.guardianPhone || "");

  function submit() {
    if (!name.trim()) return;
    onSave({ name: name.trim(), grade, phone: phone.trim(), guardianPhone: guardianPhone.trim() });
  }

  return (
    <div
      onClick={onClose}
      style={{ background: "rgba(20,25,22,.55)" }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff" }}
        className="rounded-2xl p-6 w-full max-w-sm flex flex-col gap-3 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <div className="font-black text-base" style={{ color: COLORS.ink }}>
            تعديل بيانات الطالب
          </div>
          <span className="mono text-xs opacity-50">{student.code}</span>
        </div>

        <label className="flex flex-col gap-1 text-xs font-bold opacity-70">
          الاسم
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, color: COLORS.ink }}
            className="rounded-lg px-3 py-2 text-sm outline-none font-normal"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-bold opacity-70">
          الصف الدراسي
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, color: COLORS.ink }}
            className="rounded-lg px-3 py-2 text-sm outline-none font-normal"
          >
            {GRADES.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-bold opacity-70">
          رقم هاتف الطالب
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, color: COLORS.ink }}
            className="rounded-lg px-3 py-2 text-sm outline-none font-normal"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-bold opacity-70">
          رقم ولي الأمر
          <input
            value={guardianPhone}
            onChange={(e) => setGuardianPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, color: COLORS.ink }}
            className="rounded-lg px-3 py-2 text-sm outline-none font-normal"
          />
        </label>

        <div className="flex gap-2 mt-1">
          <button
            onClick={submit}
            style={{ background: COLORS.board, color: COLORS.paper }}
            className="flex-1 rounded-lg px-4 py-2 text-xs font-bold"
          >
            حفظ التعديلات
          </button>
          <button
            onClick={onClose}
            style={{ background: COLORS.card, border: `1px solid ${COLORS.line}` }}
            className="flex-1 rounded-lg px-4 py-2 text-xs font-bold"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div
      style={{ border: `1.5px dashed ${COLORS.line}`, color: "#8a8272" }}
      className="rounded-xl py-8 text-center text-sm"
    >
      {text}
    </div>
  );
}
