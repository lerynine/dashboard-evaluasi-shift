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
  const [laporanData, setLaporanData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [grup, setGrup] = useState("");
  
  const emptyKapal = {
    namaKapal: "",
    spmk: "",
    ppk: "",
    jenisBarang: "",
    etb: "",
    etd: "",
    remark: ""
  };

  const [kapalList, setKapalList] = useState(Array(6).fill(emptyKapal));
const handleSaveAndDownload = async () => {
  if (!tanggal || !terminal || !shift) {
    alert("Mohon lengkapi Tanggal, Terminal, dan Shift");
    return;
  }

  try {
    setLoading(true);

    const payload = {
      tanggal,
      terminal,
      shift,
      grup: grup || "-",
      kapalList,
      createdAt: new Date(),
    };

    // 🔹 Simpan ke Firestore
    await addDoc(collection(db, "laporan"), payload);

    // ======================================================
    // 🔹 Generate PDF langsung tanpa memanggil fungsi lain
    // ======================================================
    const doc = new jsPDF();

    // ---------- HEADER ----------
    const terminalTitle =
      terminal.toLowerCase().includes("jamrud")
        ? "JAMRUD TERMINAL DIVISION"
        : terminal.toLowerCase().includes("nilam")
        ? "NILAM KONVENSIONAL TERMINAL DIVISION"
        : terminal.toLowerCase().includes("mirah")
        ? "MIRAH TERMINAL DIVISION"
        : "";

    const formattedDate = new Date(tanggal).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    doc.setFontSize(14);
    doc.text(terminalTitle, 105, 15, { align: "center" });

    doc.setFontSize(12);
    doc.text(formattedDate, 105, 22, { align: "center" });

    doc.text(`Shift ${shift} ${grup ? `Group ${grup}` : ""}`, 105, 29, {
      align: "center",
    });

    doc.line(15, 33, 195, 33);

    // ---------- GRID 6 BOX ----------
    let x = 15;
    let y = 40;
    const boxWidth = 60;
    const boxHeight = 45;

    kapalList.forEach((kapal, index) => {
      // Garis kotak
      doc.rect(x, y, boxWidth, boxHeight);

      // Judul di dalam kotak
      doc.setFontSize(11);
      doc.text(`KAPAL ${index + 1}`, x + boxWidth / 2, y + 6, {
        align: "center",
      });

      // Isi tabel
      doc.setFontSize(9);

      const fields = [
        ["Nama Kapal", kapal.namaKapal || "-"],
        ["SPMK", kapal.spmk || "-"],
        ["PPK", kapal.ppk || "-"],
        ["Jenis Barang", kapal.jenisBarang || "-"],
        ["ETB", kapal.etb || "-"],
        ["ETD", kapal.etd || "-"],
        ["Remark", kapal.remark || "-"],
      ];

      let textY = y + 14;
      const valueX = x + 30;

      fields.forEach(([label, value]) => {
        doc.text(label, x + 4, textY);
        doc.text(String(value), valueX, textY);
        textY += 5;
      });

      // Pindah kolom
      x += boxWidth + 5;

      // Turun baris jika sudah 3 box
      if ((index + 1) % 3 === 0) {
        x = 15;
        y += boxHeight + 8;
      }
    });

    // ---------- SAVE FILE ----------
    doc.save(`Laporan_${terminal}_${tanggal}_${shift}.pdf`);

    console.log("✅ Data tersimpan & PDF berhasil diunduh");
    // ======================================================

  } catch (err) {
    console.error("❌ Gagal menyimpan data:", err);
  } finally {
    setLoading(false);
  }
};


const updateField = (index, field, value) => {
  setKapalList((prev) => {
    const updated = [...prev];
    updated[index] = { ...updated[index], [field]: value };
    return updated;
  });
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
            <Field>
              <Label>Nama Kapal</Label>
              <Input
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => updateField(i, "namaKapal", e.target.innerText)}
              >
                {kapal.namaKapal}
              </Input>
            </Field>

            <Field>
              <Label>SPMK</Label>
              <Input
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => updateField(i, "spmk", e.target.innerText)}
              >
                {kapal.spmk}
              </Input>
            </Field>

            <Field>
              <Label>PPK</Label>
              <Input
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => updateField(i, "ppk", e.target.innerText)}
              >
                {kapal.ppk}
              </Input>
            </Field>

            <Field>
              <Label>Jenis Barang</Label>
              <Input
                contentEditable
                suppressContentEditableWarning
                onInput={(e) =>
                  updateField(i, "jenisBarang", e.target.innerText)
                }
              >
                {kapal.jenisBarang}
              </Input>
            </Field>

            <Field>
              <Label>ETB</Label>
              <Input
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => updateField(i, "etb", e.target.innerText)}
              >
                {kapal.etb}
              </Input>
            </Field>

            <Field>
              <Label>ETD</Label>
              <Input
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => updateField(i, "etd", e.target.innerText)}
              >
                {kapal.etd}
              </Input>
            </Field>

            <Field>
              <Label>Remark</Label>
              <Input
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => updateField(i, "remark", e.target.innerText)}
              >
                {kapal.remark}
              </Input>
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
