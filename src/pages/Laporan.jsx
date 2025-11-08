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

  const handleCari = async () => {
  if (!tanggal || !terminal || !shift) {
    alert("Harap pilih tanggal, terminal, dan shift terlebih dahulu");
    return;
  }

  try {
    setLoading(true);
    console.group("📅 [LAPORAN QUERY]");
    console.log("Tanggal input:", tanggal);
    console.log("Terminal dipilih:", terminal);
    console.log("Shift dipilih:", shift);

    // Rentang waktu Firestore (UTC+7)
    const start = new Date(`${tanggal}T00:00:00+07:00`);
    const end = new Date(`${tanggal}T23:59:59+07:00`);
    console.log("Range waktu Firestore (lokal UTC+7):", {
      start: start.toISOString(),
      end: end.toISOString(),
    });

    // Query utama
    const q = query(
      collection(db, "laporan"),
      where("terminal", "==", terminal),
      where("shift", "==", shift),
      where("createdAt", ">=", start),
      where("createdAt", "<=", end)
    );

    console.log("🔍 Query siap dijalankan...");
    const snapshot = await getDocs(q);
    console.log(`✅ ${snapshot.size} dokumen ditemukan`);

    if (snapshot.empty) {
      console.warn("⚠️ Tidak ditemukan data untuk kombinasi shift ini. Menjalankan fallback…");

      // Ambil semua laporan di terminal + tanggal (tanpa filter shift)
      const fallbackQ = query(
        collection(db, "laporan"),
        where("terminal", "==", terminal),
        where("createdAt", ">=", start),
        where("createdAt", "<=", end)
      );
      const fallbackSnap = await getDocs(fallbackQ);

      console.log(`📄 Ditemukan ${fallbackSnap.size} dokumen fallback:`);
      fallbackSnap.docs.forEach((doc) => {
        const data = doc.data();
        console.log({
          id: doc.id,
          shift: data.shift,
          createdAt: data.createdAt?.toDate().toISOString(),
          terminal: data.terminal,
        });
      });

      console.log(
        "🧾 Perhatikan field 'shift' pada hasil di atas. Itu format yang dipakai di Firestore dan harus sama persis di query."
      );
    } else {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setLaporanData(data);
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
      `SHIFT ${shift.toUpperCase()} - ${terminal.toUpperCase()}`,
      pageWidth / 2,
      30,
      { align: "center" }
    );

    let x = margin;
    let y = 40;
    let count = 0;

    laporanData.forEach((item, i) => {
      console.log(`🧾 Menambahkan kapal ke-${i + 1}:`, item.namaKapal);
      doc.setFontSize(9);
      doc.rect(x, y, 90, 100);

      const baseY = y + 8;
      const lines = [
        ["NAME OF SHIP", item.namaKapal || "-"],
        ["DERMAGA & KADE", item.dermaga || "-"],
        ["SPMK", item.spmk || "-"],
        ["PPK", item.ppk || "-"],
        ["AGENT / STEV", item.agentStevedore || "-"],
        ["COMMODITY", item.commodity || "-"],
        ["ETB/ETD", `${item.etb || "-"} - ${item.etd || "-"}`],
        ["FIRST LINE", item.firstLine || "-"],
        ["START D/L", item.startDL || "-"],
        ["EQUIPMENT", item.equipment || "-"],
        ["DAY", item.day || "-"],
        ["MANIFEST", item.manifest || "-"],
        ["DISCH / SHIFT", item.dischShift || "-"],
        ["PREVIOUS", item.previous || "-"],
        ["BALANCE", item.balance || "-"],
        ["ESTIMASI", item.estimasi || "-"],
        ["COMPLETED", item.completed || "-"],
        ["LAST LINE", item.lastLine || "-"],
        ["NOT TIME", `${item.not_time_hours || 0} JAM`],
        ["IDLE TIME", `${item.idle_time_hours || 0} JAM`],
        ["EFFECTIVE TIME", `${item.effective_time_hours || 0} JAM`],
        ["TGH", item.tgh || "-"],
        ["KINERJA", item.kinerja || "-"],
      ];

      let textY = baseY;
      lines.forEach(([label, value]) => {
        doc.text(`${label} :`, x + 2, textY);
        doc.text(String(value), x + 45, textY);
        textY += 5;
      });

      x += 95;
      count++;
      if (count % 3 === 0) {
        x = margin;
        y += 105;
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
              <Label>Dermaga</Label>
              <Select
                value={terminal}
                onChange={(e) => setTerminal(e.target.value)}
              >
                <option value="">Pilih Dermaga</option>
                <option value="Jamrud Utara">Jamrud Utara</option>
                <option value="Jamrud Selatan">Jamrud Selatan</option>
                <option value="Jamrud Barat">Jamrud Barat</option>
                <option value="Mirah Selatan">Mirah Selatan</option>
                <option value="Mirah Timur">Mirah Timur</option>
                <option value="Nilam Selatan">Nilam Selatan</option>
                <option value="Nilam Utara">Nilam Utara</option>
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
                <p><b>DERMAGA & KADE:</b> {item.dermaga}</p>
                <p><b>SPMK:</b> {item.spmk}</p>
                <p><b>PPK:</b> {item.ppk}</p>
                <p><b>AGENT / STEV:</b> {item.agentStevedore}</p>
                <p><b>COMMODITY:</b> {item.commodity}</p>
                <p><b>ETB/ETD:</b> {item.etb} - {item.etd}</p>
                <p><b>FIRST LINE:</b> {item.firstLine}</p>
                <p><b>START D/L:</b> {item.startDL}</p>
                <p><b>DAY:</b> {item.day}</p>
                <p><b>KINERJA:</b> {item.kinerja}</p>
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
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
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
  gap: 1.2rem;
`;
const ReportCard = styled.div`
  background: white;
  border-radius: 10px;
  padding: 1rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  h3 {
    color: #1e3a8a;
    text-align: center;
    margin-bottom: 0.5rem;
  }
  p {
    font-size: 0.9rem;
    margin: 0.2rem 0;
  }
`;
const EmptyText = styled.p`
  text-align: center;
  color: #6b7280;
  font-style: italic;
`;
