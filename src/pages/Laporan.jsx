import React, { useState, useEffect } from "react";
import styled from "styled-components";
import { collection, query, where, getDocs, orderBy, addDoc } from "firebase/firestore";
import { db } from "../firebase";
import Sidebar from "../components/Sidebar";
import { FaBars, FaTimes } from "react-icons/fa";
import { jsPDF } from "jspdf";

const Laporan = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tanggal, setTanggal] = useState("");
  const [terminal, setTerminal] = useState("");
  const [shift, setShift] = useState("");
  const [loading, setLoading] = useState(false);
  const [grup, setGrup] = useState("");

  const emptyKapal = {
  terminalBox: "", // ⬅️ terminal khusus untuk tiap box
  dermaga: "",
  namaKapal: "",
  tambatan: "",
  spmk: "",
  ppk: "",
  AgentStevedore: "",
  jenisBarang: "",
  etbetd: "",
  firstLine: "",
  startDL: "",
  equipment: "",
  day: "",
  jumlahMuatan: "",
  dischShift: "",
  realisasiBongkarMuat: "",
  balance: "",
  estimasi: "",
  complited: "",
  lastLine: "",
  not_time_hours: "",
  idle_time_hours: "",
  effective_time_hours: "",
  realisasiTgh: "",
  ketercapaian: "",
  remark: "",
};


  const [kapalList, setKapalList] = useState(
    Array.from({ length: 6 }, () => ({ ...emptyKapal }))
  );

  const handleSaveAndDownload = async () => {
    if (!tanggal || !terminal || !shift) {
      alert("Mohon lengkapi Tanggal, Terminal, dan Shift");
      return;
    }

    try {
      setLoading(true);

      // -----------------------------
      // 1️⃣ Payload lengkap untuk Firestore
      // -----------------------------
      for (const kapal of kapalList) {
      const payload = {
        tanggal,
        terminal,
        shift,
        grup: grup || "-",
        createdAt: new Date(),

        // ⬇️ Data per kapal (1 dokumen = 1 kapal)
        terminalBox: kapal.terminalBox || "",
        tambatan: kapal.tambatan || "",
        namaKapal: kapal.namaKapal || "",
        dermaga: kapal.dermaga || "",
        spmk: kapal.spmk || "",
        ppk: kapal.ppk || "",
        AgentStevedore: kapal.AgentStevedore || "",
        jenisBarang: kapal.jenisBarang || "",
        etbetd: kapal.etbetd || "",
        firstLine: kapal.firstLine || "",
        startDL: kapal.startDL || "",
        equipment: kapal.equipment || "",
        day: kapal.day || "",
        jumlahMuatan: Number(kapal.jumlahMuatan) || 0,
        dischShift: Number(kapal.dischShift) || 0,
        realisasiBongkarMuat: Number(kapal.realisasiBongkarMuat) || 0,
        balance: Number(kapal.balance) || 0,
        estimasi: kapal.estimasi || "",
        complited: kapal.complited || "",
        lastLine: kapal.lastLine || "",
        not_time_hours: kapal.not_time_hours || "",
        idle_time_hours: kapal.idle_time_hours || "",
        effective_time_hours: kapal.effective_time_hours || "",
        realisasiTgh: kapal.realisasiTgh || "",
        ketercapaian: kapal.ketercapaian || "",
        remark: kapal.remark || "",
      };

      await addDoc(collection(db, "laporan"), payload);
    }

    console.log("✔ Semua box berhasil disimpan sebagai dokumen terpisah");

      // =====================================================
      // 2️⃣ PDF Generator – disesuaikan dengan field inputan
      // =====================================================
      // =====================================================
      // 2️⃣ PDF Generator – disesuaikan dengan field inputan
      // =====================================================
      const doc = new jsPDF();

      // =====================================================
      // LOG AWAL
      // =====================================================
      console.log("=== DEBUG PDF HEADER ===");
      console.log("terminal:", terminal);
      console.log("tanggal (raw):", tanggal);
      console.log("formatted header tanggal:", formatTanggalHeader(tanggal));
      console.log("shift:", shift);
      console.log("grup:", grup);

      // =====================================================
      // BACKGROUND PUTIH – HARUS PALING AWAL
      // =====================================================
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, 210, 297, "F");
      console.log("BG rendered");

      // =====================================================
      // HEADER TEXT
      // =====================================================
      const terminalTitle =
        terminal.toLowerCase().includes("jamrud")
          ? "JAMRUD TERMINAL DIVISION"
          : terminal.toLowerCase().includes("nilam")
          ? "NILAM KONVENSIONAL TERMINAL DIVISION"
          : terminal.toLowerCase().includes("mirah")
          ? "MIRAH TERMINAL DIVISION"
          : "";

      const headerTanggal = formatTanggalHeader(tanggal);
      const headerShift = `Shift ${shift} ${grup ? `Group ${grup}` : ""}`;

      // LOGGING HEADER
      console.log("terminalTitle:", terminalTitle);
      console.log("headerTanggal:", headerTanggal);
      console.log("headerShift:", headerShift);

      // WRITE HEADER
      doc.setFontSize(14);
      doc.text(terminalTitle, 105, 15, { align: "center" });

      doc.setFontSize(12);
      doc.text(headerTanggal, 105, 22, { align: "center" });
      doc.text(headerShift, 105, 29, { align: "center" });

      // garis
      doc.line(15, 33, 195, 33);
      console.log("Header rendered");

      // =====================================================
      // GRID BOXES (tidak berubah)
      // =====================================================
      const marginX = 10;
      const marginY = 38;

      const usableWidth = 210 - marginX * 2;
      const boxWidth = usableWidth / 3;
      const boxHeight = 100;

      let x = marginX;
      let y = marginY;

      console.log("Mulai render box. Total kapal:", kapalList.length);

      kapalList.forEach((kapal, index) => {
        console.log(`Render kapal ${index + 1}:`, kapal.namaKapal);

        doc.setDrawColor(0, 0, 0);
        doc.rect(x, y, boxWidth, boxHeight);

        doc.setFontSize(7);
        let textY = y + 12;

        const fields = [
          ["NAME OF SHIP", kapal.namaKapal || "-"],
          ["DERMAGA & KADE", kapal.dermaga || "-"],
          ["SPMK", kapal.spmk || "-"],
          ["PPK", kapal.ppk || "-"],
          ["AGENT/STEV", kapal.AgentStevedore || "-"],
          ["COMMODITY", kapal.jenisBarang || "-"],
          ["ETB/ETD", kapal.etbetd || "-"],
          ["FIRST LINE", kapal.firstLine || "-"],
          ["START D/L", kapal.startDL || "-"],
          ["EQUIPMENT", kapal.equipment || "-"],
          ["DAY", kapal.day || "-"],
          ["MANIFEST", kapal.jumlahMuatan ?? "-"],
          ["DISCH/SHIFT", kapal.dischShift ?? "-"],
          ["PREVIOUS", kapal.realisasiBongkarMuat ?? "-"],
          ["BALANCE", kapal.balance ?? "-"],
          ["ESTIMASI", kapal.estimasi || "-"],
          ["COMPLITED", kapal.complited || "-"],
          ["LAST LINE", kapal.lastLine || "-"],
          ["NOT TIME (JAM)", kapal.not_time_hours || "-"],
          ["IDLE TIME (JAM)", kapal.idle_time_hours || "-"],
          ["EFFECTIVE TIME (JAM)", kapal.effective_time_hours || "-"],
          ["TGH", kapal.realisasiTgh || "-"],
          ["KINERJA", kapal.ketercapaian || "-"],
          ["REMARK", kapal.remark || "-"],
        ];

        fields.forEach(([label, value]) => {
          doc.text(`${label}: ${value}`, x + 3, textY);
          textY += 3.4;
        });

        x += boxWidth;
        if ((index + 1) % 3 === 0) {
          x = marginX;
          y += boxHeight;
        }
      });

      // =====================================================
      // SIMPAN PDF
      // =====================================================
      doc.save(`Laporan_${terminal}_${tanggal}_${shift}.pdf`);
      console.log("PDF saved");


      console.log("✔ Data tersimpan & PDF diunduh");
    } catch (err) {
      console.error("❌ Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const getTerminalOptions = (t) => {
  if (!t) return [];

  if (t.includes("Nilam")) return ["Nilam Selatan", "Nilam Utara"];
  if (t.includes("Mirah")) return ["Mirah Selatan", "Mirah Timur"];
  if (t.includes("Jamrud")) return ["Jamrud Barat", "Jamrud Selatan"];

  return [];
};

  const getBerthOptions = (terminalBox) => {
  switch (terminalBox) {
    case "Nilam Utara":
      return ["berth 4", "berth 5", "berth 6"];
    case "Nilam Selatan":
      return ["berth 1", "berth 2", "berth 3"];
    case "Mirah Selatan":
      return ["berth 1", "berth 2", "berth 3"];
    case "Mirah Timur":
      return ["berth 4", "berth 5", "berth 6"];
    default:
      return [];
  }
};


  const updateField = (i, field, value) => {
    setKapalList((prev) =>
      prev.map((k, idx) =>
        idx === i ? { ...k, [field]: value } : k
      )
    );
  };

  const formatTanggalHeader = (tanggal) => {
    if (!tanggal) return "";
    const date = new Date(tanggal);
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const terminalTitle = 
    terminal.toLowerCase().includes("jamrud") 
      ? "JAMRUD TERMINAL DIVISION"
      : terminal.toLowerCase().includes("nilam")
      ? "NILAM KONVENSIONAL TERMINAL DIVISION"
      : terminal.toLowerCase().includes("mirah")
      ? "MIRAH TERMINAL DIVISION"
      : "";

  return (
    <PageWrapper>
      <TopBar>
        <MenuButton onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <FaTimes /> : <FaBars />}
        </MenuButton>
        <Title>Laporan</Title>
      </TopBar>

      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <Content>
        <Card>
          <SectionTitle>Filter Laporan</SectionTitle>
          <FilterGrid>
            <div>
              <Label>Tanggal</Label>
              <InputField
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
            <div>
              <Label>Group</Label>
              <Select
                value={grup}
                onChange={(e) => setGrup(e.target.value)}
              >
                <option value="">Pilih Group</option>
                <option value="A">Group A</option>
                <option value="B">Group B</option>
                <option value="C">Group C</option>
                <option value="D">Group D</option>
              </Select>
            </div>
          </FilterGrid>
        </Card>

      {tanggal && terminal && (
        <HeaderSection>
          <h2>{terminalTitle}</h2>
          <h3>{formatTanggalHeader(tanggal)}</h3>
          <h3>
            Shift {shift} {grup ? `Group ${grup}` : ""}
          </h3>
        </HeaderSection>
      )}

      <GridContainer>
        {kapalList.map((kapal, i) => (
          <Box key={i}>

          {/* TERMINAL PER BOX */}
          <Field>
            <Label style={{ fontWeight: "normal", fontSize: "9px" }}>
              TERMINAL
            </Label>
            <Select
              value={kapal.terminalBox}
              onChange={(e) => updateField(i, "terminalBox", e.target.value)}
            >
              <option value="">Pilih Terminal</option>

              {getTerminalOptions(terminal).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </Field>

          {/* BERTH PER BOX → tergantung terminalBox */}
          <Field>
            <Label style={{ fontWeight: "normal", fontSize: "9px" }}>
              BERTH
            </Label>

            <Select
              value={kapal.tambatan}
              onChange={(e) => updateField(i, "tambatan", e.target.value)}
              disabled={!kapal.terminalBox}   // Nonaktif jika terminal belum dipilih
            >
              <option value="">Pilih Berth</option>

              {getBerthOptions(kapal.terminalBox).map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </Select>
          </Field>
            
            {/* NAME OF SHIP */}
            <Field>
              <Label style={{ fontWeight: "normal", fontSize: "9px" }}>NAME OF SHIP</Label>
              <EditableInput
                value={kapal.namaKapal}
                onChange={(v) => updateField(i, "namaKapal", v)}
              />
            </Field>

            {/* DERMAGA & KADE */}
            <Field>
              <Label style={{ fontWeight: "normal", fontSize: "9px" }}>DERMAGA & KADE</Label>
              <EditableInput
                value={kapal.dermaga}
                onChange={(v) => updateField(i, "dermaga", v)}
              />
            </Field>

            {/* SPMK */}
            <Field>
              <Label style={{ fontWeight: "normal", fontSize: "9px" }}>SPMK</Label>
              <EditableInput
                value={kapal.spmk}
                onChange={(v) => updateField(i, "spmk", v)}
              />
            </Field>

            {/* PPK */}
            <Field>
              <Label style={{ fontWeight: "normal", fontSize: "9px" }}>PPK</Label>
              <EditableInput
                value={kapal.ppk}
                onChange={(v) => updateField(i, "ppk", v)}
              />
            </Field>

            {/* AGENT / STEV */}
            <Field>
              <Label style={{ fontWeight: "normal", fontSize: "9px" }}>AGENT / STEV</Label>
              <EditableInput
                value={kapal.AgentStevedore}
                onChange={(v) => updateField(i, "AgentStevedore", v)}
              />
            </Field>

            {/* COMMODITY */}
            <Field>
              <Label style={{ fontWeight: "normal", fontSize: "9px" }}>COMMODITY</Label>
              <EditableInput
                value={kapal.jenisBarang}
                onChange={(v) => updateField(i, "jenisBarang", v)}
              />
            </Field>

            {/* ETB/ETD */}
            <Field>
              <Label style={{ fontWeight: "normal", fontSize: "9px" }}>ETB/ETD</Label>
              <EditableInput
                value={kapal.etbetd}
                onChange={(v) => updateField(i, "etbetd", v)}
              />
            </Field>

            {/* FIRST LINE */}
            <Field>
              <Label style={{ fontWeight: "normal", fontSize: "9px" }}>FIRST LINE</Label>
              <EditableInput
                value={kapal.firstLine}
                onChange={(v) => updateField(i, "firstLine", v)}
              />
            </Field>

            {/* START D/L */}
            <Field>
              <Label style={{ fontWeight: "normal", fontSize: "9px" }}>START D/L</Label>
              <EditableInput
                value={kapal.startDL}
                onChange={(v) => updateField(i, "startDL", v)}
              />
            </Field>

            {/* EQUIPMENT */}
            <Field>
              <Label style={{ fontWeight: "normal", fontSize: "9px" }}>EQUIPMENT</Label>
              <EditableInput
                value={kapal.equipment}
                onChange={(v) => updateField(i, "equipment", v)}
              />
            </Field>

            {/* DAY */}
            <Field>
              <Label style={{ fontWeight: "normal", fontSize: "9px" }}>DAY</Label>
              <EditableInput
                value={kapal.day}
                onChange={(v) => updateField(i, "day", v)}
              />
            </Field>

            {/* MANIFEST */}
            <Field>
              <Label style={{ fontWeight: "normal", fontSize: "9px" }}>MANIFEST</Label>
              <EditableInput
                value={kapal.jumlahMuatan}
                onChange={(v) => updateField(i, "jumlahMuatan", Number(v) || 0)}
              />
            </Field>

            {/* DISCH/SHIFT */}
            <Field>
              <Label style={{ fontWeight: "normal", fontSize: "9px" }}>DISCH/SHIFT</Label>
              <EditableInput
                value={kapal.dischShift}
                onChange={(v) => updateField(i, "dischShift", Number(v) || 0)}
              />
            </Field>

            {/* PREVIOUS */}
            <Field>
              <Label style={{ fontWeight: "normal", fontSize: "9px" }}>PREVIOUS</Label>
              <EditableInput
                value={kapal.realisasiBongkarMuat}
                onChange={(v) => updateField(i, "realisasiBongkarMuat", Number(v) || 0)}
              />
            </Field>

            {/* BALANCE */}
            <Field>
              <Label style={{ fontWeight: "normal", fontSize: "9px" }}>BALANCE</Label>
              <EditableInput
                value={kapal.balance}
                onChange={(v) => updateField(i, "balance", v)}
              />
            </Field>

            {/* ESTIMASI */}
            <Field>
              <Label style={{ fontWeight: "normal", fontSize: "9px" }}>ESTIMASI</Label>
              <EditableInput
                value={kapal.estimasi}
                onChange={(v) => updateField(i, "estimasi", v)}
              />
            </Field>

            {/* COMPLITED */}
            <Field>
              <Label style={{ fontWeight: "normal", fontSize: "9px" }}>COMPLITED</Label>
              <EditableInput
                value={kapal.complited}
                onChange={(v) => updateField(i, "complited", v)}
              />
            </Field>

            {/* LAST LINE */}
            <Field>
              <Label style={{ fontWeight: "normal", fontSize: "9px" }}>LAST LINE</Label>
              <EditableInput
                value={kapal.lastLine}
                onChange={(v) => updateField(i, "lastLine", v)}
              />
            </Field>

            {/* NOT TIME */}
            <Field>
              <Label style={{ fontWeight: "normal", fontSize: "9px" }}>NOT TIME (JAM)</Label>
              <EditableInput
                value={kapal.not_time_hours}
                onChange={(v) => updateField(i, "not_time_hours", v)}
              />
            </Field>

            {/* IDLE TIME */}
            <Field>
              <Label style={{ fontWeight: "normal", fontSize: "9px" }}>IDLE TIME (JAM)</Label>
              <EditableInput
                value={kapal.idle_time_hours}
                onChange={(v) => updateField(i, "idle_time_hours", v)}
              />
            </Field>

            {/* EFFECTIVE TIME */}
            <Field>
              <Label style={{ fontWeight: "normal", fontSize: "9px" }}>EFFECTIVE TIME (JAM)</Label>
              <EditableInput
                value={kapal.effective_time_hours}
                onChange={(v) => updateField(i, "effective_time_hours", v)}
              />
            </Field>

            {/* TGH */}
            <Field>
              <Label style={{ fontWeight: "normal", fontSize: "9px" }}>TGH</Label>
              <EditableInput
                value={kapal.realisasiTgh}
                onChange={(v) => updateField(i, "realisasiTgh", v)}
              />
            </Field>

            {/* KINERJA */}
            <Field>
              <Label style={{ fontWeight: "normal", fontSize: "9px" }}>KINERJA</Label>
              <EditableInput
                value={kapal.ketercapaian}
                onChange={(v) => updateField(i, "ketercapaian", v)}
              />
            </Field>

            {/* KETERANGAN */}
            <Field>
              <Label style={{ fontWeight: "normal", fontSize: "9px" }}>KETERANGAN</Label>
              <EditableInput
                value={kapal.remark}
                onChange={(v) => updateField(i, "remark", v)}
              />
            </Field>

          </Box>
        ))}
      </GridContainer>

      <ButtonWrapper>
        <SaveButton onClick={handleSaveAndDownload} disabled={loading}>
          {loading ? "Menyimpan..." : "Simpan & Download"}
        </SaveButton>
      </ButtonWrapper>

      </Content>
    </PageWrapper>
  );
};

export default Laporan;

const EditableInput = React.memo(({ value, onChange }) => {
  const ref = React.useRef(null);

  const handleInput = (e) => {
    onChange(e.target.innerText);
  };

  // UPDATE value hanya kalau beda (agar tdk reset cursor)
  React.useEffect(() => {
    if (ref.current && ref.current.innerText !== value) {
      ref.current.innerText = value ?? "";
    }
  }, [value]);

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      style={{
        fontSize: "9px",
        border: "1px solid #ccc",
        padding: "4px 6px",
        minHeight: "22px",
        width: "100%",
        display: "block",
        boxSizing: "border-box",
        borderRadius: "4px",
        background: "white",
        outline: "none",
        cursor: "text",
        whiteSpace: "pre-wrap",
        overflowWrap: "break-word",
      }}
    />
  );
});

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
  position: relative;
  z-index: 10;     /* ⬅️ ini membuat input bisa diklik lagi */
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

const Select = styled.select`
  width: 100%;
  padding: 0.5rem;
  border-radius: 6px;
  border: 1px solid #ccc;
`;

const GridContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, auto);
  gap: 0;                /* ❗ tanpa jarak antar grid */
  width: 100%;
  margin-top: 25px;
  background: white;     /* ❗ full background grid putih */
`;

const Box = styled.div`
  background: white;      /* ❗ box putih */
  border: 1px solid #ccc; /* ❗ beri garis pemisah antar box */
  padding: 12px;
  border-radius: 0;       /* ❗ no rounded */
  width: 100%;
  box-sizing: border-box;
`;

const BoxTitle = styled.h4`
  margin: 0 0 10px 0;
  font-weight: bold;
  text-align: center;
`;

const Field = styled.div`
  display: flex;
  margin-bottom: 6px;
`;

const Label = styled.div`
  width: 120px;
  font-weight: 600;
`;
const InputField = styled.input`
  width: 100%;
  padding: 0.5rem;
  border-radius: 6px;
  border: 1px solid #ccc;
`;

const Input = styled.div`
  flex: 1;
  min-height: 18px;
  padding: 3px 6px;
  border: 1px solid #ccc;
  background: #fff;
  border-radius: 4px;
  outline: none;

  &[contenteditable="true"]:focus {
    border-color: #007bff;
    background: #eef5ff;
  }
`;

const HeaderSection = styled.div`
  text-align: center;
  margin-bottom: 20px;

  h2 {
    font-size: 20px;
    font-weight: bold;
  }

  h3 {
    font-size: 16px;
    margin-top: 4px;
  }
`;

const ButtonWrapper = styled.div`
  width: 100%;
  display: flex;
  justify-content: center;
  margin: 30px 0;
`;

const SaveButton = styled.button`
  background: #003366;
  color: white;
  padding: 12px 26px;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  cursor: pointer;
  font-weight: 600;
  transition: 0.2s;

  &:hover {
    background: #002244;
  }

  &:disabled {
    background: #999;
    cursor: not-allowed;
  }
`;
