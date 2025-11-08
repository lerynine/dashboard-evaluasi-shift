import React, { useState, useEffect } from "react";
import styled from "styled-components";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import Sidebar from "../components/Sidebar";
import { FaBars, FaTimes } from "react-icons/fa";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const Laporan = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tanggal, setTanggal] = useState("");
  const [terminal, setTerminal] = useState("");
  const [shift, setShift] = useState("");
  const [laporanData, setLaporanData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [grup, setGrup] = useState("");

  const handleCari = async () => {
  if (!tanggal || !terminal || !shift) {
    alert("Harap pilih tanggal, terminal, dan shift terlebih dahulu");
    return;
  }

  try {
    setLoading(true);
    console.group("📅 [LAPORAN QUERY]");
    console.log("Tanggal input:", tanggal);
    console.log("Terminal dipilih (general):", terminal);
    console.log("Shift dipilih:", shift);

    const start = new Date(`${tanggal}T00:00:00+07:00`);
    const end = new Date(`${tanggal}T23:59:59+07:00`);
    console.log("Range waktu Firestore (lokal UTC+7):", {
      start: start.toISOString(),
      end: end.toISOString(),
    });

    // Ambil semua laporan dalam range waktu dan shift
    const q = query(
      collection(db, "laporan"),
      where("shift", "==", shift),
      where("createdAt", ">=", start),
      where("createdAt", "<=", end)
    );

    console.log("🔍 Query Firestore siap dijalankan...");
    const snapshot = await getDocs(q);
    console.log(`✅ ${snapshot.size} dokumen ditemukan`);

    // Filter manual di sisi client berdasarkan "terminal" yang mengandung kata yang dipilih
    const filteredData = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((d) => {
        const t = (d.terminal || "").toLowerCase();
        return t.includes(terminal.toLowerCase());
      });

    console.log(`📦 Setelah filter berdasarkan terminal "${terminal}": ${filteredData.length} dokumen`);

    if (filteredData.length === 0) {
      console.warn("⚠️ Tidak ada data cocok setelah filter terminal");
    }

    const data = filteredData.map((d) => {
      const jumlahMuatan = parseFloat(d.jumlahMuatan) || 0;
      const realisasi = parseFloat(d.realisasiBongkarMuat) || 0;
      const balance = jumlahMuatan - realisasi;

      return {
        ...d,
        balance: balance.toFixed(3),
      };
    });

    setLaporanData(data);

    if (data.length > 0 && data[0].grup) {
      setGrup(data[0].grup);
    }

    console.groupEnd();
  } catch (err) {
    console.error("❌ Error saat handleCari:", err);
    console.groupEnd();
  } finally {
    setLoading(false);
  }
};


  const handleDownloadPDF = () => {
  console.log("📦 Memulai generate PDF...");
  const doc = new jsPDF("l", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;

  doc.setFontSize(14);
  doc.text("NILAM KONVENSIONAL TERMINAL DIVISION", pageWidth / 2, 15, {
    align: "center",
  });
  doc.setFontSize(12);
  doc.text(`${tanggal}`, pageWidth / 2, 23, { align: "center" });
  doc.text(
    `SHIFT ${shift.toUpperCase()} GROUP ${grup?.toUpperCase() || "-"}`,
    pageWidth / 2,
    30,
    { align: "center" }
  );

  const formatTimestamp = (ts) => {
    if (!ts) return "-";
    try {
      const date =
        ts.seconds !== undefined ? new Date(ts.seconds * 1000) : new Date(ts);
      return date.toLocaleString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "-";
    }
  };

  let x = margin;
  let y = 40;
  let count = 0;

  laporanData.forEach((item, i) => {
    console.log(`🧾 Menambahkan kapal ke-${i + 1}:`, item.namaKapal);
    doc.setFontSize(9);

    const lines = [
      ["NAME OF SHIP", item.namaKapal || "-"],
      ["DERMAGA", item.terminal || "-"],
      ["SPMK", item.spmk || "-"],
      ["PPK", item.ppk || "-"],
      ["AGENT / STEV", item.agentStevedore || "-"],
      ["COMMODITY", item.jenisBarang || "-"],
      ["ETB/ETD", `${formatTimestamp(item.etb)} / ${formatTimestamp(item.etd)}`],
      ["FIRST LINE", formatTimestamp(item.firstLine)],
      ["START D/L", formatTimestamp(item.startDL || item.firstDL)],
      ["EQUIPMENT", item.equipment || "-"],
      ["MANIFEST", item.jumlahMuatan || "-"],
      ["DISCH / SHIFT", item.dischShift || "-"],
      ["PREVIOUS", item.realisasiBongkarMuat || "-"],
      [
        "BALANCE",
        item.balance ||
          (item.jumlahMuatan && item.realisasiBongkarMuat
            ? (parseFloat(item.jumlahMuatan) -
                parseFloat(item.realisasiBongkarMuat)).toFixed(3)
            : "-"),
      ],
      ["ESTIMASI", formatTimestamp(item.estimasi)],
      ["COMPLETED", formatTimestamp(item.completed)],
      ["LAST LINE", formatTimestamp(item.lastLine)],
      ["NOT TIME", `${item.not_time_hours || 0} JAM`],
      ["IDLE TIME", `${item.idle_time_hours || 0} JAM`],
      ["EFFECTIVE TIME", `${item.effective_time_hours || 0} JAM`],
      ["TGH", item.realisasiTgh || "-"],
      ["KINERJA", item.remark || "-"],
    ];

    // 🔹 Hitung posisi titik dua tetap
    const colonX = x + 30; // posisi titik dua di kolom kanan tetap
    const valueX = colonX + 4; // jarak antara ":" dan value

    const linesCount = lines.length;
    const boxHeight = Math.max(100, linesCount * 5 + 10);
    doc.rect(x, y, 90, boxHeight);

    let textY = y + 8;

    // 🔹 Cetak label rata kiri, titik dua sejajar
    lines.forEach(([label, value]) => {
      doc.text(label, x + 2, textY); // rata kiri
      doc.text(":", colonX, textY); // titik dua sejajar
      doc.text(String(value), valueX, textY); // value di kanan
      textY += 5;
    });

    x += 95;
    count++;
    if (count % 3 === 0) {
      x = margin;
      y += boxHeight + 5;
    }
  });

  doc.save(`Laporan_${terminal}_${tanggal}_${shift}.pdf`);
  console.log("✅ PDF berhasil dibuat dan diunduh!");
};



  return (
    <PageWrapper>
      <TopBar>
        <MenuButton onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <FaTimes /> : <FaBars />}
        </MenuButton>
        <Title>Laporan Harian Bongkar Muat</Title>
      </TopBar>

      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <Content>
        <Card>
          <SectionTitle>Filter Laporan</SectionTitle>
          <FilterGrid>
            <div>
              <Label>Tanggal</Label>
              <Input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
              />
            </div>
            <div>
              <Label>Terminal</Label>
              <Select
                value={terminal}
                onChange={(e) => setTerminal(e.target.value)}
              >
                <option value="">Pilih Terminal</option>
                <option value="Jamrud">Jamrud</option>
                <option value="Nilam">Nilam</option>
                <option value="Mirah">Mirah</option>
              </Select>
            </div>
            <div>
              <Label>Shift</Label>
              <Select
                value={shift}
                onChange={(e) => setShift(e.target.value)}
              >
                <option value="">Pilih Shift</option>
                <option value="I (08.00 - 16.00)">I (08.00 - 16.00)</option>
                <option value="II (16.00 - 00.00)">II (16.00 - 00.00)</option>
                <option value="III (00.00 - 08.00)">III (00.00 - 08.00)</option>
              </Select>
            </div>
          </FilterGrid>

          <ButtonRow>
            <Button primary onClick={handleCari} disabled={loading}>
              {loading ? "Memuat..." : "Cari Laporan"}
            </Button>
            <Button
              onClick={handleDownloadPDF}
              disabled={laporanData.length === 0}
            >
              Download PDF
            </Button>
          </ButtonRow>
        </Card>

        <ReportGrid>
          {laporanData.length > 0 ? (
            laporanData.map((item, i) => (
              <ReportCard key={i}>
                <h3>{item.namaKapal || "-"}</h3>
                <p><b>DERMAGA:</b> {item.terminal}</p>
                <p><b>SPMK:</b> {item.spmk}</p>
                <p><b>PPK:</b> {item.ppk}</p>
                <p><b>AGENT / STEV:</b> {item.agentStevedore}</p>
                <p><b>COMMODITY:</b> {item.jenisBarang}</p>
                <p>
                  <b>ETB/ETD:</b>{" "}
                  {item.etb?.seconds
                    ? new Date(item.etb.seconds * 1000).toLocaleString("id-ID")
                    : "-"}{" "}
                  -{" "}
                  {item.etd?.seconds
                    ? new Date(item.etd.seconds * 1000).toLocaleString("id-ID")
                    : "-"}
                </p>
                <p><b>FIRST LINE:</b> {item.firstLine}</p>
                <p><b>START D/L:</b> {item.firstDL}</p>
                <p><b>DAY:</b> {item.day}</p>
                <p><b>KINERJA:</b> {item.remark}</p>
              </ReportCard>
            ))
          ) : (
            !loading && <EmptyText>Belum ada data ditemukan.</EmptyText>
          )}
        </ReportGrid>
      </Content>
    </PageWrapper>
  );
};

export default Laporan;

/* ---------------- Styled Components ---------------- */
const PageWrapper = styled.div`
  background: #f5f7fa;
  min-height: 100vh;
`;
const TopBar = styled.div`
  background: #1e3a8a;
  color: white;
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
`;
const MenuButton = styled.button`
  background: transparent;
  color: white;
  font-size: 1.5rem;
  border: none;
  cursor: pointer;
`;
const Title = styled.h1`
  font-size: 1.3rem;
  font-weight: bold;
`;
const Content = styled.div`
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
`;
const Card = styled.div`
  background: white;
  border-radius: 10px;
  padding: 1.5rem;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
`;
const SectionTitle = styled.h2`
  font-size: 1.2rem;
  font-weight: bold;
  color: #1e3a8a;
  margin-bottom: 1rem;
`;
const FilterGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.5rem; /* jarak antar kolom lebih lebar */
  row-gap: 1.8rem; /* jarak vertikal antar baris */
  margin-bottom: 1.5rem; /* jarak ke tombol */
  align-items: end; /* agar input sejajar rapi */
`;

const Label = styled.label`
  font-weight: 600;
  color: #333;
`;
const Input = styled.input`
  width: 100%;
  padding: 0.5rem;
  border-radius: 6px;
  border: 1px solid #ccc;
`;
const Select = styled.select`
  width: 100%;
  padding: 0.5rem;
  border-radius: 6px;
  border: 1px solid #ccc;
`;
const ButtonRow = styled.div`
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
`;
const Button = styled.button`
  background: ${(p) => (p.primary ? "#2563eb" : "#16a34a")};
  color: white;
  padding: 0.6rem 1.2rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  &:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }
`;
const ReportGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 0.4rem; /* 🔹 semula 1.2rem → dipersempit */
  align-items: start;
`;

const ReportCard = styled.div`
  background: white;
  border-radius: 8px;
  padding: 1rem 1.2rem; /* 🔹 sedikit dipersempit juga */
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

  min-height: 550px;
  height: auto;
  box-sizing: border-box;

  h3 {
    color: #1e3a8a;
    text-align: center;
    margin-bottom: 0.5rem;
    word-wrap: break-word;
  }

  p {
    font-size: 0.9rem;
    margin: 0.25rem 0;
    word-wrap: break-word;
  }

  @media print {
    min-height: auto;
    box-shadow: none;
    border: 1px solid #000;
    page-break-inside: avoid;
  }
`;



const EmptyText = styled.p`
  text-align: center;
  color: #6b7280;
  font-style: italic;
`;
