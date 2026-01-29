// src/pages/PlannerForm.jsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import styled from "styled-components";

/* ==================================================
   PLANNER FORM (VERSI AWAL / DASAR)
   Target:
   - Mirip konsep CWP PDF
   - Pelan-pelan dibangun
   ================================================== */

const generateHours = () => {
  const hours = [];
  for (let i = 0; i < 24; i++) {
    hours.push(`${String(i).padStart(2, "0")}:00`);
  }
  return hours;
};

const hours = generateHours();
const getShift = (hour) => {
  if (hour >= 0 && hour < 8) return "III";
  if (hour >= 8 && hour < 16) return "I";
  return "II";
};

const getShiftBlock = (hour) => {
  if (hour >= 0 && hour < 8) return 8;
  if (hour >= 8 && hour < 16) return 8;
  return 8;
};

const shiftRanges = {
  0: 8,
  8: 8,
  16: 8,
};


export default function PlannerForm() {
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [laporan, setLaporan] = useState(null);

  // planner input
  const [selectedHolds, setSelectedHolds] = useState([]);
  const [dischRate, setDischRate] = useState();
  const [totalGang, setTotalGang] = useState();

  useEffect(() => {
    const fetchData = async () => {
      const ref = doc(db, "laporan", id);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        setLaporan({ id: snap.id, ...snap.data() });
      }

      setLoading(false);
    };

    fetchData();
  }, [id]);
  const ROW_HEIGHT = 36; // px (harus sama dengan HoldRow)

  const toggleHold = (hold) => {
    setSelectedHolds((prev) => {
      if (prev.includes(hold)) {
        // hapus → urutan otomatis menyesuaikan
        return prev.filter((h) => h !== hold);
      }
      return [...prev, hold];
    });
  };

  if (loading) return <p>Memuat planner...</p>;
  if (!laporan) return <p>Data tidak ditemukan</p>;

  const comDiscDate = laporan.startDL?.toDate();

  // contoh perhitungan dasar
  const totalDisch = laporan.totalDischarge || 0;
  const estimatedHour =
    totalDisch && dischRate && totalGang
      ? Math.ceil(totalDisch / (dischRate * totalGang))
      : 0;

  return (
    <Wrapper>
      {/* ================= HEADER ================= */}
      <Section>
        <HeaderSection>
          <MainTitle>HMC WORKING PROGRAMME</MainTitle>

          <InfoGrid>
            {/* ================= KOLOM 1 ================= */}
            <InfoColumn>
              <InfoRow>
                <label>VESSEL NAME</label>
                <span>{laporan.namaKapal}</span>
              </InfoRow>

              <InfoRow>
                <label>ATA</label>
                <span>{formatDateTime(laporan.ata)}</span>
              </InfoRow>

              <InfoRow>
                <label>ETC</label>
                <span>{formatDateTime(laporan.etc)}</span>
              </InfoRow>

              <InfoRow>
                <label>PORT OF DISCHARGE</label>
                <span>{laporan.terminal}</span>
              </InfoRow>

              <InfoRow>
                <label>DISCHARGE STATUS</label>
                <span>{laporan.dischargeStatus || "-"}</span>
              </InfoRow>

              <InfoRow>
                <label>TOTAL B/L</label>
                <span>{laporan.totalBL || "-"}</span>
              </InfoRow>

              <InfoRow>
                <label>TOTAL DISCHARGE</label>
                <span>{laporan.totalDischarge || 0}</span>
              </InfoRow>
            </InfoColumn>

            {/* ================= KOLOM 2 ================= */}
            <InfoColumn>
              <InfoRow>
                <label>DATE</label>
                <span>
                  {new Date().toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </InfoRow>

              <InfoRow>
                <label>VOYAGE NO</label>
                <span>{laporan.voyage || "-"}</span>
              </InfoRow>

              <InfoRow>
                <label>ETB</label>
                <span>{formatDateTime(laporan.etb)}</span>
              </InfoRow>

              <InfoRow>
                <label>ETD</label>
                <span>{formatDateTime(laporan.etd)}</span>
              </InfoRow>

              <InfoRow>
                <label>Com Disc</label>
                <span>{formatDateTime(laporan.commenceDischarge)}</span>
              </InfoRow>

              <InfoRow>
                <label>CARGO ROB</label>
                <span>{laporan.cargoROB || "-"}</span>
              </InfoRow>
            </InfoColumn>
          </InfoGrid>
        </HeaderSection>
      </Section>
      {/* ================= PARAMETER ================= */}
      <Section>
        <Title>Parameter Discharging</Title>

        <Grid>
          <InfoBox>
            <label>Discharging Rate (MT / Jam)</label>
            <input
              type="number"
              value={dischRate}
              onChange={(e) => setDischRate(Number(e.target.value))}
            />
          </InfoBox>

          <InfoBox>
            <label>Total Gang</label>
            <input
              type="number"
              value={totalGang}
              onChange={(e) => setTotalGang(Number(e.target.value))}
            />
          </InfoBox>

          <InfoBox>
            <label>Total Working Hour</label>
            <span>{estimatedHour} Jam</span>
          </InfoBox>
        </Grid>
      </Section>

      <Section>
        <Title>HMC WORKING PROGRAMME – HOLD PLAN</Title>

        <PlannerRow>
          {/* ================= KIRI ================= */}
          <LeftHeader>
            <VerticalBox>DATE</VerticalBox>
            <VerticalBox>SHIFT</VerticalBox>
            <VerticalBox>TIME</VerticalBox>
          </LeftHeader>

          {/* ================= KANAN ================= */}
          <RightTable>
            {/* HEADER PALKA */}
            <HoldHeaderRow>
              <HoldHeader remarks>REMARKS</HoldHeader>

              {[7, 6, 5, 4, 3, 2, 1].map((h) => {
                const order = selectedHolds.indexOf(h);

                return (
                  <HoldHeader
                    key={h}
                    active={order !== -1}
                    onClick={() => toggleHold(h)}
                  >
                    CH. {h}
                    {order !== -1 && <OrderBadge>{order + 1}</OrderBadge>}
                  </HoldHeader>
                );
              })}
            </HoldHeaderRow>

            <HoldRow>
              <HoldLabel>TOTAL B/L</HoldLabel>
              {[7, 6, 5, 4, 3, 2, 1].map((h) => (
                <HoldCell key={h} active={selectedHolds.includes(h)}>
                  {selectedHolds.includes(h) && <input placeholder="MT" />}
                </HoldCell>
              ))}
            </HoldRow>

            <HoldRow>
              <HoldLabel>COMMODITY</HoldLabel>
              {[7, 6, 5, 4, 3, 2, 1].map((h) => (
                <HoldCell key={h} active={selectedHolds.includes(h)}>
                  {selectedHolds.includes(h) && <input placeholder="Corn" />}
                </HoldCell>
              ))}
            </HoldRow>

            <HoldRow>
              <HoldLabel>STORAGE</HoldLabel>
              {[7, 6, 5, 4, 3, 2, 1].map((h) => (
                <HoldCell key={h} active={selectedHolds.includes(h)}>
                  {selectedHolds.includes(h) && <input placeholder="SILO" />}
                </HoldCell>
              ))}
            </HoldRow>
          </RightTable>
        </PlannerRow>
        {/* ================= TIME TABLE ================= */}
        {hours.map((time, i) => {
          const hour = parseInt(time.split(":")[0]);

          const isNewDay = i === 0;
          const isNewShift = hour === 0 || hour === 8 || hour === 16;

          return (
            <PlannerRow key={i}>
              {/* ================= KIRI ================= */}
              <LeftHeader>
                {/* DATE */}
                <DateBox>
                  {isNewDay
                    ? comDiscDate.toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })
                    : ""}
                </DateBox>

                {/* SHIFT */}
                <ShiftBox>{isNewShift ? getShift(hour) : ""}</ShiftBox>

                {/* TIME */}
                <TimeBox bordered>{time}</TimeBox>
              </LeftHeader>

              {/* ================= KANAN ================= */}
              <RightTable>
                <HoldRow>
                  <HoldLabel />

                  {[7, 6, 5, 4, 3, 2, 1].map((h) => (
                    <HoldCell key={h} />
                  ))}
                </HoldRow>
              </RightTable>
            </PlannerRow>
          );
        })}
      </Section>
    </Wrapper>
  );
}

/* ===================== STYLES ===================== */

const formatDateTime = (value) => {
  if (!value) return "-";

  // Firestore Timestamp
  if (value?.toDate) {
    return value.toDate().toLocaleString("id-ID");
  }

  // JS Date
  if (value instanceof Date) {
    return value.toLocaleString("id-ID");
  }

  // String biasa
  return value;
};

const Wrapper = styled.div`
  padding: 24px;
  background: #f5f7fa;
`;

const Section = styled.div`
  background: #fff;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 20px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
`;

const Title = styled.h3`
  margin-bottom: 12px;
  color: #002b5b;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
`;

const InfoBox = styled.div`
  display: flex;
  flex-direction: column;

  label {
    font-size: 12px;
    color: #666;
  }

  span {
    font-weight: 600;
    margin-top: 4px;
  }

  input {
    margin-top: 4px;
    padding: 6px;
    border-radius: 6px;
    border: 1px solid #ccc;
  }
`;

const HoldsWrapper = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
`;

const HoldBox = styled.div`
  width: 90px;
  height: 70px;
  border-radius: 8px;
  border: 2px solid ${(p) => (p.active ? "#0b5ed7" : "#ccc")};
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  cursor: pointer;
  position: relative;
  background: ${(p) => (p.active ? "#e7f1ff" : "#fff")};
`;

const TimeTable = styled.div`
  border: 1px solid #ddd;
  border-radius: 6px;
  overflow: hidden;
`;

const HeaderSection = styled.div`
  margin-bottom: 24px;
`;

const MainTitle = styled.h2`
  text-align: center;
  color: #002b5b;
  margin-bottom: 20px;
  letter-spacing: 1px;
`;

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
`;

const InfoColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const InfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 13px;

  label {
    font-weight: 600;
    color: #333;
    min-width: 160px;
  }

  span {
    color: #000;
    text-align: right;
  }
`;

const TimeTableGrid = styled.div`
  border: 1px solid #aaa;
`;

const TimeRow = styled.div`
  border-bottom: 1px solid #ddd;
  padding: 6px 10px;
  font-size: 13px;
`;

const TimeHeader = styled.div`
  width: 36px;
  border: 1px solid #999;
  background: #d9d9d9;

  display: flex;
  align-items: center;
  justify-content: center;

  font-weight: 700;
  font-size: 12px;

  /* INI KUNCINYA */
  writing-mode: vertical-rl;

  letter-spacing: 2px;
`;

const TimeCell = styled.div`
  border: 1px solid #ddd;
  background: #fafafa;
`;

const OrderBadge = styled.div`
  position: absolute;
  top: -6px;
  right: -6px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #002b5b;
  color: #fff;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

/* animasi klik */
const pulse = `
@keyframes pulse {
  0% { transform: scale(0.95); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}`;

const PlannerWrapper = styled.div`
  display: flex;
  align-items: stretch;
`;

const LeftVerticalHeader = styled.div`
  width: 36px;
  border: 1px solid #999;
  background: #e0e0e0;
  display: flex;
  flex-direction: column;
`;

const VerticalText = styled.div`
  flex: 1;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  text-align: center;
  font-weight: 700;
  font-size: 12px;
  border-bottom: 1px solid #999;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const HoldGrid = styled.div`
  display: grid;
  grid-template-columns: 140px repeat(7, 1fr);
  border-bottom: 1px solid #999;
`;

const PlannerRow = styled.div`
  display: flex;
  align-items: stretch;
`;

const LeftHeader = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 36px);
  border: 1px solid #999;
  background: #e5e5e5;
`;

const VerticalBox = styled.div`
  writing-mode: vertical-rl;
  transform: rotate(180deg);

  font-weight: 700;
  font-size: 12px;

  display: flex;
  align-items: center;
  justify-content: center;

  border-right: 1px solid #999;
`;

/* kanan */
const RightTable = styled.div`
  flex: 1;
  border: 1px solid #999;
`;

const HoldHeaderRow = styled.div`
  display: grid;
  grid-template-columns: 140px repeat(7, 1fr);
  background: #f0f0f0;
`;

const HoldRow = styled.div`
  display: grid;
  grid-template-columns: 140px repeat(7, 1fr);
`;

const HoldHeader = styled.div`
  position: relative; /* 🔥 INI KUNCINYA */

  padding: 8px 6px;
  font-weight: 700;
  text-align: center;
  border-right: 1px solid #aaa;
  cursor: pointer;

  background: ${(p) => (p.active ? "#f7c948" : "#eaeaea")};
  transition: all 0.25s ease;

  &:hover {
    background: ${(p) => (p.active ? "#f4b400" : "#d6d6d6")};
  }
`;

const HoldLabel = styled.div`
  padding: 6px;
  font-weight: 600;
  background: #f7f7f7;
  border-right: 1px solid #ccc;
`;

const HoldCell = styled.div`
  border: 1px dashed #bbb;
  min-height: 36px;
  padding: 4px;
  background: ${(p) => (p.active ? "#fff8cc" : "#fafafa")};
  transition: all 0.2s ease;

  display: flex;
  align-items: center;
  justify-content: center;

  ${(p) =>
    p.active &&
    `
    border: 2px solid #f4b400;
    box-shadow: inset 0 0 0 1px #f4b400;
  `}

  input {
    width: 100%;
    border: none;
    background: transparent;
    text-align: center;
    font-size: 12px;
    font-weight: 600;
    outline: none;
  }
`;

const SmallBox = styled.div`
  width: 50px;
  font-size: 10px;
  text-align: center;
  color: #555;
`;

const DateBox = styled.div`
  flex: 1;
  font-size: 10px;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: 1px solid #ccc;
`;

const ShiftBox = styled.div`
  flex: 1;
  font-size: 10px;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: 1px solid #ccc;
`;

const TimeBox = styled.div`
  flex: 1;
  font-size: 11px;
  font-weight: 500;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid #ccc;
`;
