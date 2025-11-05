import { useEffect, useState } from "react";
import styled from "styled-components";
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";
import { useMemo } from "react";

function toNumber(v) {
  if (!v) return 0;
  const cleaned = String(v).trim().replace(/\./g, "").replace(/,/g, ".").replace(/[^\d.-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
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
function convertToISO(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split(" ")[0]?.split("/");
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return "";
}

export default function Dashboard() {
  const today = new Date().toISOString().split("T")[0];
  const [rawData, setRawData] = useState([]);
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({ delay: 0, onSchedule: 0 });
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [selectedShift, setSelectedShift] = useState("");
  const [selectedTerminal, setSelectedTerminal] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  useEffect(() => {
    const fetchSheet = async () => {
      const res = await fetch(
        "https://docs.google.com/spreadsheets/d/1rOSx92sX8oMHpz5khaDq5OvwfpDzOjOTAFXt-iDvB0Q/gviz/tq?tqx=out:csv"
      );
      const text = await res.text();
      const rows = parseCSV(text);
      if (rows.length < 2) return;

    const parsed = rows.slice(1).map(r => {
      const tanggal = convertToISO(r[0]);
      const terminal = r[1] || "";
      const shift = r[3] || "";
      const namaKapal = r[5] || "";
      const realisasiTgh = r[8] || "";
      const ketercapaian = r[9] || "";
      const jumlahMuatan = toNumber(r[12]);
      const realisasiBongkar = toNumber(r[13]);
      const perencanaanShift = toNumber(r[14]);
      const realisasiShift = toNumber(r[15]);
      const tambatan = r[16] || ""; // ✅ Tambah ini
      const remark = r[10] || ""; // ✅ kolom REMARK CAPAIAN KERJA
      const targetPerShift = perencanaanShift ? jumlahMuatan / perencanaanShift : 0;
      const totalTarget = targetPerShift * realisasiShift;
      const status = realisasiBongkar >= totalTarget ? "ON SCHEDULE" : "DELAY";

      return {
        tanggal,
        terminal,
        shift,
        namaKapal,
        realisasiTgh,
        ketercapaian,
        jumlahMuatan,
        realisasiBongkar,
        perencanaanShift,
        realisasiShift,
        tambatan, // ✅ simpan di object
        status,
        keterangan: remark,
      };
    }).filter(r => r.namaKapal);



        setRawData(parsed);
        setData(parsed.filter(d => d.tanggal === today)); // default hari ini
        updateSummary(parsed.filter(d => d.tanggal === today));
        };

        fetchSheet();
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
      if (selectedTerminal) filtered = filtered.filter(r => r.terminal === selectedTerminal);

      updateSummary(filtered);
      setData(filtered);
    }, [startDate, endDate, selectedShift, selectedTerminal, rawData]);


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
  <Container>
    <Header>
      <h1>Evaluasi Harian Capaian Kinerja</h1>
      <h2>PNC Branch Jamrud Nilam Mirah</h2>
    </Header>

    <TopRow>
      <FilterGroup>
        <label>Dari:</label>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />

        <label>Sampai:</label>
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />

        <label>Shift:</label>
        <select value={selectedShift} onChange={e => setSelectedShift(e.target.value)}>
          <option value="">Semua</option>
          <option value="I">Shift I</option>
          <option value="II">Shift II</option>
          <option value="III">Shift III</option>
        </select>

        <label>Terminal:</label>
        <select value={selectedTerminal} onChange={e => setSelectedTerminal(e.target.value)}>
          <option value="">Semua</option>
          <option value="Jamrud Utara">Jamrud Utara</option>
          <option value="Jamrud Selatan">Jamrud Selatan</option>
          <option value="Nilam">Nilam</option>
          <option value="Mirah">Mirah</option>
        </select>
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
                { key: "realisasiBongkar", label: "Realisasi Bongkar/Muat s.d Sekarang" },
                { key: "perencanaanShift", label: "Perencanaan Jumlah Shift" },
                { key: "realisasiShift", label: "Realisasi Jumlah Shift s.d Sekarang" },
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
                <td>{row.realisasiBongkar}</td>
                <td>{row.perencanaanShift}</td>
                <td>{row.realisasiShift}</td>
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
                labelLine={false}
                outerRadius={90}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </RightPanel>
    </Content>

    {/* Layout Terminal Jamrud */}
    <QuayLayout data={data} />

    {/* 🔹 Tabel baru di bawah layout */}
    <div style={{ marginTop: "40px" }}>
      <Title>Keterangan</Title>
      <StyledTable>
        <thead>
          <tr>
            <th>Nama Kapal</th>
            <th>Status</th>
            <th>Keterangan</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              <td>{row.namaKapal}</td>
              <StatusCell status={row.status}>{row.status}</StatusCell>
              <td>{row.keterangan || "-"}</td>
            </tr>
          ))}
        </tbody>
      </StyledTable>
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

  // 🧩 Gunakan useMemo agar reaktif ke data
  const updatedTambatan = useMemo(() => {
    return tambatan.map((t) => {
      const match = data.find((d) => {
        const berth = (d.tambatan || "").trim().toLowerCase();
        const terminal = (d.terminal || "").toLowerCase();

        const cocokTerminal =
        (terminal.includes("utara") && (t.posisi === "top" || t.posisi === "left")) ||
        (terminal.includes("selatan") && t.posisi === "bottom");

        const cocokTambatan = berth.includes(t.id.toString());

        const cocok = cocokTerminal && cocokTambatan;

        if (cocok) {
          console.log(`✅ ${d.namaKapal} cocok dengan t.id=${t.id}, posisi=${t.posisi}`);
        }

        return cocok;
      });

      return {
        ...t,
        nama: match ? match.namaKapal : "N/A",
        jumlahMuatan: match ? match.jumlahMuatan : null,
        perencanaanShift: match ? match.perencanaanShift : null,
        status: match ? match.status : null,
      };
    });
  }, [data]); // ✅ re-run setiap kali data berubah

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

/* Styled Components */
const Container = styled.div`
  background-color: #f5f7fa;
  min-height: 100vh;
  padding: 40px;
  font-family: "Segoe UI", Roboto, sans-serif;
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
  border-left: 6px solid ${({ color }) => color};
  border-radius: 8px;
  padding: 10px 14px;
  color: ${({ color }) => color};
  font-weight: 600;
  min-width: 160px;
  text-align: center;
  div {
    font-size: 18px;
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
  font-size: 13px; /* 🔹 Kecilkan font tabel */

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
  left: -155px; /* 🔹 dari -130 ke -45 biar lebih dekat */
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
  left: 120px; /* geser mendekati kapal */
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
  top: -10px;
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
      ? "rgba(34, 195, 88, 0.52)"   /* ✅ hijau transparan */
      : status === "DELAY"
      ? "rgba(188, 28, 28, 0.41)"   /* ❌ merah transparan */
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
