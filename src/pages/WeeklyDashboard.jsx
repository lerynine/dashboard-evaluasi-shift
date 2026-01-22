// src/pages/WeeklyDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase"; // sesuaikan path
import Sidebar from "../components/Sidebar"; // sesuaikan path
import { FaBars, FaTimes } from "react-icons/fa";
import * as XLSX from "xlsx";
import {
  Container,
  TopBar,
  MenuButton,
  Header,
  TopRow,
  FilterGroup,
  StatBox,
  Content,
  LeftPanel,
  RightPanel,
  StyledTable,
  StatusCell,
  ChartTitle,
  ChartContainer,
} from "../styles/DashboardStyles";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

// ======================
// Helper
// ======================
const toNumber = (val) => {
  if (val === undefined || val === null || val === "") return 0;

  let str = val.toString().trim();

  // 1️⃣ Kalau format Indonesia/Eropa (misal "1.200,5")
  if (str.match(/,\d{1,2}$/) && str.includes(".")) {
    str = str.replace(/\./g, "").replace(",", ".");
  }

  // 2️⃣ Kalau format Inggris (misal "1,200.5")
  else if (str.match(/\.\d{1,2}$/) && str.includes(",")) {
    str = str.replace(/,/g, "");
  }

  // 3️⃣ Kalau format polos (misal "1200.5" atau "1000")
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  const rows = lines.map((line) => {
    const cells = [];
    let cur = "";
    let inQuotes = false;
    for (let ch of line) {
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === "," && !inQuotes) {
        cells.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur);
    return cells.map((c) => c.trim());
  });
  return rows;
}

function convertToISO(input) {
  if (!input || typeof input !== "string") return "";

  // Deteksi kalau formatnya sudah ISO (misalnya "2025-11-13")
  if (input.includes("-")) {
    return input.split("T")[0].trim();
  }

  // Format umum dari Google Sheet: "MM/DD/YYYY HH:mm:ss"
  try {
    const [month, day, rest] = input.split("/");
    if (!month || !day || !rest) return "";

    const [year, time] = rest.split(" ");
    // gunakan format aman Safari: YYYY/MM/DD HH:mm:ss
    const dateStr = `${year}/${month.padStart(2, "0")}/${day.padStart(
      2,
      "0",
    )} ${time || "00:00:00"}`;

    const localDate = new Date(dateStr);

    if (isNaN(localDate)) return "";

    const offsetMs = localDate.getTimezoneOffset() * 60000;
    const localISO = new Date(localDate.getTime() - offsetMs)
      .toISOString()
      .split("T")[0];
    return localISO;
  } catch (err) {
    console.warn("⚠️ convertToISO gagal parse:", input, err);
    return "";
  }
}

function autoCorrectNamaKapal(name) {
  let n = name.toUpperCase().trim();

  // ===============================
  // 1) Koreksi typo khusus
  // ===============================

  // NDO SUKSES → INDO SUKSES
  if (n.startsWith("NDO SUKSES")) {
    return "INDO SUKSES" + n.replace("NDO SUKSES", "").trim();
  }

  // LINTAS LORENZ → LINTAS LORENTZ
  if (n.includes("LINTAS LORENZ")) {
    n = n.replace("LINTAS LORENZ", "LINTAS LORENTZ");
  }

  // ===============================
  // 2) Koreksi umum PASIFIC → PACIFIC
  // ===============================
  n = n.replace(/PASIFIC/g, "PACIFIC");

  // ===============================
  // 3) Koreksi huruf "I" di akhir → angka 1
  // ===============================
  if (/\sI$/.test(n)) {
    n = n.replace(/\sI$/, " 1");
  }

  return n;
}

function cleanNamaKapalKey(name = "") {
  return name
    .replace(/\b(KM|TK|MT)\b\.?/gi, "")
    .replace(/[\s\.]/g, "") // HAPUS seluruh spasi dan titik
    .toUpperCase()
    .trim();
}

function cleanNamaKapalDisplay(name = "") {
  let n = name.toUpperCase().trim();

  // Hilangkan MV, KM, TK, dan titik
  n = n
    .replace(/\b(KM|TK)\b\.?/g, "")
    .replace(/\./g, "")
    .trim();

  // Perbaikan typo kapal tertentu
  n = autoCorrectNamaKapal(n);

  // Normalize multiple spaces → single space
  n = n.replace(/\s+/g, " ");

  return n;
}

const BRANCH_TERMINALS = {
  BALIKPAPAN: ["KARIANGAU KALTIM TERMINAL", "SEMAYANG"],
  BELAWAN: [
    "CITRA-KADE 200",
    "Citra - KADE 201",
    "Citra - KADE 202",
    "Citra - KADE 203",
    "DERMAGA BELAWAN",
    "DERMAGA BELAWAN LAMA",
    "DERMAGA BELAWAN LAMA KD 001",
    "DERMAGA BELAWAN LAMA KD 002",
    "DERMAGA BELAWAN LAMA KD 003",
    "DERMAGA BELAWAN LAMA KD 004",
    "DERMAGA BELAWAN LAMA KD 005",
    "DERMAGA BELAWAN LAMA KD 006",
    "DERMAGA BELAWAN LAMA KD 007",
    "DERMAGA BELAWAN LAMA KD 008",
    "DERMAGA CITRA",
    "DERMAGA IKD",
    "DERMAGA PLTU BELAWAN",
    "DERMAGA SEMEN ANDALAS BELAWAN",
    "DERMAGA TJIPTA RIMBA DJAJA",
    "Dermaga TUKS PT. PERUSAHAAN LISTRIK NEGARA (PERSERO) KITLUR SUMBAGUT",
    "Dermaga TUKS PT. SEMEN ANDALAS INDONESIA",
    "Dermaga TUKS PT. TJIPTA RIMBA DJAJA",
    "DERMAGA UJUNG BARU",
    "DERMAGA UJUNG BARU 101",
    "DERMAGA UJUNG BARU 102",
    "DERMAGA UJUNG BARU 103",
    "DERMAGA UJUNG BARU 104",
    "DERMAGA UJUNG BARU 105",
    "DERMAGA UJUNG BARU 106",
    "DERMAGA UJUNG BARU 107",
    "DERMAGA UJUNG BARU 108",
    "DERMAGA UJUNG BARU 109",
    "DERMAGA UJUNG BARU 110",
    "DERMAGA UJUNG BARU 111",
    "DERMAGA UJUNG BARU 112",
    "DERMAGA UJUNG BARU 113",
    "DERMAGA UJUNG BARU 114",
    "IKD 1",
    "TERMINAL CURAH KERING IKD II",
    "UJUNG BARU - DERMAGA FERRY",
  ],
  BENOA: ["DERMAGA SELATAN"],
  BIMABADAS: [
    "DERMAGA BIMA",
    "DMG BIMA",
    "DMG BIMA - NUSANTARA II",
    "DMG KSOP BIMA NUSANTARA I KSP",
    "DMG KSOP BIMA NUSANTARA KSP",
    "DMG PELRA BIMA 1",
    "DMG PELRA BIMA 2",
    "KSOP BIMA PELRA KSP",
    "RTK 01",
    "SECURITY CHECK AREA",
    "TERM PENUMPANG KOTABARU",
  ],
  BUMIHARJOBAGENDANG: [
    "BUMBU KUNING YUTABA",
    "DERMAGA ASDP",
    "DERMAGA CITRA BORNEO CENTER",
    "DERMAGA CURAH CAIR 1 BUMIHARJO",
    "DERMAGA CURAH CAIR 2 BUMIHARJO",
    "DERMAGA CURAHCAIR BUMIHARJO J2",
    "DERMAGA JETTY 3 BUMIHARJO",
    "DERMAGA KAPUAS PRIMA COAL 2",
    "DERMAGA KORINDO PANGKALAN BUN",
    "DERMAGA MULTIPURPOSE BUMIHARJO",
    "DERMAGA PERTAMINA KUMAI",
    "DERMAGA PINGGIRAN",
    "DERMAGA PT.SAP",
    "DERMAGA PUTRA BALI",
    "DERMAGA SBI",
    "DERMAGA UMUM KUMAI",
    "DERMAGA UMUM PANGKALAN BUN",
    "DERMAGA UMUM (P) PANGKALAN BUN",
    "DERMAGA UMUM (P) SUKAMARA",
    "DERMAGA UMUM SUKAMARA",
    "EAGLE HIGH PLANTATION",
    "ERYTHRINA NUGRAHA MEGAH",
    "FAJAR ANEKA SENTOSA",
    "GUNTUR ARTHA WIGUNA",
    "INDOTRUBA TENGAH",
    "IRVAN PRIMA PRATAMA",
    "KALIMANTAN SAWIT KUSUMA",
    "KALIMANTAN SUMBER ENERGI",
    "KUMAI USAHA MARINA",
    "PETRO ANDALAN",
    "PRIMA BUDIARTA NUSA",
    "SUNGAI RANGIT",
    "WANASAWIT SUBUR LESTARI",
  ],
  DUMAI: [
    "DERMAGA A DUMAI (DERMAGA_A)",
    "DERMAGA A (KHUSUS SEMEN) (A-SEMEN)",
    "DERMAGA B DALAM DUMAI (DERMAGA_BD)",
    "DERMAGA B DUMAI (DERMAGA_B)",
    "DERMAGA BEACHING DUMAI (BEACHING)",
    "DERMAGA C DUMAI (DERMAGA_C)",
    "DERMAGA D DUMAI (DERMAGA_D)",
  ],
  GRESIK: [
    "DERMAGA 180",
    "DERMAGA 265",
    "DERMAGA 70",
    "DERMAGA 78",
    "DERMAGA BANGUN ARTA",
    "DERMAGA IBL SISI DALAM",
    "DERMAGA PELRA",
    "DERMAGA PENUMPANG",
    "DERMAGA TALUD TEGAK",
    "DERMAGA TALUD TEGAK SISI DALAM",
    "DERMAGA UMUM IBL SISI LUAR",
    "DERMAGA UMUM MULTIPURPOSE",
    "DERMAGA UMUM PENUMPANG",
    "DERMAGA UMUM PT. GRESIK JASA TAMA",
    "DERMAGA UMUM TALUD TEGAK KONVENSIONAL",
    "RUANG TUNGGU KENDARAAN 01",
    "RUANG TUNGGU PENUMPANG 01",
  ],
  JNM: [
    "Jamrud Utara",
    "Jamrud Selatan",
    "Jamrud Barat",
    "Nilam",
    "Mirah",
    "Surabaya Veem",
  ],
  KALIMAS: [],
  LEMBAR: [
    "BOARDING GATE 01",
    "DERMAGA GILIMAS",
    "DERMAGA LOKAL",
    "DERMAGA LOKAL I",
    "DERMAGA LOKAL II",
    "DERMAGA NUSANTARA 2",
    "DERMAGA NUSANTARA I",
    "DERMAGA NUSANTARA II",
    "DERMAGA PONTON",
    "DERMAGA RAKYAT",
    "MAIN GATE 01",
    "MOORING BUOY BOSOWA",
    "MOORING BUOY TIGA RODA",
    "RTK GILIMAS",
    "RTK GILIMAS 02",
    "RTK LEMBAR",
    "RTK LEMBAR 02",
    "RUANG TUNGGU 01",
    "RUANG TUNGGU 02",
    "SECURITY CHECK AREA",
    "TERMINAL GILIMAS",
  ],
  LHOKSEUMAWELANGSA: [
    "Dermaga Umum",
    "PELINDO - BREASTING DOLPHIN / CURAH CAIR",
    "PELINDO - BREASTING DOLPHIN/ CURAH KERING",
    "PELINDO - DERMAGA PENUMPANG",
    "PELINDO - MULTIPURPOSE",
    "PELINDO - MULTIPURPOSE (EX. AAF)",
    "DERMAGA BARU EX-SINGAPORE",
    "DERMAGA TAPAKTUAN",
  ],
  MAKASSAR: [
    "DERMAGA CURAH CAIR BAGENDANG",
    "DERMAGA MAKASSAR",
    "DERMAGA MULTIPURSP BAGENDANG 1",
    "DERMAGA MULTIPURSP BAGENDANG 2",
    "HASANUDDIN - MULTIPURPOSE I",
    "HATTA - CURAH KERING",
    "SOEKARNO",
    "SOEKARNO - MULTIPURPOSE III - BERDIKARI",
    "SOEKARNO - MULTIPURPOSE II - INTERNASIONAL",
    "SOEKARNO - RO RO",
  ],
  MALAHAYATIMEULABOH: [
    "JETTY 1",
    "JETTY 2",
    "JETTY 3",
    "DERMAGA BARU EX-SINGAPORE",
    "DERMAGA MEULABOH LAMA",
    "DERMAGA TAPAKTUAN",
  ],
  PAREPAREGARONKONG: [
    "DERMAGA APBN",
    "DERMAGA APBN - CAPPA UJUNG",
    "DERMAGA LONTANGNGE",
    "DERMAGA NUSANTARA",
    "DERMAGA PARE PARE",
    "DERMAGA PETI KEMAS",
    "DERMAGA UMUM 1 GARONGKONG",
  ],
  SIBOLGA: [
    "AREA SHIP TO SHIP (STS)",
    "CARGO DAN TERMINAL PENUMPANG",
    "DERMAGA 01 KIJANG",
    "DERMAGA 46 DARAT",
    "DERMAGA 46 LAUT",
    "DERMAGA DOLPHIN DARAT",
    "DERMAGA DOLPHIN LAUT",
    "DERMAGA FERRY",
    "DERMAGA LABUHAN ANGIN",
    "DERMAGA SISI LUAR",
    "DERMAGA TRESTEL DARAT",
    "DERMAGA TRESTEL LAUT",
    "LABUH",
  ],
  TANJUNGBALAIKARIMUN: [],
  TANJUNGEMAS: [],
  TANJUNGINTAN: [
    "DERMAGA PUSRI",
    "MULTIPURPOSE II (TAMBATAN VI)",
    "MULTIPURPOSE I (TAMBATAN I - IV)",
    "TAMBATAN I",
    "TAMBATAN II",
    "TAMBATAN III",
    "TAMBATAN S2P PLTU I",
    "TAMBATAN S2P PLTU II",
    "TAMBATAN S2P PLTU III",
    "TAMBATAN VI",
    "TAMB. KARANG TALUN I",
    "TAMB. KARANG TALUN II",
    "WIJAYAPURA",
    "YETTY DONAN I AREA 60",
    "YETTY DONAN II AREA 60",
  ],
  TANJUNGPINANG: [
    "AREA LABUH CAPE SETUMU",
    "AREA LABUH PENYENGAT",
    "AREA LABUH TERKULAI",
    "BINTAN ALUMINA INDONESIA",
    "BINTAN NUSAMULTI TUKS",
    "BINTAN OFSHORE POSTPAY",
    "DERMAGA 01 BATU ANAM",
    "DERMAGA 01 KIJANG",
    "DERMAGA 02 KIJANG",
    "DERMAGA 50 METER",
    "DERMAGA BATU ANAM",
    "DERMAGA BEACHING",
    "DERMAGA BETON",
    "DERMAGA BINTAN MAHKOTA SUKSES",
    "DERMAGA MEITECH EKA BINTAN",
    "DERMAGA PERTAMINA KIJANG",
    "DERMAGA PETIKEMAS",
    "DERMAGA TUKS BINTANG KARTIKA",
    "DERMAGA UMUM SRI BAYINTAN KIJANG",
    "LABUH",
    "PONTON A1",
    "PONTON A2",
    "PONTON BRAVO",
    "PONTON C1",
    "PONTON C2",
    "PONTON D1",
    "PONTON D2",
    "PONTON VIP",
    "RTK 01",
    "RTK 02",
    "RUANG TUNGGU DOMESTIK",
    "RUANG TUNGGU INTERNASIONAL",
    "SECURITY CHECK AREA",
    "Terminal Penumpang SRI BAYINTAN KIJANG",
    "Terminal Penumpang SRI BINTAN PURA",
    "TUKS BINTAN KARISMA PRATAMA",
    "TUKS CAPITAL TURBINES",
    "WILAYAH LABUH PERAIRAN TEMBORA",
    "WILAYAH STS TANJUNG TILI",
    "WILAYAH STS TELANG POSTPAY",
  ],
  TANJUNGWANGI: [
    "DERMAGA UMUM",
    "DERMAGA UMUM TG WANGI",
    "MAIN GATE 01",
    "RTK 01",
    "RTK 02",
    "RUANG TUNGGU 01",
    "RUANG TUNGGU 02",
  ],
  TRISAKTIMEKARPUTIH: [
    "BASIRIH",
    "DERMAGA 50",
    "DERMAGA BEACHING",
    "DERMAGA UMUM",
    "JETTY 1",
    "KADE AKR",
    "MARTAPURA BARU",
    "PELRA BASIRIH",
    "PELRA MARTAPURA BARU",
    "PELRA MARTAPURA LAMA",
    "RTK 01",
    "SECURITY CHECK AREA",
    "TERM PENUMPANG TRISAKTI",
    "TRISAKTI",
    "TRISAKTI100",
    "TRISAKTI200",
    "TRISAKTI300",
    "TRISAKTI400",
    "TRISAKTI500",
  ],
};

// ======================
// Weekly Dashboard Page
// ======================
export default function WeeklyDashboard() {
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);

  const defaultStart = new Date(today);
  defaultStart.setDate(today.getDate() - today.getDay()); // Minggu

  const defaultEnd = new Date(defaultStart);
  defaultEnd.setDate(defaultStart.getDate() + 6); // Sabtu

  const [selectedWeek, setSelectedWeek] = useState(
    today.toISOString().split("T")[0],
  );
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const defaultWeekStart = new Date(today);
  defaultWeekStart.setDate(today.getDate() - today.getDay()); // minggu awal (Sunday)
  // FILTER BRANCH
  const [selectedBranch, setSelectedBranch] = useState("");

  const availableTerminals = useMemo(() => {
    if (!selectedBranch) return [];

    return BRANCH_TERMINALS[selectedBranch] || [];
  }, [selectedBranch]);

  const [rawData, setRawData] = useState([]);
  // FILTER TERMINAL
  const [showTerminalDropdown, setShowTerminalDropdown] = useState(false);
  const [selectedTerminals, setSelectedTerminals] = useState([]);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [summary, setSummary] = useState({ delay: 0, onSchedule: 0 });

  // Warna pie chart
  const COLORS = ["#0BDA51", "#D62828"];

  useEffect(() => {
    setSelectedTerminals([]);
  }, [selectedBranch]);

  useEffect(() => {
    setStartDate(defaultStart.toISOString().split("T")[0]);
    setEndDate(defaultEnd.toISOString().split("T")[0]);
  }, []);

  // ============================
  // 1️⃣ Ambil data (Firestore + Sheet)
  // ============================
  useEffect(() => {
    const fetchData = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "laporan"));
        const firestoreData = querySnapshot.docs
          .map((doc) => {
            const d = doc.data() || {};
            let tanggalAsli = "";
            if (d.createdAt && typeof d.createdAt.toDate === "function") {
              tanggalAsli = d.createdAt.toDate().toISOString().split("T")[0];
            }

            const shift = (d.shift || "").toString().trim();
            let tanggalFilter = tanggalAsli;

            if (shift.toUpperCase().startsWith("III")) {
              const t = tanggalAsli ? new Date(tanggalAsli) : new Date();
              t.setDate(t.getDate() - 1);
              tanggalFilter = t.toISOString().split("T")[0];
            }

            const jumlahMuatan = toNumber(d.jumlahMuatan);
            const realisasiBongkarMuat = toNumber(d.realisasiBongkarMuat);
            const perencanaanShift = toNumber(d.perencanaanShift);
            const realisasiShift = toNumber(d.realisasiShift);
            const balance = jumlahMuatan - realisasiBongkarMuat;

            const targetPerShift = perencanaanShift
              ? jumlahMuatan / perencanaanShift
              : 0;
            const totalTarget = targetPerShift * realisasiShift;
            const status =
              realisasiBongkarMuat >= totalTarget ? "ON SCHEDULE" : "DELAY";

            return {
              sumber: "firestore",
              tanggal: tanggalFilter, // untuk filter minggu
              tanggalAsli,
              terminal: d.terminal || "",
              shift: d.shift || "",
              namaKapal: cleanNamaKapalDisplay(d.namaKapal || ""),
              realisasiTgh: d.realisasiTgh || "",
              ketercapaian: d.ketercapaian || "",
              jumlahMuatan,
              realisasiBongkarMuat,
              perencanaanShift,
              realisasiShift,
              balance,
              tambatan: d.tambatan || "",
              keterangan: d.remark || d.keterangan || "",
              status,
              lampiran: d.lampiran || [],
              etbetd: d.etbetd || "",
            };
          })
          .filter((r) => r.namaKapal);

        // Ambil sheet CSV
        const sheetUrl =
          "https://docs.google.com/spreadsheets/d/1NKzce5mlBRcIvHuI4UXzaOIStmWmx4Wzdu4pWzf-a78/gviz/tq?tqx=out:csv";
        const res = await fetch(sheetUrl);
        const text = await res.text();
        const rows = parseCSV(text);

        let sheetData = [];
        if (rows.length > 1) {
          sheetData = rows
            .slice(1)
            .map((r) => {
              const tanggalAsli = convertToISO(r[0]);
              const shift = (r[3] || "").toString().trim();
              let tanggalFilter = tanggalAsli;

              if (shift.toUpperCase().startsWith("III")) {
                const t = tanggalAsli ? new Date(tanggalAsli) : new Date();
                t.setDate(t.getDate() - 1);
                tanggalFilter = t.toISOString().split("T")[0];
              }

              const terminal = r[1] || "";
              const namaKapal = cleanNamaKapalDisplay(r[4] || "");
              const remark = r[9] || "";
              const jumlahMuatan = toNumber(r[13]);
              const realisasiBongkarMuat = toNumber(r[14]);
              const perencanaanShift = toNumber(r[15]);
              const realisasiShift = toNumber(r[16]);
              const etbetd = r[18] || "";
              const targetPerShift = perencanaanShift
                ? jumlahMuatan / perencanaanShift
                : 0;
              const totalTarget = targetPerShift * realisasiShift;
              const status =
                realisasiBongkarMuat >= totalTarget ? "ON SCHEDULE" : "DELAY";
              const balance = jumlahMuatan - realisasiBongkarMuat;

              return {
                sumber: "sheet",
                tanggal: tanggalFilter,
                tanggalAsli,
                timestamp: r[0],
                terminal,
                shift,
                namaKapal,
                realisasiTgh: r[7] || "",
                ketercapaian: r[8] || "",
                jumlahMuatan,
                realisasiBongkarMuat,
                perencanaanShift,
                realisasiShift,
                balance: jumlahMuatan - realisasiBongkarMuat,
                tambatan: r[17] || "",
                keterangan: remark,
                status,
                lampiran: r[10] ? [r[10]] : [],
                etbetd,
              };
            })
            .filter((r) => r.namaKapal);
        }

        console.log("=== FIRESTORE DATA ===", firestoreData);
        console.log("=== SHEET RAW ROWS ===", rows);
        console.log("=== SHEET PARSED ===", sheetData);

        setRawData([...firestoreData, ...sheetData]);
      } catch (e) {
        console.error("Error fetching data:", e);
      }
    };

    fetchData();
  }, []);

  // ============================
  // 2️⃣ Hitung tanggal awal–akhir minggu
  // ============================
  const { weekStart, weekEnd } = useMemo(() => {
    const d = new Date(selectedWeek);
    const start = new Date(d);
    start.setDate(d.getDate() - d.getDay()); // sunday
    const end = new Date(start);
    end.setDate(start.getDate() + 6); // saturday

    return {
      weekStart: start.toISOString().split("T")[0],
      weekEnd: end.toISOString().split("T")[0],
    };
  }, [selectedWeek]);

  // ############################
  // 3️⃣ Filter weekly + filter terminal
  // ############################
  const weeklyData = useMemo(() => {
    if (!rawData || rawData.length === 0) return [];

    let filtered = rawData.filter((r) => {
      if (!r || !r.tanggal) return false;

      const d = new Date(r.tanggal);
      if (isNaN(d)) return false;

      const s = startDate ? new Date(startDate) : null;
      const e = endDate ? new Date(endDate) : null;

      if (s && !e) return d >= s;
      if (!s && e) return d <= e;
      if (s && e) return d >= s && d <= e;
      return true;
    });

    // FILTER BRANCH
    if (selectedBranch) {
      const terminalsByBranch = BRANCH_TERMINALS[selectedBranch] || [];
      filtered = filtered.filter((r) => terminalsByBranch.includes(r.terminal));
    }

    // FILTER TERMINAL
    if (selectedTerminals.length > 0) {
      filtered = filtered.filter((r) => selectedTerminals.includes(r.terminal));
    }

    return filtered;
  }, [rawData, startDate, endDate, selectedBranch, selectedTerminals]);

  // ============================
  // 4️⃣ Group by namaKapal — pick latest values & sum realisasiBongkarMuat
  // ============================
  const groupedWeekly = useMemo(() => {
    const map = {};

    weeklyData.forEach((item) => {
      if (!item || !item.namaKapal) return;

      // normalize date string so comparison works
      const itemDate = item.tanggal || item.tanggalAsli || "";

      const originalName = cleanNamaKapalDisplay(item.namaKapal);
      const key = cleanNamaKapalKey(item.namaKapal);

      if (!map[key]) {
        map[key] = {
          namaKapal: originalName, // ✅ tampilannya tetap rapi & ada spasi

          terminal: item.terminal || "",
          realisasiTgh: item.realisasiTgh || "",
          ketercapaian: item.ketercapaian || "",
          jumlahMuatan: toNumber(item.jumlahMuatan),
          totalRealisasi: toNumber(item.realisasiBongkarMuat), // sum
          perencanaanShift: toNumber(item.perencanaanShift),
          realisasiShift: toNumber(item.realisasiShift),
          status: item.status || "",
          latestDate: itemDate || "", // keep latest timestamp for comparisons
        };
      } else {
        // sum total realisasi (accumulate)
        // hanya ambil nilai realisasi terbaru, TIDAK menjumlahkan
        if (itemDate > map[key].latestDate) {
          map[key].totalRealisasi = toNumber(item.realisasiBongkarMuat);
        }

        // If this record is newer, overwrite the "latest" fields (terminal, tgh, ketercapaian, shifts, status)
        if (itemDate && map[key].latestDate && itemDate > map[key].latestDate) {
          map[key].latestDate = itemDate;
          map[key].terminal = item.terminal || map[key].terminal;
          map[key].realisasiTgh = item.realisasiTgh || map[key].realisasiTgh;
          map[key].ketercapaian = item.ketercapaian || map[key].ketercapaian;
          map[key].perencanaanShift =
            toNumber(item.perencanaanShift) || map[key].perencanaanShift;
          map[key].realisasiShift =
            toNumber(item.realisasiShift) || map[key].realisasiShift;
          map[key].status = item.status || map[key].status;
          map[key].jumlahMuatan =
            toNumber(item.jumlahMuatan) || map[key].jumlahMuatan;
        }
      }
    });

    return Object.values(map).sort((a, b) =>
      a.namaKapal > b.namaKapal ? 1 : -1,
    );
  }, [weeklyData]);

  // ============================
  // 5️⃣ Summary Pie Chart (based on grouped)
  // ============================
  useEffect(() => {
    const delay = groupedWeekly.filter((d) => d.status === "DELAY").length;
    const onSchedule = groupedWeekly.filter(
      (d) => d.status === "ON SCHEDULE",
    ).length;
    setSummary({ delay, onSchedule });
  }, [groupedWeekly]);

  const pieData = [
    { name: "ON SCHEDULE", value: summary.onSchedule },
    { name: "DELAY", value: summary.delay },
  ];

  const formatNumber = (num) =>
    num || num === 0 ? Number(num).toLocaleString() : "-";

  const downloadExcel = () => {
    // ubah data ke bentuk array object biasa
    const exportData = groupedWeekly.map((row) => ({
      Terminal: row.terminal || "-",
      "Nama Kapal": row.namaKapal || "-",
      "Realisasi TGH": row.realisasiTgh || "-",
      "Ketercapaian TGH": row.ketercapaian || "-",
      "Jumlah Bongkar/Muat Total": row.jumlahMuatan,
      "Realisasi Bongkar/Muat s.d Sekarang": row.totalRealisasi,
      "Perencanaan Jumlah Shift": row.perencanaanShift,
      "Realisasi Jumlah Shift s.d Sekarang": row.realisasiShift,
      Status: row.status,
    }));

    // buat worksheet
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // buat workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Mingguan");

    // download
    XLSX.writeFile(
      workbook,
      `Laporan-Mingguan-${weekStart}-sd-${weekEnd}.xlsx`,
    );
  };

  // ============================
  // 6️⃣ Render Page
  // ============================
  return (
    <div
      id="dashboard-content"
      style={{
        width: "100%",
        background: "#fff",
        padding: "0",
        margin: "0",
      }}
    >
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <Container>
        <TopBar>
          <MenuButton onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <FaTimes /> : <FaBars />}
          </MenuButton>
        </TopBar>

        <div className="pdf-page">
          <Header>
            <h1>Evaluasi Mingguan Capaian Kinerja</h1>
            <h2>PNC Pelindo Multi Terminal</h2>
          </Header>

          <TopRow>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              <label style={{ fontWeight: "600" }}>Pilih Tanggal:</label>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  whiteSpace: "nowrap",
                }}
              >
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />

                <span>s/d</span>

                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* ==========================
    FILTER BRANCH
========================== */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              <label style={{ fontWeight: "600" }}>Branch:</label>

              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                style={{
                  width: "180px",
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid #ccc",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                <option value="">Semua Branch</option>
                <option value="BALIKPAPAN">Balikpapan</option>
                <option value="BELAWAN">Belawan</option>
                <option value="BENOA">Benoa</option>
                <option value="BIMABADAS">Bima Badas</option>
                <option value="BUMIHARJOBAGENDANG">Bumiharjo Bagendang</option>
                <option value="DUMAI">Dumai</option>
                <option value="GRESIK">Gresik</option>
                <option value="JNM">Jamrud Nilam Mirah</option>
                <option value="KALIMAS">Kalimas</option>
                <option value="LEMBAR">Lembar</option>
                <option value="LHOKSEUMAWELANGSA">Lhokseumawe Langsa</option>
                <option value="MAKASSAR">Makassar</option>
                <option value="MALAHAYATIMEULABOH">Malahayati Meulaboh</option>
                <option value="PAREPAREGARONKONG">Pare Pare Garongkong</option>
                <option value="SIBOLGA">Sibolga</option>
                <option value="TANJUNGBALAIKARIMUN">
                  Tanjung Balai Karimun
                </option>
                <option value="TANJUNGEMAS">Tanjung Emas</option>
                <option value="TANJUNGINTAN">Tanjung Intan</option>
                <option value="TANJUNGPINANG">Tanjung Pinang</option>
                <option value="TANJUNGWANGI">Tanjung Wangi</option>
                <option value="TRISAKTIMEKARPUTIH">Trisakti Mekar Putih</option>
              </select>
            </div>

            {/* ==========================
                    FILTER TERMINAL
                ========================== */}
            <div
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              <label style={{ fontWeight: "600" }}>Terminal:</label>

              <button
                type="button"
                disabled={!selectedBranch}
                onClick={() =>
                  selectedBranch &&
                  setShowTerminalDropdown(!showTerminalDropdown)
                }
                style={{
                  width: "180px",
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid #ccc",
                  background: selectedBranch ? "#fff" : "#f2f2f2",
                  textAlign: "left",
                  cursor: selectedBranch ? "pointer" : "not-allowed",
                  color: selectedBranch ? "#000" : "#888",
                }}
              >
                {!selectedBranch
                  ? "Pilih Branch dahulu"
                  : selectedTerminals.length === 0
                    ? "Semua Terminal"
                    : `${selectedTerminals.length} dipilih`}
              </button>
              {showTerminalDropdown && selectedBranch && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    zIndex: 10,
                    width: "200px",
                    background: "#fff",
                    border: "1px solid #ccc",
                    borderRadius: "6px",
                    marginTop: "4px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                    padding: "8px",

                    // ⬇️ INI KUNCI NYA
                    maxHeight: "220px",
                    overflowY: "auto",
                  }}
                >
                  {availableTerminals.map((terminal) => (
                    <label
                      key={terminal}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginBottom: "4px",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        value={terminal}
                        checked={selectedTerminals.includes(terminal)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTerminals([
                              ...selectedTerminals,
                              terminal,
                            ]);
                          } else {
                            setSelectedTerminals(
                              selectedTerminals.filter((t) => t !== terminal),
                            );
                          }
                        }}
                      />
                      {terminal}
                    </label>
                  ))}

                  <button
                    type="button"
                    onClick={() => setSelectedTerminals([])}
                    style={{
                      marginTop: "8px",
                      width: "100%",
                      background: "#dc3545",
                      color: "#fff",
                      border: "none",
                      borderRadius: "4px",
                      padding: "6px",
                      cursor: "pointer",
                    }}
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>

            <StatBox color="#0077B6">
              Jumlah Kapal
              <div>{groupedWeekly.length}</div>
            </StatBox>

            <StatBox color="#D62828">
              Delay
              <div>{summary.delay}</div>
            </StatBox>

            <StatBox color="#0BDA51">
              On Schedule
              <div>{summary.onSchedule}</div>
            </StatBox>
          </TopRow>

          <Content>
            <LeftPanel>
              <StyledTable>
                <thead>
                  <tr>
                    <th>Terminal</th>
                    <th>Nama Kapal</th>
                    <th>Realisasi TGH</th>
                    <th>Ketercapaian TGH</th>
                    <th>Jumlah Bongkar/Muat Total</th>
                    <th>Realisasi Bongkar/Muat s.d Sekarang</th>
                    <th>Perencanaan Jumlah Shift</th>
                    <th>Realisasi Jumlah Shift s.d Sekarang</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {groupedWeekly.map((row, index) => (
                    <tr key={index}>
                      <td>{row.terminal || "-"}</td>
                      <td style={{ fontWeight: 600 }}>{row.namaKapal}</td>
                      <td>{row.realisasiTgh || "-"}</td>
                      <td>{row.ketercapaian || "-"}</td>
                      <td>{formatNumber(row.jumlahMuatan)}</td>
                      <td>{formatNumber(row.totalRealisasi)}</td>
                      <td>{formatNumber(row.perencanaanShift)}</td>
                      <td>{formatNumber(row.realisasiShift)}</td>
                      <StatusCell status={row.status}>
                        {row.status || "-"}
                      </StatusCell>
                    </tr>
                  ))}

                  {groupedWeekly.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        style={{ textAlign: "center", color: "#666" }}
                      ></td>
                    </tr>
                  )}
                </tbody>
              </StyledTable>
              <button
                id="download-excel-btn"
                onClick={downloadExcel}
                style={{
                  marginTop: "10px",
                  backgroundColor: "#002b5b",
                  color: "#fff",
                  padding: "10px 20px",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Download Excel
              </button>
            </LeftPanel>

            <RightPanel>
              <ChartTitle>Presentase Status Mingguan</ChartTitle>
              <ChartContainer>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={70} // diperkecil supaya tidak menimpa tabel
                      dataKey="value"
                      label
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: "10px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            </RightPanel>
          </Content>
        </div>
      </Container>
    </div>
  );
}