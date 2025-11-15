import { useEffect, useState } from "react";
import styled from "styled-components";
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";
import { useMemo } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import Sidebar from "../components/Sidebar";
import { FaBars, FaTimes } from "react-icons/fa";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

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

// 🧩 Helper function: parsing "MM/DD/YYYY HH:mm:ss" jadi Date valid
function parseCustomDate(str) {
  if (!str) return new Date(0);
  const s = String(str).trim();

  // format "MM/DD/YYYY HH:mm:ss"
  const match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2}))?$/);
  if (match) {
    const [, month, day, year, hh = "0", mm = "0", ss = "0"] = match;
    return new Date(year, month - 1, day, hh, mm, ss);
  }

  return new Date(s);
}



function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
  const rows = lines.map(line => {
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
    return cells.map(c => c.trim());
  });
  return rows;
}


// Konversi format "04/11/2025 12:46:56" → "2025-11-04"
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
    const dateStr = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")} ${time || "00:00:00"}`;

    // Pastikan waktu tetap waktu lokal (hindari pergeseran UTC)
    const localDate = new Date(dateStr);
    if (isNaN(localDate)) return "";

    const offsetMs = localDate.getTimezoneOffset() * 60000;
    const localISO = new Date(localDate.getTime() - offsetMs).toISOString().split("T")[0];
    return localISO;
  } catch (err) {
    console.warn("⚠️ convertToISO gagal parse:", input, err);
    return "";
  }
}


const downloadPDF = async () => {
  const downloadButton = document.getElementById("download-btn");
  if (downloadButton) downloadButton.style.display = "none";

  const startDateInput = document.getElementById("start-date");
  const endDateInput = document.getElementById("end-date");
  const startDate = startDateInput?.value || "";
  const endDate = endDateInput?.value || "";
  

  let fileName = "Evaluasi_Harian_Capaian_Kinerja";
  if (startDate && endDate) {
    fileName += startDate === endDate
      ? `_${startDate}`
      : `_${startDate}_sampai_${endDate}`;
  } else if (startDate) {
    fileName += `_${startDate}`;
  } else if (endDate) {
    fileName += `_${endDate}`;
  } else {
    fileName += `_${new Date().toISOString().split("T")[0]}`;
  }

  const element = document.getElementById("dashboard-content");
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    scrollY: 0,
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF("p", "mm", "a4");

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(`${fileName}.pdf`);

  if (downloadButton) downloadButton.style.display = "inline-block";
};

export default function Dashboard() {
  const today = new Date().toISOString().split("T")[0];
  const [rawData, setRawData] = useState([]);
  const [summary, setSummary] = useState({ delay: 0, onSchedule: 0 });
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [selectedShift, setSelectedShift] = useState("");
  const [selectedTerminals, setSelectedTerminals] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showTerminalDropdown, setShowTerminalDropdown] = useState(false);
const formatNumber = (num) => {
    if (num == null || isNaN(num)) return "-";
    return Number.isInteger(num)
      ? num.toLocaleString()
      : num.toLocaleString(undefined, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 2,
        });
  };
  useEffect(() => {
  const fetchData = async () => {
    console.log("📡 Mulai ambil data dari Firestore dan Google Sheet...");

    try {
      // --- 1️⃣ Ambil dari Firestore ---
      const querySnapshot = await getDocs(collection(db, "laporan"));
      const firestoreData = querySnapshot.docs.map((doc) => {
        const d = doc.data();

        // Ambil tanggal dari Timestamp Firestore
        let tanggal = "";
        if (d.createdAt && d.createdAt.toDate) {
          const dateObj = d.createdAt.toDate();
          tanggal = dateObj.toLocaleDateString("en-CA");
        }

        const jumlahMuatan = toNumber(d.jumlahMuatan);
        const realisasiBongkarMuat = toNumber(d.realisasiBongkarMuat);
        const perencanaanShift = toNumber(d.perencanaanShift);
        const realisasiShift = toNumber(d.realisasiShift);

        const targetPerShift = perencanaanShift ? jumlahMuatan / perencanaanShift : 0;
        const totalTarget = targetPerShift * realisasiShift;
        const status = realisasiBongkarMuat >= totalTarget ? "ON SCHEDULE" : "DELAY";
        const balance = jumlahMuatan - realisasiBongkarMuat;

        return {
          sumber: "firestore",
          tanggal,
          terminal: d.terminal || "",
          shift: d.shift || "",
          namaKapal: d.namaKapal || "",
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
        };
      }).filter(r => r.namaKapal);

      console.log(`✅ Firestore: ${firestoreData.length} data diambil.`);

      // --- 2️⃣ Ambil dari Google Sheet ---
      const sheetUrl = "https://docs.google.com/spreadsheets/d/1NKzce5mlBRcIvHuI4UXzaOIStmWmx4Wzdu4pWzf-a78/gviz/tq?tqx=out:csv";
      const res = await fetch(sheetUrl);
      const text = await res.text();
      const rows = parseCSV(text);
      let sheetData = [];

      if (rows.length > 1) {
        sheetData = rows.slice(1).map(r => {
          const tanggal = convertToISO(r[0]);
          const timestamp = r[0];   
          const terminal = r[1] || "";
          const shift = r[3] || "";
          const namaKapal = r[4] || "";
          const remark = r[9] || "";
          const jumlahMuatan = toNumber(r[13]);
          const realisasiBongkar = toNumber(r[14]);
          const perencanaanShift = toNumber(r[15]);
          const realisasiShift = toNumber(r[16]);
          const etbetd = r[18] || "";

          const targetPerShift = perencanaanShift ? jumlahMuatan / perencanaanShift : 0;
          const totalTarget = targetPerShift * realisasiShift;
          const status = realisasiBongkar >= totalTarget ? "ON SCHEDULE" : "DELAY";
          const balance = jumlahMuatan - realisasiBongkar;

          return {
            sumber: "sheet",
            tanggal,
            timestamp,
            terminal,
            shift,
            namaKapal,
            realisasiTgh: r[7] || "",
            ketercapaian: r[8] || "",
            jumlahMuatan,
            realisasiBongkarMuat: realisasiBongkar,
            perencanaanShift,
            realisasiShift,
            balance,
            tambatan: r[17] || "",
            keterangan: remark,
            status,
            lampiran: r[10] ? [r[10]] : [],
            etbetd,
          };
        }).filter(r => r.namaKapal);
      }

      console.log(`✅ Google Sheet: ${sheetData.length} data diambil.`);

      // --- 3️⃣ Gabungkan kedua sumber data ---
      const combined = [...firestoreData, ...sheetData];
      console.log(`📊 Total data gabungan: ${combined.length}`);

      setRawData(combined);
      setSummary(summary);


    } catch (error) {
      console.error("❌ Gagal mengambil data:", error);
    }
  };

  fetchData();
}, []);


    const updateSummary = (list) => {
        const delay = list.filter(d => d.status === "DELAY").length;
        const onSchedule = list.filter(d => d.status === "ON SCHEDULE").length;
        setSummary({ delay, onSchedule });
    };

    const filteredData = useMemo(() => {
      let filtered = [...rawData];

      // Filter tanggal
      if (startDate && endDate) {
        filtered = filtered.filter(r => {
          const tgl = new Date(r.tanggal);
          return tgl >= new Date(startDate) && tgl <= new Date(endDate);
        });
      }

      // Filter shift
      if (selectedShift) filtered = filtered.filter(r => r.shift.includes(selectedShift));

      // Filter terminal
      if (selectedTerminals.length > 0) {
        filtered = filtered.filter(r => selectedTerminals.includes(r.terminal));
      }

      // Sort (kalau user klik header tabel)
      if (sortConfig.key) {
        const { key, direction } = sortConfig;
        filtered = filtered.sort((a, b) => {
          if (a[key] < b[key]) return direction === "asc" ? -1 : 1;
          if (a[key] > b[key]) return direction === "asc" ? 1 : -1;
          return 0;
        });
      }

      return filtered;
    }, [rawData, startDate, endDate, selectedShift, selectedTerminals, sortConfig]);

    useEffect(() => {
  console.log("🟩 RawData:", rawData.map(d => d.tanggal));
  console.log("🟦 startDate:", startDate, "endDate:", endDate);
  console.log("🟨 FilteredData:", filteredData.map(d => d.tanggal));
}, [rawData, filteredData, startDate, endDate]);


useEffect(() => {
  if (!filteredData || filteredData.length === 0) {
    setSummary({ delay: 0, onSchedule: 0 });
    return;
  }

  const updatedSummary = {
    delay: filteredData.filter(d => d.status === "DELAY").length,
    onSchedule: filteredData.filter(d => d.status === "ON SCHEDULE").length,
  };

  setSummary(updatedSummary);
}, [filteredData]);

    const handleSort = (key) => {
      let direction = "asc";
      if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
      setSortConfig({ key, direction });
    };

  const pieData = [
    { name: "ON SCHEDULE", value: summary.onSchedule },
    { name: "DELAY", value: summary.delay },
  ];

  const COLORS = ["#0BDA51", "#D62828"];

  return (
  
  <Container id="dashboard-content">
    <TopBar>
            <MenuButton onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <FaTimes /> : <FaBars />}
            </MenuButton>
          </TopBar>
    
          <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
    <Header>
      <h1>Evaluasi Harian Capaian Kinerja</h1>
      <h2>PNC Branch Jamrud Nilam Mirah</h2>
    </Header>

    <TopRow>
      <FilterGroup>
        <label>Dari:</label>
        <input
          id="start-date"                   // ⬅️ tambahkan ID
          type="date"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
        />

        <label>Sampai:</label>
        <input
          id="end-date"                     // ⬅️ tambahkan ID
          type="date"
          value={endDate}
          onChange={e => setEndDate(e.target.value)}
        />

        <label>Shift:</label>
        <select value={selectedShift} onChange={e => setSelectedShift(e.target.value)}>
          <option value="">Semua</option>
          <option value="I">Shift I</option>
          <option value="II">Shift II</option>
          <option value="III">Shift III</option>
        </select>

        <label>Terminal:</label>
<div style={{ position: "relative", display: "inline-block" }}>
  {/* Tombol utama dropdown */}
  <button
    type="button"
    onClick={() => setShowTerminalDropdown((prev) => !prev)}
    style={{
      width: "200px",
      padding: "8px",
      textAlign: "left",
      border: "1px solid #ccc",
      borderRadius: "6px",
      background: "#fff",
      cursor: "pointer",
    }}
  >
    {selectedTerminals.length > 0
      ? selectedTerminals.join(", ")
      : "Pilih Terminal"}
    <span style={{ float: "right" }}>▾</span>
  </button>

  {/* Dropdown daftar checkbox */}
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
        "Nilam Selatan",
        "Nilam Utara",
        "Mirah Selatan",
        "Mirah Timur",
        "Surabaya Veem"
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
                setSelectedTerminals([...selectedTerminals, terminal]);
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

      </FilterGroup>

      <StatBox color="#D62828">
        Delay
        <div>{summary.delay}</div>
      </StatBox>

      <StatBox color="#0BDA51">
        On Schedule
        <div>{summary.onSchedule}</div>
      </StatBox>
    </TopRow>

    {/* Bagian tabel dan chart di satu baris */}
    <Content>
      <LeftPanel>
        <StyledTable>
          <thead>
            <tr>
              {[
                { key: "tanggal", label: "Tanggal" },
                { key: "terminal", label: "Terminal" },
                { key: "shift", label: "Shift" },
                { key: "namaKapal", label: "Nama Kapal" },
                { key: "realisasiTgh", label: "Realisasi TGH" },
                { key: "ketercapaian", label: "Ketercapaian TGH" },
                { key: "jumlahMuatan", label: "Jumlah Bongkar/Muat Total" },
                { key: "realisasiBongkarMuat", label: "Realisasi Bongkar/Muat s.d Sekarang" },
                { key: "perencanaanShift", label: "Perencanaan Jumlah Shift" },
                { key: "realisasiShift", label: "Realisasi Jumlah Shift s.d Sekarang" },
                { key: "balance", label: "Balance" },
                { key: "status", label: "Status" },
              ].map(col => (
                <th key={col.key} onClick={() => handleSort(col.key)}>
                  {col.label} {sortConfig.key === col.key ? (sortConfig.direction === "asc" ? "▲" : "▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row, i) => (
              <tr key={i}>
                <td>{row.tanggal}</td>
                <td>{row.terminal}</td>
                <td>{row.shift}</td>
                <td>{row.namaKapal}</td>
                <td>{row.realisasiTgh}</td>
                <td>{row.ketercapaian}</td>
                <td>{formatNumber(row.jumlahMuatan)}</td>
                <td>{formatNumber(row.realisasiBongkarMuat)}</td>
                <td>{row.perencanaanShift}</td>
                <td>{row.realisasiShift}</td>
                <td>{row.balance ? row.balance.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "-"}</td>
                <StatusCell status={row.status}>{row.status}</StatusCell>
              </tr>
            ))}
          </tbody>
        </StyledTable>
      </LeftPanel>

      <RightPanel>
        <ChartTitle>Presentase Status Bongkar/Muat</ChartTitle>
        <ChartContainer>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              outerRadius={90}
              dataKey="value"
              label={({ name, percent, x, y, index }) => (
                <text
                  x={x}
                  y={y}
                  fill={COLORS[index % COLORS.length]} // 🎨 Warna sesuai slice
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={10} // 🔹 Ukuran tulisan di dalam pie
                >
                  {`${name} ${(percent * 100).toFixed(0)}%`}
                </text>
              )}
              labelLine={false}
            >
              {pieData.map((entry, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
              <Tooltip />
              <Legend
                wrapperStyle={{
                  fontSize: "10px",    // ✅ kecilkan ukuran font keterangan
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </RightPanel>
    </Content>

    {(
      selectedTerminals.length === 0 ||
      selectedTerminals.some(t =>
        t.startsWith("Jamrud") || t === "Surabaya Veem"
      )
    ) && (
      <QuayLayout
        data={filteredData.filter(
          d =>
            d.terminal.startsWith("Jamrud") ||
            d.terminal === "Surabaya Veem"
        )}
      />
    )}

    {(
      selectedTerminals.length === 0 ||
      selectedTerminals.some(t => t.startsWith("Nilam"))
    ) && <NilamLayout data={filteredData.filter(d => d.terminal.startsWith("Nilam"))} />}

    {(
      selectedTerminals.length === 0 ||
      selectedTerminals.some(t => t.startsWith("Mirah"))
    ) && <MirahLayout data={filteredData.filter(d => d.terminal.startsWith("Mirah"))} />}

    {/* 🔹 Tabel baru di bawah layout */}
    <div style={{ marginTop: "40px" }}>
      <Title>Keterangan</Title>
      <KeteranganTable>
        <thead>
          <tr>
            <th style={{ width: "18%" }}>Nama Kapal</th>
            <th style={{ width: "10%" }}>Status</th>
            <th style={{ width: "45%" }}>Keterangan</th>
            <th style={{ width: "27%" }}>Lampiran</th>
          </tr>
        </thead>
        <tbody>
          {filteredData.map((row, i) => (
            <tr key={i}>
              <td style={{ fontWeight: 500 }}>{row.namaKapal}</td>
              <StatusCell status={row.status}>{row.status}</StatusCell>
              <td>{row.keterangan || "-"}</td>

              {/* 🔹 Kolom gambar dari field "lampiran" */}
              <td>
                {row.lampiran ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center", // 🔹 gambar di tengah horizontal
                  alignItems: "center", }}>
                    {Array.isArray(row.lampiran)
                      ? row.lampiran.map((url, idx) => (
                          <a
                            key={idx}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <img
                              src={url}
                              alt={`lampiran-${idx}`}
                              style={{
                                width: "80px",
                                height: "80px",
                                objectFit: "cover",
                                borderRadius: "8px",
                                border: "1px solid #ddd",
                              }}
                            />
                          </a>
                        ))
                      : (
                        <a
                          href={row.lampiran}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <img
                            src={row.lampiran}
                            alt="lampiran"
                            style={{
                              width: "80px",
                              height: "80px",
                              objectFit: "cover",
                              borderRadius: "8px",
                              border: "1px solid #ddd",
                            }}
                          />
                        </a>
                      )}
                  </div>
                ) : (
                  <span style={{ color: "#888" }}>-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </KeteranganTable>
    </div>

    <div style={{ textAlign: "center", marginTop: "50px" }}>
    <button
      id="download-btn"
      onClick={downloadPDF}
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
      Download Laporan PDF
    </button>
  </div>
  </Container>
);
}

const QuayLayout = ({ data = [] }) => {
  const tambatan = [
    { id: 1, posisi: "top", nama: "N/A" },
    { id: 2, posisi: "top", nama: "N/A" },
    { id: 3, posisi: "top", nama: "N/A" },
    { id: 4, posisi: "top", nama: "N/A" },
    { id: 5, posisi: "left", nama: "N/A" },
    { id: 6, posisi: "bottom", nama: "N/A" },
    { id: 7, posisi: "bottom", nama: "N/A" },
    { id: 8, posisi: "bottom", nama: "N/A" },
    { id: 9, posisi: "bottom", nama: "N/A" },
    { id: 10, posisi: "bottom", nama: "N/A" },
    { id: 11, posisi: "right", nama: "N/A" },
  ];

const updatedTambatan = useMemo(() => {
  function parseCustomDate(d) {
    if (!d) return new Date(0);
    if (d instanceof Date) return d;

    // Coba gabungkan tanggal dan jam jika terpisah
    if (typeof d === "object") {
      const tanggal = d.tanggal || d.date || "";
      const jam = d.jam || d.time || "";
      return parseCustomDate(`${tanggal} ${jam}`);
    }

    // Normalisasi string
    const str = String(d).trim();

    // 🔹 ISO format (2025-11-13T15:49:16Z)
    if (/^\d{4}-\d{2}-\d{2}T\d{2}/.test(str)) return new Date(str);

    // 🔹 YYYY-MM-DD HH:mm:ss
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      const [datePart, timePart = "00:00:00"] = str.split(" ");
      const [y, m, d2] = datePart.split("-").map(Number);
      const [hh, mm, ss] = timePart.split(":").map(Number);
      return new Date(y, m - 1, d2, hh, mm, ss);
    }

    // 🔹 MM/DD/YYYY HH:mm:ss
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(str)) {
      const [datePart, timePart = "00:00:00"] = str.split(" ");
      const [month, day, year] = datePart.split("/").map(Number);
      const [hh, mm, ss] = timePart.split(":").map(Number);
      return new Date(year, month - 1, day, hh, mm, ss);
    }

    // 🔹 DD/MM/YYYY HH:mm:ss
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(str)) {
      const [datePart, timePart = "00:00:00"] = str.split(" ");
      const [day, month, year] = datePart.split("/").map(Number);
      const [hh, mm, ss] = timePart.split(":").map(Number);
      return new Date(year, month - 1, day, hh, mm, ss);
    }

    return new Date(0);
  }

  return tambatan.map((t) => {
    const matches = data.filter((d) => {
      const berth = (d.tambatan || "").toLowerCase();
      const terminal = (d.terminal || "").toLowerCase();

      const cocokTerminal =
      (
        terminal.includes("jamrud") &&
        (
          (terminal.includes("utara") && t.posisi === "top") ||
          (terminal.includes("selatan") && t.posisi === "bottom") ||
          (terminal.includes("barat") && t.posisi === "left")
        )
      )
      ||
      (
        terminal === "surabaya veem" &&
        t.posisi === "right"
      );


      const cocokTambatan = berth.includes(t.id.toString());
      return cocokTerminal && cocokTambatan;
    });

    if (matches.length > 0) {
      console.group(`🟦 Tambatan ${t.id} (${t.posisi})`);
      console.table(
        matches.map((m) => ({
          kapal: m.namaKapal,
          terminal: m.terminal,
          tambatan: m.tambatan,
          tanggal: m.tanggal,
          jam: m.jam,
          createdAt: m.createdAt,
          parsed: parseCustomDate(m.tanggal || m.createdAt),
        }))
      );
    }

    const latest = matches.reduce((latestSoFar, curr) => {
      if (!latestSoFar) return curr;

      const dateA = parseCustomDate(latestSoFar.timestamp || latestSoFar.tanggal);
      const dateB = parseCustomDate(curr.timestamp || curr.tanggal);

      return dateB > dateA ? curr : latestSoFar;
    }, null);

    if (latest) {
      console.log(`✅ Dipilih: ${latest.namaKapal} (${latest.tanggal})`);
      console.groupEnd();
    }

    return {
      ...t,
      nama: latest ? latest.namaKapal : "N/A",
      jumlahMuatan: latest ? latest.jumlahMuatan : null,
      perencanaanShift: latest ? latest.perencanaanShift : null,
      balance: latest ? latest.balance : null,
      status: latest ? latest.status : null,
      etbetd: latest ? latest.etbetd : null,
    };
  });
}, [data]);


  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <Title>Layout Tambatan Terminal Jamrud</Title>
      <QuayContainer>
        <DockWrapper>
          {/* Top Ships */}
          <ShipRow position="top">
            {updatedTambatan
              .filter((t) => t.posisi === "top")
              .map((t, index) => ( // ❌ hapus .slice().reverse()
                <ShipWrapper key={t.id}>
                  <Ship>
                    <ShipInfoOverlay status={t.status}>
                      <div><strong>{t.nama}</strong></div>
                      {t.etbetd && <div>ETB/ETD: {t.etbetd}</div>}
                      {t.jumlahMuatan && <div>Jumlah Muatan: {t.jumlahMuatan.toLocaleString()}</div>}
                      {t.perencanaanShift && <div>Jumlah Perencanaan Shift: {t.perencanaanShift}</div>}
                      {t.balance != null && <div>Balance: {t.balance.toLocaleString()}</div>}
                      {t.status && <div>Status: {t.status}</div>}
                    </ShipInfoOverlay>
                  </Ship>
                  <BerthLabelBelow>Berth {index + 1}</BerthLabelBelow>
                </ShipWrapper>
              ))}
          </ShipRow>


          {/* Dock */}
          <Dock>
            <DockLabel style={{ top: "105px", left: "50%", transform: "translateX(-50%)" }}>
              NORTH JAMRUD QUAY
            </DockLabel>
            <DockLabel style={{ bottom: "335px", left: "50%", transform: "translateX(-50%)" }}>
              SOUTH JAMRUD QUAY
            </DockLabel>
            <DockLabel style={{ top: "29%", left: "30px", transform: "translateY(-50%) rotate(-90deg)" }}>
              WEST JAMRUD QUAY
            </DockLabel>

            {/* Left Ships */}
            <ShipSide>
              {updatedTambatan
                .filter((t) => t.posisi === "left")
                .map((t, index) => (
                  <ShipWrapperLeft key={t.id}>
                    <ShipVertical>
                      <ShipInfoOverlay status={t.status}>
                        <div><strong>{t.nama}</strong></div>
                        {t.etbetd && <div>ETB/ETD: {t.etbetd}</div>}
                        {t.jumlahMuatan && <div>Jumlah Muatan: {t.jumlahMuatan.toLocaleString()}</div>}
                        {t.perencanaanShift && <div>Jumlah Perencanaan Shift: {t.perencanaanShift}</div>}
                        {t.balance != null && <div>Balance: {t.balance.toLocaleString()}</div>}
                        {t.status && <div>Status: {t.status}</div>}
                      </ShipInfoOverlay>
                    </ShipVertical>
                    <BerthLabelLeft>Berth {5 + index}</BerthLabelLeft>
                  </ShipWrapperLeft>
                ))}
            </ShipSide>
          </Dock>

          {/* Right Ship (vertical below bottom row) */}
          <div style={{ 
            position: "absolute",
            right: "115px",       // geser ke kanan
            bottom: "-85px",       // sedikit naik dari bawah dock
            display: "flex",
            flexDirection: "column",
            alignItems: "center"
          }}>
            {updatedTambatan
              .filter((t) => t.posisi === "right")
              .map((t, index) => (
                <ShipWrapperLeft key={t.id}>
                  <ShipVertical>
                    <ShipInfoOverlay status={t.status}>
                      <div><strong>{t.nama}</strong></div>
                      {t.etbetd && <div>ETB/ETD: {t.etbetd}</div>}
                      {t.jumlahMuatan && <div>Jumlah Muatan: {t.jumlahMuatan.toLocaleString()}</div>}
                      {t.perencanaanShift && <div>Jumlah Perencanaan Shift: {t.perencanaanShift}</div>}
                      {t.balance != null && <div>Balance: {t.balance.toLocaleString()}</div>}
                      {t.status && <div>Status: {t.status}</div>}
                    </ShipInfoOverlay>
                  </ShipVertical>

                  {/* ⬇️ Gunakan BerthLabelLeft seperti left-side ships */}
                  <BerthLabelLeft>
                    Berth {11 + index}
                  </BerthLabelLeft>
                </ShipWrapperLeft>
              ))}
          </div>

          {/* Bottom Ships */}
          <ShipRow position="bottom">
            {updatedTambatan
              .filter((t) => t.posisi === "bottom")
              .map((t, index) => (
                <ShipWrapper key={t.id}>
                  <BerthLabelAbove>Berth {6 + index}</BerthLabelAbove>
                  <Ship>
                    <ShipInfoOverlay status={t.status}>
                      <div><strong>{t.nama}</strong></div>
                      {t.etbetd && <div>ETB/ETD: {t.etbetd}</div>}
                      {t.jumlahMuatan && <div>Jumlah Muatan: {t.jumlahMuatan.toLocaleString()}</div>}
                      {t.perencanaanShift && <div>Jumlah Perencanaan Shift: {t.perencanaanShift}</div>}
                      {t.balance != null && <div>Balance: {t.balance.toLocaleString()}</div>}
                      {t.status && <div>Status: {t.status}</div>}
                    </ShipInfoOverlay>
                  </Ship>
                </ShipWrapper>
              ))}
          </ShipRow>
        </DockWrapper>
      </QuayContainer>
    </div>
  );
};

/* ==========================================================
   🔹 Layout Terminal Nilam (versi baru)
   ========================================================== */
const NilamLayout = ({ data = [], selectedTerminals = [] }) => {
  const tambatanNilam = [
    { id: 1, nama: "N/A" },
    { id: 2, nama: "N/A" },
    { id: 3, nama: "N/A" },
    { id: 4, nama: "N/A" },
    { id: 5, nama: "N/A" },
    { id: 6, nama: "N/A" },
  ];

  // 🧠 Tentukan sisi mana yang perlu ditampilkan
  const showSelatan =
    selectedTerminals.length === 0 ||
    selectedTerminals.some(t => t.toLowerCase().includes("nilam selatan")) ||
    selectedTerminals.some(t => t.toLowerCase() === "nilam");

  const showUtara =
    selectedTerminals.length === 0 ||
    selectedTerminals.some(t => t.toLowerCase().includes("nilam utara")) ||
    selectedTerminals.some(t => t.toLowerCase() === "nilam");

  const updatedTambatan = useMemo(() => {
    return tambatanNilam.map((t) => {
      const match = data.find((d) => {
        const berth = (d.tambatan || "").trim().toLowerCase();
        const terminal = (d.terminal || "").toLowerCase();

        return terminal.includes("nilam") && berth.includes(t.id.toString());
      });

      return {
        ...t,
        nama: match ? match.namaKapal : "N/A",
        jumlahMuatan: match ? match.jumlahMuatan : null,
        perencanaanShift: match ? match.perencanaanShift : null,
        balance: match ? match.balance : null,
        status: match ? match.status : null,
      };
    });
  }, [data]);

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <Title>Layout Tambatan Terminal Nilam</Title>

      <NilamContainer>
        <DockWrapperNilam>
          <ShipRowNilam>
            {/* 🔹 Grup kiri: Nilam Selatan (Berth 1–3) */}
            {showSelatan &&
              updatedTambatan.slice(0, 3).map((t) => (
                <ShipWrapper key={t.id}>
                  <ShipNilam>
                    <ShipInfoOverlayNilam status={t.status}>
                      <div><strong>{t.nama}</strong></div>
                      {t.etbetd && <div>ETB/ETD: {t.etbetd}</div>}
                      {t.jumlahMuatan && <div>Jumlah Muatan: {t.jumlahMuatan.toLocaleString()}</div>}
                      {t.perencanaanShift && <div>Jumlah Perencanaan Shift: {t.perencanaanShift}</div>}
                      {t.balance != null && <div>Balance: {t.balance.toLocaleString()}</div>}
                      {t.status && <div>Status: {t.status}</div>}
                    </ShipInfoOverlayNilam>
                  </ShipNilam>
                  <BerthLabelNilam>Berth {t.id}</BerthLabelNilam>
                </ShipWrapper>
              ))}

            {/* Spacer antara dua sisi */}
            <div style={{ width: "120px" }}></div>

            {/* 🔹 Grup kanan: Nilam Utara (Berth 4–6) */}
            {showUtara &&
              updatedTambatan.slice(3, 6).map((t) => (
                <ShipWrapper key={t.id}>
                  <ShipNilam>
                    <ShipInfoOverlayNilam status={t.status}>
                      <div><strong>{t.nama}</strong></div>
                      {t.etbetd && <div>ETB/ETD: {t.etbetd}</div>}
                      {t.jumlahMuatan && <div>Jumlah Muatan: {t.jumlahMuatan.toLocaleString()}</div>}
                      {t.perencanaanShift && <div>Jumlah Perencanaan Shift: {t.perencanaanShift}</div>}
                      {t.balance != null && <div>Balance: {t.balance.toLocaleString()}</div>}
                      {t.status && <div>Status: {t.status}</div>}
                    </ShipInfoOverlayNilam>
                  </ShipNilam>
                  <BerthLabelNilam>Berth {t.id}</BerthLabelNilam>
                </ShipWrapper>
              ))}
          </ShipRowNilam>

          {/* 🔹 Dock Label */}
          <DockNilam>
            {showSelatan && (
              <DockLabel style={{ bottom: "10px", left: "25%", transform: "translateX(-50%)" }}>
                NILAM SISI SELATAN
              </DockLabel>
            )}
            {showUtara && (
              <DockLabel style={{ bottom: "10px", left: "75%", transform: "translateX(-50%)" }}>
                NILAM SISI UTARA
              </DockLabel>
            )}
          </DockNilam>
        </DockWrapperNilam>
      </NilamContainer>
    </div>
  );
};


/* ==========================================================
   🔹 Layout Terminal Mirah
   ========================================================== */
const MirahLayout = ({ data = [], selectedTerminals = [] }) => {
  const tambatanMirah = [
    { id: 1, posisi: "bottom", nama: "N/A" },
    { id: 2, posisi: "bottom", nama: "N/A" },
    { id: 3, posisi: "bottom", nama: "N/A" },
    { id: 4, posisi: "right", nama: "N/A" },
    { id: 5, posisi: "right", nama: "N/A" },
    { id: 6, posisi: "right", nama: "N/A" },
  ];

  // 🧭 Tentukan sisi mana yang tampil
  const showSelatan =
    selectedTerminals.length === 0 ||
    selectedTerminals.some((t) => t.toLowerCase().includes("mirah selatan")) ||
    selectedTerminals.some((t) => t.toLowerCase() === "mirah");

  const showTimur =
    selectedTerminals.length === 0 ||
    selectedTerminals.some((t) => t.toLowerCase().includes("mirah timur")) ||
    selectedTerminals.some((t) => t.toLowerCase() === "mirah");

  // 🧩 Mapping data kapal dari Firestore
  const updatedTambatan = useMemo(() => {
    return tambatanMirah.map((t) => {
      const match = data.find((d) => {
        const berth = (d.tambatan || "").trim().toLowerCase();
        const terminal = (d.terminal || "").toLowerCase();
        return terminal.includes("mirah") && berth.includes(t.id.toString());
      });

      return {
        ...t,
        nama: match ? match.namaKapal : "N/A",
        jumlahMuatan: match ? match.jumlahMuatan : null,
        perencanaanShift: match ? match.perencanaanShift : null,
        balance: match ? match.balance : null,
        status: match ? match.status : null,
      };
    });
  }, [data]);

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <Title>Layout Tambatan Terminal Mirah</Title>

      <MirahContainer>
        <DockWrapperMirah>
          {/* 🔹 Kapal bawah (Mirah Selatan: berth 1–3) */}
          {showSelatan && (
            <ShipRowMirah>
              {updatedTambatan
                .filter((t) => t.posisi === "bottom")
                .map((t) => (
                  <ShipWrapperMirah key={t.id}>
                    <BerthLabelMirah>Berth {t.id}</BerthLabelMirah>
                    <ShipMirah>
                      <ShipInfoOverlayMirah status={t.status}>
                        <div><strong>{t.nama}</strong></div>
                        {t.etbetd && <div>ETB/ETD: {t.etbetd}</div>}
                        {t.jumlahMuatan && <div>Jumlah Muatan: {t.jumlahMuatan.toLocaleString()}</div>}
                        {t.perencanaanShift && <div>Perencanaan Shift: {t.perencanaanShift}</div>}
                        {t.balance != null && <div>Balance: {t.balance.toLocaleString()}</div>}
                        {t.status && <div>Status: {t.status}</div>}
                      </ShipInfoOverlayMirah>
                    </ShipMirah>
                  </ShipWrapperMirah>
                ))}
            </ShipRowMirah>
          )}

          {/* 🔹 Dock Gambar */}
          <DockMirah>
            {/* Label bawah */}
            {showSelatan && (
              <DockLabel
                style={{
                  bottom: "-10px",
                  left: "50%",
                  transform: "translateX(-50%)",
                }}
              >
                MIRAH SELATAN
              </DockLabel>
            )}

            {/* Label kanan */}
            {showTimur && (
              <DockLabel
                style={{
                  right: "120px",
                  top: "50%",
                  transform: "translateY(-50%) rotate(90deg)",
                  transformOrigin: "center",
                }}
              >
                MIRAH TIMUR
              </DockLabel>
            )}

            {/* 🔹 Kapal vertikal kanan (Mirah Timur: berth 4–6) */}
            {showTimur && (
              <ShipSideMirah>
                {[...updatedTambatan.filter((t) => t.posisi === "right")]
                  .reverse()
                  .map((t) => (
                    <ShipWrapperLeftMirah key={t.id}>
                      <ShipVerticalMirah>
                        <ShipInfoOverlayMirah status={t.status}>
                          <div><strong>{t.nama}</strong></div>
                          {t.etbetd && <div>ETB/ETD: {t.etbetd}</div>}
                          {t.jumlahMuatan && <div>Jumlah Muatan: {t.jumlahMuatan.toLocaleString()}</div>}
                          {t.perencanaanShift && <div>Perencanaan Shift: {t.perencanaanShift}</div>}
                          {t.balance != null && <div>Balance: {t.balance.toLocaleString()}</div>}
                          {t.status && <div>Status: {t.status}</div>}
                        </ShipInfoOverlayMirah>
                      </ShipVerticalMirah>
                      <BerthLabelVerticalMirah>Berth {t.id}</BerthLabelVerticalMirah>
                    </ShipWrapperLeftMirah>
                  ))}
              </ShipSideMirah>
            )}
          </DockMirah>
        </DockWrapperMirah>
      </MirahContainer>
    </div>
  );
};

/* Styled Components */
const Container = styled.div`
  background-color: #f5f7fa;
  flex: 1;
  min-height: 100vh;
  padding: 40px;
  font-family: "Segoe UI", Roboto, sans-serif;
  overflow-y: auto;
`;

const TopRow = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 25px;
`;

const FilterGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  label {
    font-weight: 600;
    color: #002b5b;
  }
  input, select {
    padding: 6px 10px;
    border: 1px solid #ccc;
    border-radius: 6px;
    font-size: 13px;
  }
`;
const StatBox = styled.div`
  background-color: ${({ color }) => color}20;
  border-left: 5px solid ${({ color }) => color};
  border-radius: 8px;
  padding: 8px 10px;
  color: ${({ color }) => color};
  font-weight: 600;
  min-width: 120px; /* sebelumnya 160px */
  text-align: center;

  div {
    font-size: 16px; /* sebelumnya 18px */
    font-weight: 700;
  }
`;


const Content = styled.div`
  display: flex;
  gap: 30px;
`;

const LeftPanel = styled.div`
  flex: 2;
  background-color: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0, 43, 91, 0.15);
`;

const RightPanel = styled.div`
  flex: 1;
  background-color: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0, 43, 91, 0.15);
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const ChartTitle = styled.h2`
  color: #002b5b;
  margin-bottom: 12px;
  text-align: center;
  font-size: 16px;
  font-weight: 600;
`;

const ChartContainer = styled.div`
  width: 100%;
  height: 300px;
`;

const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  color: #1a1a1a;
  border: 1px solid #ccc;
  font-size: 11.5px; /* 🔹 lebih kecil dari 13px */

  th, td {
    border: 1px solid #ccc;
    padding: 4px 6px; /* 🔹 sedikit lebih rapat */
    text-align: center;
    cursor: pointer;
  }

  thead {
    background-color: #002b5b;
    color: white;
    font-size: 12px; /* 🔹 tetap sedikit lebih besar untuk header */
  }

  tbody tr:nth-child(even) {
    background-color: #f0f4f8;
  }

  tbody tr:hover {
    background-color: #e5eef7;
  }
`;


/* ✅ Tabel khusus untuk bagian "Keterangan" di bawah layout */
const KeteranganTable = styled(StyledTable)`
  table-layout: fixed;

  th:nth-child(1),
  td:nth-child(1) {
    width: 25%;
  }

  th:nth-child(2),
  td:nth-child(2) {
    width: 25%;
  }

  th:nth-child(3),
  td:nth-child(3) {
    width: 50%;
    white-space: normal;     /* biar teks panjang bisa turun ke bawah */
    word-wrap: break-word;
  }
`;

const StatusCell = styled.td`
  font-weight: 600;
  color: ${({ status }) => (status === "ON SCHEDULE" ? "#0BDA51" : "#D62828")};
  background-color: ${({ status }) =>
    status === "ON SCHEDULE" ? "rgba(11,218,81,0.1)" : "rgba(214,40,40,0.1)"};
  border-radius: 6px;
`;

const QuayContainer = styled.div`
  margin-top: 50px;
  padding: 30px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0, 43, 91, 0.15);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;

  min-height: 500px; /* ⬅️ tambahkan ini */
`;


const DockWrapper = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const ShipRow = styled.div`
  display: flex;
  justify-content: center;
  gap: 30px;

  margin: ${({ position }) => {
    if (position === "top") return "0 0 -130px 0";   // ⭐ tetap seperti aslinya
    if (position === "bottom") return "-315px 0 0 0"; // ⭐ styling khusus bottom
    return "0";
  }};

  flex-direction: ${({ position }) =>
    position === "top" ? "row-reverse" : "row"};
`;

const Ship = styled.div`
  width: 120px;
  height: 95px;
  background-image: url("/images/kapal-side.png");
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #ffffff; /* 🔹 font putih */
  font-weight: 600;
  font-size: 9px; /* 🔹 lebih kecil agar seimbang dengan ShipVertical */
  text-shadow: 0 0 2px rgba(0, 43, 91, 0.6); /* 🔹 sedikit glow biru halus */
  cursor: pointer;
  transition: transform 0.2s ease;

  &:hover {
    transform: scale(1.05);
  }
`;

const ShipSide = styled.div`
  position: absolute;
  left: -155px; /* 🔹 dari -130 ke -45 biar lebih dekat */
  top: 30%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 25px; /* 🔹 boleh juga sedikit dikurangi kalau mau rapat */
`;

const ShipVertical = styled.div`
  width: 120px;
  height: 95px;
  background-image: url("/images/kapal-side.png");
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  transform: rotate(90deg);
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #ffffff; /* 🔹 font putih */
  font-weight: 600;
  font-size: 9px; /* 🔹 lebih kecil */
  text-shadow: 0 0 2px rgba(0, 43, 91, 0.6); /* 🔹 tambahan bayangan lembut */
  cursor: pointer;
  transition: transform 0.2s ease;

  &:hover {
    transform: rotate(90deg) scale(1.05);
  }
`;

const Dock = styled.div`
  width: 900px;
  height: 550px;
  position: relative;
  margin: 40px 0;
  border: none;
  box-shadow: none;
  background: none; /* ❌ hilangkan semua background */

  /* Tambahkan gambar kecil di tengah */
  &::before {
    content: "";
    position: absolute;
    top: 53%;
    left: 50%;
    width: 100%;            /* 🔹 atur ukuran gambar lebih kecil */
    height: 90%;
    background-image: url("/images/jamrud-quay.png");
    background-size: contain;  /* gambar tetap proporsional */
    background-repeat: no-repeat;
    background-position: center;
    transform: translate(-50%, -50%);
    opacity: 0.9;           /* sedikit transparan biar halus */
  }
`;

const DockLabel = styled.div`
  position: absolute;
  color: #002b5b; /* 🔹 biru navy */
  font-size: 11px; /* 🔹 kecilkan font */
  font-weight: 600;
  background: rgba(255, 255, 255, 0.6); /* 🔹 opsional: sedikit transparan agar tetap terbaca di atas gambar */
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
`;

const Title = styled.h3`
  color: #002b5b;
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 10px;
`;

const DockBody = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(0, 43, 91, 0.7);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
`;

const LabelTop = styled.div`
  position: absolute;
  top: 8px;
  width: 100%;
  text-align: center;
  color: white;
  font-weight: 600;
  font-size: 13px;
`;

const LabelLeft = styled.div`
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%) rotate(-90deg); /* 🔹 Sudah pas di tengah vertikal */
  transform-origin: center;
  color: white;
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
`;

const LabelBottom = styled.div`
  position: absolute;
  bottom: 8px;
  width: 100%;
  text-align: center;
  color: white;
  font-weight: 600;
  font-size: 13px;
`;

const ShipWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const BerthLabelBelow = styled.div`
  font-size: 13px;
  color: #002b5b;
  font-weight: 600;
  position: relative;
  top: -20px; /* ⬇️ geser label ke bawah sejauh 20px */
`;

const BerthLabelLeft = styled.div`
  font-size: 13px;
  color: #002b5b;
  font-weight: 600;
  position: absolute;
  left: 140px; /* geser mendekati kapal */
  top: 50%;
  transform: translateY(-50%) rotate(90deg);
  transform-origin: center;
  white-space: nowrap;
`;

// 🔹 Label untuk kapal bawah (di atas kapal)
const BerthLabelAbove = styled.div`
  font-size: 13px;
  color: #002b5b;
  font-weight: 600;
  position: relative;
  top: -30px; /* ⬅️ geser label ke atas sejauh 20px */
`;

const ShipWrapperLeft = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end; /* arahkan label ke kanan */
  gap: 10px; /* jarak antara kapal dan label */
`;

const ShipInfoOverlay = styled.div`
  position: absolute;
  top: -20px;
  left: 0;
  width: 100%;
  text-align: center;
  color: #ffffff;
  font-size: 8px; /* 🔹 ukuran default untuk teks lain */
  line-height: 1.4;
  font-weight: 600;
  text-shadow: 0 0 3px rgba(0, 43, 91, 0.8);
  background: ${({ status }) =>
    status === "ON SCHEDULE"
      ? "rgba(34, 195, 88, 0.62)"   /* ✅ hijau transparan */
      : status === "DELAY"
      ? "rgba(212, 23, 23, 0.52)"   /* ❌ merah transparan */
      : "rgba(0, 43, 91, 0.25)"};   /* 🔹 default abu kebiruan */
  padding: 4px 0;
  border-radius: 6px 6px 0 0;
  transition: background 0.3s ease;

  /* 🔹 Hanya nama kapal (elemen <strong>) yang diperbesar dan diberi outline */
  strong {
    display: block;
    font-size: 8.5px; /* ⬆️ diperbesar dari 9px → 13px */
    font-weight: 800;
    text-shadow:
      -1px -1px 0 #001f3f,
       1px -1px 0 #001f3f,
      -1px  1px 0 #001f3f,
       1px  1px 0 #001f3f; /* 🔹 outline biru navy */
    margin-bottom: 2px;
  }
`;

const Header = styled.div`
  background-color: #002b5b; /* 🔹 biru navy */
  color: #ffffff;
  text-align: center;
  padding: 20px 0 25px 0;
  border-radius: 10px;
  margin-top: 30px;
  margin-bottom: 30px;
  box-shadow: 0 4px 10px rgba(0, 43, 91, 0.3);

  h1 {
    font-size: 27px;
    font-weight: 700;
    margin: 0;
    letter-spacing: 0.5px;
  }

  h2 {
    font-size: 18px;
    font-weight: 500;
    margin: 4px 0 0 0;
    opacity: 0.9;
  }
`;

/* 🔹 Layout Nilam (dock horizontal) */
const NilamContainer = styled.div`
  margin-top: 50px;
  padding: 30px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0, 43, 91, 0.15);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const DockWrapperNilam = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const ShipRowNilam = styled.div`
  display: flex;
  justify-content: center;
  align-items: flex-start;
  gap: 30px;
  margin-top: 25px;
  margin-bottom: -20px;
`;

const ShipNilam = styled.div`
  width: 115px;
  height: 80px;
  background-image: url("/images/kapal-side.png");
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #ffffff;
  font-weight: 600;
  font-size: 9px;
  text-shadow: 0 0 2px rgba(0, 43, 91, 0.6);
  cursor: pointer;
  transition: transform 0.2s ease;

  &:hover {
    transform: scale(1.05);
  }
`;

const DockNilam = styled.div`
  width: 1000px;
  height: 100px;
  background-image: url("/images/nilam-quay.png");
  background-size: contain;  /* supaya gambar tidak terpotong */
  background-position: center;
  background-repeat: no-repeat;
  position: relative;
  margin-top: 10px;
  border-radius: 10px;
`;

const BerthLabelNilam = styled.div`
  font-size: 13px;
  color: #002b5b;
  font-weight: 600;
  margin-top: 6px;
`;

const ShipInfoOverlayNilam = styled.div`
  position: absolute;
  top: -30px;
  left: 0;
  width: 100%;
  text-align: center;
  color: #ffffff;
  font-size: 8px; /* 🔹 ukuran default untuk teks lain */
  line-height: 1.4;
  font-weight: 600;
  text-shadow: 0 0 3px rgba(0, 43, 91, 0.8);
  background: ${({ status }) =>
    status === "ON SCHEDULE"
      ? "rgba(34, 195, 88, 0.62)"   /* ✅ hijau transparan */
      : status === "DELAY"
      ? "rgba(212, 23, 23, 0.52)"   /* ❌ merah transparan */
      : "rgba(0, 43, 91, 0.25)"};   /* 🔹 default abu kebiruan */
  padding: 4px 0;
  border-radius: 6px 6px 0 0;
  transition: background 0.3s ease;

  /* 🔹 Hanya nama kapal (elemen <strong>) yang diperbesar dan diberi outline */
  strong {
    display: block;
    font-size: 10px; /* ⬆️ diperbesar dari 9px → 13px */
    font-weight: 800;
    text-shadow:
      -1px -1px 0 #001f3f,
       1px -1px 0 #001f3f,
      -1px  1px 0 #001f3f,
       1px  1px 0 #001f3f; /* 🔹 outline biru navy */
    margin-bottom: 2px;
  }
`;

/* ==========================================================
   🔹 Layout Terminal Mirah
   ========================================================== */
const MirahContainer = styled.div`
  margin-top: 50px;
  padding: 30px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0, 43, 91, 0.15);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
`;

const DockWrapperMirah = styled.div`
  position: relative;
  width: 1100px;
  height: 520px;
  /* overflow: hidden; ❌ jangan hidden, agar label bawah tidak terpotong */
  display: flex;
  justify-content: center;
  align-items: center;
`;

const DockMirah = styled.div`
  width: 1000px;
  height: 500px;
  background-image: url("/images/mirah-quay.png");
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
  border-radius: 10px;
  position: absolute;
  top: 0;
  left: 60px;        /* ⬅️ Tambahkan offset ke kanan */
  margin: 0 auto;
  opacity: 0.95;
`;

/* 🔹 3 kapal horizontal di bagian bawah dock */
const ShipRowMirah = styled.div`
  position: absolute;
  bottom: 100px;
  left: 46%;         /* ⬅️ Dari 50% → 46% untuk geser kiri */
  transform: translateX(-50%);
  display: flex;
  justify-content: center;
  gap: 35px;
`;

/* 🔹 3 kapal vertikal di sisi kanan dock */
const ShipSideMirah = styled.div`
  position: absolute;
  right: 270px; /* ⬅️ dari 70px → 120px agar lebih ke kiri */
  top: 44%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 50px;
`;

/* 🔹 Kapal horizontal */
const ShipMirah = styled.div`
  width: 110px;
  height: 90px;
  background-image: url("/images/kapal-side.png");
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #ffffff;
  font-weight: 600;
  font-size: 9px;
  text-shadow: 0 0 2px rgba(0, 43, 91, 0.6);
  cursor: pointer;
  transition: transform 0.2s ease;

  &:hover {
    transform: scale(1.05);
  }
`;

/* 🔹 Kapal vertikal */
const ShipVerticalMirah = styled.div`
  width: 105px;
  height: 70px;
  background-image: url("/images/kapal-side.png");
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  transform: rotate(90deg);
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #ffffff;
  font-weight: 600;
  font-size: 9px;
  text-shadow: 0 0 2px rgba(0, 43, 91, 0.6);
  cursor: pointer;
  transition: transform 0.2s ease;

  &:hover {
    transform: rotate(90deg) scale(1.05);
  }
`;

const ShipInfoOverlayMirah = styled.div`
  position: absolute;
  top: -22px;
  left: 0;
  width: 100%;
  text-align: center;
  color: #ffffff;
  font-size: 8px;
  line-height: 1.4;
  font-weight: 600;
  text-shadow: 0 0 3px rgba(0, 43, 91, 0.8);
  background: ${({ status }) =>
    status === "ON SCHEDULE"
      ? "rgba(34, 195, 88, 0.62)"   /* ✅ hijau */
      : status === "DELAY"
      ? "rgba(212, 23, 23, 0.52)"   /* ❌ merah */
      : "rgba(0, 43, 91, 0.25)"};   /* 🔹 abu kebiruan */
  padding: 4px 0;
  border-radius: 6px 6px 0 0;

  strong {
    display: block;
    font-size: 10px;
    font-weight: 800;
    text-shadow:
      -1px -1px 0 #001f3f,
       1px -1px 0 #001f3f,
      -1px  1px 0 #001f3f,
       1px  1px 0 #001f3f;
    margin-bottom: 2px;
  }
`;

const BerthLabelMirah = styled.div`
  position: absolute;
  bottom: -25px;      /* ⬇️ Turunkan label lebih jauh dari kapal */
  left: 50%;
  transform: translateX(-50%);
  font-size: 13px;
  color: #002b5b;
  font-weight: 600;
  text-align: center;
  z-index: 5;         /* ✅ Pastikan label di atas dock dan kapal */
`;

const BerthLabelVerticalMirah = styled.div`
  position: absolute;
  left: 110px;         /* ⬅️ Geser lebih jauh ke kiri */
  top: 50%;
  transform: translateY(-50%) rotate(90deg);
  transform-origin: center;
  font-size: 13px;
  color: #002b5b;
  font-weight: 600;
  white-space: nowrap;
  text-align: center;
  z-index: 5;          /* ✅ Supaya tidak tertutup dock */
`;

const ShipWrapperMirah = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
`;

const ShipWrapperLeftMirah = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  margin-left: -40px; /* ⬅️ geser sedikit ke kiri agar kapal vertikal lebih menempel ke dock */
`;

const TopBar = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background-color: #002b5b;
  color: white;
  height: 60px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  box-shadow: 0 4px 10px rgba(0, 43, 91, 0.3);
  z-index: 10;

  h1 {
    font-size: 18px;
    font-weight: 600;
    margin-left: 15px;
  }
`;

const MenuButton = styled.button`
  background: none;
  border: none;
  color: white;
  font-size: 22px;
  cursor: pointer;
`;
