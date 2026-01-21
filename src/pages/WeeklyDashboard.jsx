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
      "0"
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
    today.toISOString().split("T")[0]
  );
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const defaultWeekStart = new Date(today);
  defaultWeekStart.setDate(today.getDate() - today.getDay()); // minggu awal (Sunday)

  const [rawData, setRawData] = useState([]);
  // FILTER TERMINAL
  const [showTerminalDropdown, setShowTerminalDropdown] = useState(false);
  const [selectedTerminals, setSelectedTerminals] = useState([]);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [summary, setSummary] = useState({ delay: 0, onSchedule: 0 });

  // Warna pie chart
  const COLORS = ["#0BDA51", "#D62828"];

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

      // HANYA START → ambil >= start
      if (s && !e) return d >= s;

      // HANYA END → ambil <= end
      if (!s && e) return d <= e;

      // START & END → normal range
      if (s && e) return d >= s && d <= e;

      // kalau dua-duanya kosong → tampilkan semua
      return true;
    });

    // FILTER TERMINAL
    if (selectedTerminals.length > 0) {
      filtered = filtered.filter((r) => selectedTerminals.includes(r.terminal));
    }

    console.log("=== FILTERED DATE RANGE ===", filtered);
    return filtered;
  }, [rawData, startDate, endDate, selectedTerminals]);

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
      a.namaKapal > b.namaKapal ? 1 : -1
    );
  }, [weeklyData]);

  // ============================
  // 5️⃣ Summary Pie Chart (based on grouped)
  // ============================
  useEffect(() => {
    const delay = groupedWeekly.filter((d) => d.status === "DELAY").length;
    const onSchedule = groupedWeekly.filter(
      (d) => d.status === "ON SCHEDULE"
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
      `Laporan-Mingguan-${weekStart}-sd-${weekEnd}.xlsx`
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
            <h2>PNC Branch Jamrud Nilam Mirah</h2>
          </Header>

          <TopRow>
            <FilterGroup>
              <label>Pilih Rentang Tanggal:</label>

              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />

              <span style={{ margin: "0 10px" }}>s/d</span>

              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />

              {startDate && endDate && (
                <div
                  style={{ marginTop: "8px", opacity: 0.7, fontSize: "12px" }}
                >
                  Rentang: {startDate} — {endDate}
                </div>
              )}
            </FilterGroup>

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
                onClick={() => setShowTerminalDropdown(!showTerminalDropdown)}
                style={{
                  width: "180px",
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid #ccc",
                  background: "#fff",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                {selectedTerminals.length === 0
                  ? "Semua Terminal"
                  : `${selectedTerminals.length} dipilih`}
              </button>

              {showTerminalDropdown && (
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
                  }}
                >
                  {[
                    "Jamrud Utara",
                    "Jamrud Selatan",
                    "Jamrud Barat",
                    "Nilam",
                    "Mirah",
                    "Surabaya Veem",
                  ].map((terminal) => (
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
                              selectedTerminals.filter((t) => t !== terminal)
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