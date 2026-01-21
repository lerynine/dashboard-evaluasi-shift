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

  if (loading) {
    return (
      <PageWrapper>
        <TopBar>
          <MenuButton onClick={() => setSidebarOpen(!sidebarOpen)}>
            <FaBars />
          </MenuButton>
        </TopBar>
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
        <Content>Memuat data...</Content>
      </PageWrapper>
    );
  }

  if (!data) return null;

  const chartData = [
    {
      name: "Status",
      completed: data.completed ? 1 : 0,
    },
  ];

  return (
    <PageWrapper>
      {/* TOP BAR */}
      <TopBar>
        <MenuButton onClick={() => setSidebarOpen(!sidebarOpen)}>
          <FaBars />
        </MenuButton>
      </TopBar>

      {/* SIDEBAR */}
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      {/* CONTENT */}
      <Content>
        {/* HEADER */}
        <HeaderRow>
          <h2>Detail Kegiatan Kapal</h2>
          <BackButton onClick={() => navigate(-1)}>
            <FaArrowLeft /> Kembali
          </BackButton>
        </HeaderRow>

        {/* INFO UTAMA */}
        <GridTwo>
          <Card>
            <CardTitle>Informasi Kapal</CardTitle>

            <Info label="Nama Kapal" value={data.namaKapal} />
            <Info label="Branch" value={data.branch} />
            <Info label="Terminal" value={data.terminal} />
            {data.tambatan && (
              <Info label="Tambatan" value={data.tambatan} />
            )}
            <Info label="Shift" value={data.shift} />
            <Info label="Dispatcher" value={data.dispatcherName} />
            <Info
              label="Status"
              value={data.completed ? "SELESAI" : "BERJALAN"}
              badge
            />
          </Card>

          <Card center>
            <img
              src="/images/kapal-side.png"
              alt="Kapal"
              style={{ maxWidth: "100%", height: "auto" }}
            />
          </Card>
        </GridTwo>

        {/* DETAIL MUATAN */}
        <Card>
          <CardTitle>Detail Bongkar Muat</CardTitle>

          <GridThree>
            <Info label="Jenis Barang" value={data.jenisBarang} />
            <Info label="Jenis Kemasan" value={data.jenisKemasan} />
            <Info label="Jumlah Muatan" value={data.jumlahMuatan} />
            <Info
              label="Realisasi B/M"
              value={data.realisasiBongkarMuat}
            />
            <Info label="Perencanaan Shift" value={data.perencanaanShift} />
            <Info label="Realisasi Shift" value={data.realisasiShift} />
          </GridThree>
        </Card>

        {/* GRAFIK */}
        <Card>
          <CardTitle>Status Penyelesaian</CardTitle>

          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis ticks={[0, 1]} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="completed"
                stroke="#0B5ED7"
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </Content>
    </PageWrapper>
  );
}

/* =========================
   KOMPONEN KECIL
========================= */
function Info({ label, value, badge }) {
  return (
    <div>
      <SmallLabel>{label}</SmallLabel>
      <Value
        badge={badge}
        status={value}
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

const SmallLabel = styled.div`
  font-size: 12px;
  color: #6c757d;
`;

const Value = styled.div`
  font-weight: 600;
  color: ${({ badge, status }) =>
    badge
      ? status === "SELESAI"
        ? "#198754"
        : "#ffc107"
      : "#212529"};
`;
