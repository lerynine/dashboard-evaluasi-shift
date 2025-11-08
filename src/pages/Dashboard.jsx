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

function toNumber(v) {
  if (!v) return 0;
  const cleaned = String(v).trim().replace(/\./g, "").replace(/,/g, ".").replace(/[^\d.-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// Konversi format "04/11/2025 12:46:56" → "2025-11-04"
function convertToISO(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split(" ")[0]?.split("/");
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return "";
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

  // Tambahkan halaman pertama
  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  // Tambahkan halaman berikutnya jika tinggi melebihi 1 halaman
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
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({ delay: 0, onSchedule: 0 });
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [selectedShift, setSelectedShift] = useState("");
  const [selectedTerminals, setSelectedTerminals] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showTerminalDropdown, setShowTerminalDropdown] = useState(false);

  useEffect(() => {
  const fetchData = async () => {
    console.log("📡 Mulai ambil data dari Firestore...");

    try {
      const querySnapshot = await getDocs(collection(db, "laporan"));
      console.log(`✅ Jumlah dokumen ditemukan: ${querySnapshot.size}`);

      const docs = querySnapshot.docs.map((doc) => {
  const d = doc.data();
  console.log(`📄 Dokumen ID: ${doc.id}`, d);

  // ✅ Gunakan tanggal dari Firestore Timestamp
  let tanggal = "";
    if (d.createdAt && d.createdAt.toDate) {
      const t = d.createdAt.toDate();
      tanggal = t.toLocaleDateString("en-CA"); // hasil: "2023-11-26"
    }

  const terminal = d.terminal || "";
  const shift = d.shift || "";
  const namaKapal = d.namaKapal || "";
  const realisasiTgh = d.realisasiTgh || "";
  const ketercapaian = d.ketercapaian || "";
  const jumlahMuatan = toNumber(d.jumlahMuatan);
  const realisasiBongkarMuat = toNumber(d.realisasiBongkarMuat);
  const perencanaanShift = toNumber(d.perencanaanShift);
  const realisasiShift = toNumber(d.realisasiShift);
  const tambatan = d.tambatan || "";
  const remark = d.remark || d.keterangan || "";
  const targetPerShift = perencanaanShift ? jumlahMuatan / perencanaanShift : 0;
  const totalTarget = targetPerShift * realisasiShift;
  const status = realisasiBongkarMuat >= totalTarget ? "ON SCHEDULE" : "DELAY";
  const balance = jumlahMuatan - realisasiBongkarMuat;
  const lampiran = d.lampiran || [];

  return {
    tanggal,
    terminal,
    shift,
    namaKapal,
    realisasiTgh,
    ketercapaian,
    jumlahMuatan,
    realisasiBongkarMuat,
    perencanaanShift,
    realisasiShift,
    balance,
    tambatan,
    status,
    keterangan: remark,
    lampiran,
  };
});

      const parsed = docs.filter((r) => r.namaKapal);
      console.log("📊 Data hasil parsing:", parsed);

      setRawData(parsed);
      console.log("✅ rawData diset:", parsed.length, "item");

      setData(parsed);
      updateSummary(parsed);
      
    } catch (error) {
      console.error("❌ Gagal mengambil data Firestore:", error);
    }
  };

  fetchData();
}, []);


    const updateSummary = (list) => {
        const delay = list.filter(d => d.status === "DELAY").length;
        const onSchedule = list.filter(d => d.status === "ON SCHEDULE").length;
        setSummary({ delay, onSchedule });
    };

    useEffect(() => {
      let filtered = [...rawData];

      // ✅ Filter berdasarkan rentang tanggal
      if (startDate && endDate) {
        filtered = filtered.filter(r => {
          const tgl = new Date(r.tanggal);
          return tgl >= new Date(startDate) && tgl <= new Date(endDate);
        });
      }

      if (selectedShift) filtered = filtered.filter(r => r.shift.includes(selectedShift));
      if (selectedTerminals.length > 0) {
        filtered = filtered.filter((r) =>
          selectedTerminals.includes(r.terminal)
        );
      }


      updateSummary(filtered);
      setData(filtered);
    }, [startDate, endDate, selectedShift, selectedTerminals, rawData]);


    const handleSort = (key) => {
        let direction = "asc";
        if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
        setSortConfig({ key, direction });

        const sorted = [...data].sort((a, b) => {
        if (a[key] < b[key]) return direction === "asc" ? -1 : 1;
        if (a[key] > b[key]) return direction === "asc" ? 1 : -1;
        return 0;
        });
        setData(sorted);
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
            {data.map((row, i) => (
              <tr key={i}>
                <td>{row.tanggal}</td>
                <td>{row.terminal}</td>
                <td>{row.shift}</td>
                <td>{row.namaKapal}</td>
                <td>{row.realisasiTgh}</td>
                <td>{row.ketercapaian}</td>
                <td>{row.jumlahMuatan}</td>
                <td>{row.realisasiBongkarMuat}</td>
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
      selectedTerminals.some(t => t.startsWith("Jamrud"))
    ) && <QuayLayout data={data.filter(d => d.terminal.startsWith("Jamrud"))} />}

    {(
      selectedTerminals.length === 0 ||
      selectedTerminals.some(t => t.startsWith("Nilam"))
    ) && <NilamLayout data={data.filter(d => d.terminal.startsWith("Nilam"))} />}

    {(
      selectedTerminals.length === 0 ||
      selectedTerminals.some(t => t.startsWith("Mirah"))
    ) && <MirahLayout data={data.filter(d => d.terminal.startsWith("Mirah"))} />}

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
          {data.map((row, i) => (
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
  ];

  const updatedTambatan = useMemo(() => {
    return tambatan.map((t) => {
      const match = data.find((d) => {
        const berth = (d.tambatan || "").trim().toLowerCase();
        const terminal = (d.terminal || "").toLowerCase();

        const cocokTerminal =
          terminal.includes("jamrud") &&
          (
            (terminal.includes("utara") && t.posisi === "top") ||
            (terminal.includes("selatan") && t.posisi === "bottom") ||
            (terminal.includes("barat") && t.posisi === "left")
          );

        // 🔹 Logika tambatan
        const cocokTambatan = berth.includes(t.id.toString());

        const cocok = cocokTerminal && cocokTambatan;

        if (cocok) {
          console.log(`✅ ${d.namaKapal} cocok dengan t.id=${t.id}, terminal=${terminal}, posisi=${t.posisi}`);
        }

        return cocok;
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
            <DockLabel style={{ top: "75px", left: "50%", transform: "translateX(-50%)" }}>
              NORTH JAMRUD QUAY
            </DockLabel>
            <DockLabel style={{ bottom: "75px", left: "50%", transform: "translateX(-50%)" }}>
              SOUTH JAMRUD QUAY
            </DockLabel>
            <DockLabel style={{ top: "50%", left: "20px", transform: "translateY(-50%) rotate(-90deg)" }}>
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
  font-size: 13px;

  th, td {
    border: 1px solid #ccc;
    padding: 6px 8px;
    text-align: center;
    cursor: pointer;
  }

  thead {
    background-color: #002b5b;
    color: white;
    font-size: 13px;
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

/* Styled Components untuk layout dermaga */
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
  margin: ${({ position }) =>
    position === "top" ? "0 0 -90px 0" : "-55px 0 0 0"}; /* ⬅️ ubah di sini */
  
  flex-direction: ${({ position }) =>
    position === "top" ? "row-reverse" : "row"};
`;

const Ship = styled.div`
  width: 140px;
  height: 105px;
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
  left: -175px; /* 🔹 dari -130 ke -45 biar lebih dekat */
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 25px; /* 🔹 boleh juga sedikit dikurangi kalau mau rapat */
`;

const ShipVertical = styled.div`
  width: 140px;
  height: 105px;
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
  width: 830px;
  height: 250px;
  position: relative;
  margin: 40px 0;
  border: none;
  box-shadow: none;
  background: none; /* ❌ hilangkan semua background */

  /* Tambahkan gambar kecil di tengah */
  &::before {
    content: "";
    position: absolute;
    top: 50%;
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
  transform: translateY(-50%) rotate(-90deg);
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
  font-size: 9px; /* 🔹 ukuran default untuk teks lain */
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

