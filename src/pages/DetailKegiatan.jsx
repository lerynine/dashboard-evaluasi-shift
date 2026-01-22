import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import styled from "styled-components";

// sidebar & icon
import Sidebar from "../components/Sidebar";
import { FaBars, FaArrowLeft } from "react-icons/fa";

// chart
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const formatDateTime = (val) => {
  if (!val) return "-";

  // Firestore Timestamp
  if (val.seconds) {
    return val.toDate().toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  // JS Date
  if (val instanceof Date) {
    return val.toLocaleString("id-ID");
  }

  // String / number
  return val;
};

export default function DetailKegiatan() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const ref = doc(db, "laporan", id);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          alert("Data kegiatan tidak ditemukan");
          navigate("/kegiatan");
          return;
        }

        setData({ id: snap.id, ...snap.data() });
      } catch (err) {
        console.error(err);
        alert("Gagal mengambil detail kegiatan");
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [id, navigate]);

  if (loading) return <Content>Memuat data...</Content>;
  if (!data) return null;

  /* ======================
   STATUS DELAY / ON SCHEDULE
====================== */
  const jumlahMuatan = Number(data.jumlahMuatan) || 0;
  const perencanaanShift = Number(data.perencanaanShift) || 0;
  const realisasiShift = Number(data.realisasiShift) || 0;
  const realisasiBongkarMuat = Number(data.realisasiBongkarMuat) || 0;

  const targetPerShift = perencanaanShift ? jumlahMuatan / perencanaanShift : 0;

  const totalTarget = targetPerShift * realisasiShift;

  const status = realisasiBongkarMuat >= totalTarget ? "ON SCHEDULE" : "DELAY";

  const balance = jumlahMuatan - realisasiBongkarMuat;

  /* ======================
     🔢 PRODUKSI HARIAN
  ====================== */
  const dailyMap = {};

  // ambil semua key createdAt*, termasuk createdAt tanpa index
  Object.keys(data)
    .filter((k) => k === "createdAt" || k.startsWith("createdAt"))
    .forEach((key) => {
      const idx = key === "createdAt" ? "" : key.replace("createdAt", "");
      const ts = data[key];

      if (!ts?.toDate) return;

      const rawDate = ts.toDate();
      if (isNaN(rawDate.getTime())) return;

      // aturan hari kerja 08.00–08.00
      const workDate = new Date(rawDate);
      workDate.setHours(workDate.getHours() - 8);

      const dayKey = workDate.toISOString().split("T")[0];

      // 🔥 INI FIX UTAMANYA
      const completedValue =
        Number(idx === "" ? data.completed : data[`completed${idx}`]) || 0;

      dailyMap[dayKey] = (dailyMap[dayKey] || 0) + completedValue;
    });

  const chartData = Object.keys(dailyMap)
    .sort()
    .map((day) => ({
      tanggal: day,
      produksi: dailyMap[day],
    }));

  /* ======================
     📝 KESIMPULAN
  ====================== */
  const kesimpulanList = Object.keys(data)
    .filter(
      (k) => (k === "keterangan" || k.startsWith("keterangan")) && data[k],
    )
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((k) => data[k]);

  const calculateRemainingDays = (perencanaanShift, realisasiShift) => {
    const planned = Number(perencanaanShift || 0);
    const realized = Number(realisasiShift || 0);

    // total shift setelah delay
    const totalShift = Math.max(planned, realized);

    const remainingShift = totalShift - realized;
    if (remainingShift <= 0) return 0;

    return Math.ceil(remainingShift / 3); // 3 shift = 1 hari
  };

  const remainingDays = calculateRemainingDays(
    perencanaanShift,
    realisasiShift,
  );

  return (
    <PageWrapper>
      <TopBar>
        <MenuButton onClick={() => setSidebarOpen(!sidebarOpen)}>
          <FaBars />
        </MenuButton>
      </TopBar>

      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <Content>
        <HeaderRow>
          <h2>Detail Kegiatan Kapal</h2>
          <BackButton onClick={() => navigate(-1)}>
            <FaArrowLeft /> Kembali
          </BackButton>
        </HeaderRow>

        {/* ======================
           INFO UTAMA (2 KOLOM)
        ====================== */}
        <GridTwo>
          <Card>
            <CardTitle>Informasi Kapal</CardTitle>
            <Info label="Nama Kapal" value={data.namaKapal} />
            <Info label="Agent / Stev" value={data.agentStevedore} />
            <Info label="SPMK" value={data.spmk} />
            <Info label="PPK" value={data.ppk} />
            <Info label="Komoditi" value={data.jenisBarang} />
            <Info label="Total Muatan" value={data.jumlahMuatan} />
            <Info label="Status" value={status} badge />
          </Card>

          <Card>
            <CardTitle>Informasi Sandar</CardTitle>
            <Info label="Terminal" value={data.terminal} />
            <Info label="Tambatan" value={data.tambatan} />
            <Info label="ETB" value={formatDateTime(data.etb)} />
            <Info label="ETD" value={formatDateTime(data.etd)} />
            <Info label="First Line" value={formatDateTime(data.firstLine)} />
            <Info label="First D/L" value={formatDateTime(data.startDL)} />
          </Card>
        </GridTwo>

        {/* ======================
           REALISASI
        ====================== */}
        <Card>
          <CardTitle>Produksi</CardTitle>

          <GridFour>
            <Info
              label="Realisasi Bongkar/Muat"
              value={realisasiBongkarMuat.toLocaleString()}
              center
              big
            />

            <Info
              label="Perencanaan Shift"
              value={perencanaanShift}
              center
              big
            />

            <Info
              label="Realisasi Jumlah Shift"
              value={realisasiShift}
              center
              big
            />

            <Info
              label="Balance"
              value={balance.toLocaleString()}
              badge
              center
              big
            />

            <Info
              label="Remaining Days"
              value={`${remainingDays} hari`}
              badge
              center
              big
            />
          </GridFour>
        </Card>

        {/* ======================
           GRAFIK PRODUKSI
        ====================== */}
        <Card>
          <CardTitle>Produksi Harian</CardTitle>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="tanggal" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="produksi"
                stroke="#0B5ED7"
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* ======================
           KESIMPULAN
        ====================== */}
        <Card>
          <CardTitle>Remark Kegiatan</CardTitle>
          <ul>
            {kesimpulanList.length === 0 && <li>-</li>}
            {kesimpulanList.map((k, i) => (
              <li key={i}>{k}</li>
            ))}
          </ul>
        </Card>
      </Content>
    </PageWrapper>
  );
}

/* =========================
   KOMPONEN KECIL
========================= */
function Info({ label, value, badge, center = false, big = false }) {
  return (
    <div
      style={{
        textAlign: center ? "center" : "left",
        display: "flex",
        flexDirection: "column",
        alignItems: center ? "center" : "flex-start",
      }}
    >
      <SmallLabel
        style={{
          fontSize: big ? "14px" : undefined,
        }}
      >
        {label}
      </SmallLabel>

      <Value
        badge={badge}
        status={value}
        style={{
          fontSize: big ? "20px" : undefined,
          fontWeight: big ? 700 : undefined,
        }}
      >
        {value || "-"}
      </Value>
    </div>
  );
}

/* =========================
   STYLES (SAMA DENGAN PAGE LAIN)
========================= */

const PageWrapper = styled.div`
  width: 100%;
  min-height: 100vh;
  background: #f5f7fa;
`;

const TopBar = styled.div`
  height: 60px;
  background: #002b5b;
  display: flex;
  align-items: center;
  padding: 0 16px;
  color: #fff;
`;

const MenuButton = styled.button`
  background: none;
  border: none;
  color: white;
  font-size: 20px;
  cursor: pointer;
`;

const Content = styled.div`
  padding: 24px;
`;

const HeaderRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;

  h2 {
    margin: 0;
    color: #002b5b;
  }
`;

const BackButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  background: #6c757d;
  color: #fff;
  border: none;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;

  &:hover {
    background: #5a6268;
  }
`;

const Card = styled.div`
  background: #fff;
  border-radius: 10px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  margin-bottom: 24px;

  ${({ center }) =>
    center &&
    `
    display: flex;
    align-items: center;
    justify-content: center;
  `}
`;

const CardTitle = styled.h3`
  margin: 0 0 16px;
  color: #002b5b;
`;

const GridTwo = styled.div`
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 24px;
`;

const GridThree = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
`;

const GridFour = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
`;

const SmallLabel = styled.div`
  font-size: 12px;
  color: #6c757d;
`;

const Value = styled.div`
  font-weight: 600;
  padding: ${(p) => (p.badge ? "4px 10px" : "0")};
  border-radius: 999px;
  display: inline-block;
  font-size: 13px;

  ${(p) =>
    p.badge &&
    p.status === "DELAY" &&
    `
      background: #fde2e2;
      color: #b42318;
    `}

  ${(p) =>
    p.badge &&
    p.status === "ON SCHEDULE" &&
    `
      background: #dcfce7;
      color: #15803d;
    `}
`;
