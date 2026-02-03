import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import styled from "styled-components";
import { serverTimestamp } from "firebase/firestore";

function generateSchedule({
  selectedHolds,
  holdBL,
  dischRate,
  totalGang,
  commDisch,
}) {
  if (!dischRate || !totalGang) return [];

  const ratePerGang = dischRate / totalGang;

  // offset start hour berdasarkan ETC
  const baseHour = commDisch ? commDisch.getHours() : 0;

  let time = 0;
  let queue = [...selectedHolds];
  let active = [];
  let schedule = [];

  while (queue.length > 0 || active.length > 0) {
    while (active.length < totalGang && queue.length > 0) {
      const hold = queue.shift();
      const bl = Number(holdBL[hold] || 0);
      const duration = Math.max(1, Math.ceil(bl / ratePerGang));

      active.push({
        hold,
        remaining: duration,
        start: time,
        duration,
      });
    }

    active.forEach((job) => {
      job.remaining -= 1;
    });

    time++;

    active = active.filter((job) => {
      if (job.remaining <= 0) {
        schedule.push({
          hold: job.hold,
          startHour: baseHour + job.start,
          endHour: baseHour + time,
          duration: job.duration,
        });
        return false;
      }
      return true;
    });
  }

  schedule.sort((a, b) => a.startHour - b.startHour);
  return schedule;
}

function getActiveHoldAtHour(schedule, hour) {
  return schedule.find((s) => hour >= s.startHour && hour < s.endHour)?.hold;
}

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

const ROW_HEIGHT = 18; // px (harus sama dengan HoldRow)
const DATE_WIDTH = 36;

export default function PlannerForm() {
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [laporan, setLaporan] = useState(null);
  const [saving, setSaving] = useState(false);
  // planner input
  const [selectedHolds, setSelectedHolds] = useState([]);
  const [totalGang, setTotalGang] = useState("");
  const [dischRate, setDischRate] = useState("");
  const [schedule, setSchedule] = useState([]);

  const [holdBL, setHoldBL] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      const ref = doc(db, "laporan", id);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const data = snap.data();
        setLaporan({ id: snap.id, ...data });

        // 🔥 HYDRATE PLANNING STATE
        if (data.planning) {
          setSelectedHolds(data.planning.selectedHolds || []);
          setTotalGang(data.planning.totalGang ?? "");
          setDischRate(data.planning.dischRate ?? "");
          setHoldBL(data.planning.holdBL || {});
        }
      }

      setLoading(false);
    };

    fetchData();
  }, [id]);

  useEffect(() => {
    if (!laporan) return;

    if (laporan.planning?.schedule) {
      setSchedule(laporan.planning.schedule);
    } else {
      const auto = generateSchedule({
        selectedHolds,
        holdBL,
        dischRate,
        totalGang,
        commDisch: laporan.commDisch?.toDate(),
      });
      setSchedule(auto);
    }
  }, [laporan]);

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
  const totalDisch = laporan.totalDischarge;

  const totalDischarge = Object.keys(laporan)
    .filter((key) => key.startsWith("completed"))
    .reduce((sum, key) => sum + (laporan[key] || 0), 0);

  const totalMuatan = Number(laporan.jumlahMuatan);

  const cargoROB = Math.max(totalMuatan - totalDischarge, 0);

  const lastActiveHour = schedule.length
    ? Math.max(...schedule.map((s) => s.endHour))
    : 24;

  // hitung sampai akhir hari terakhir
  const totalRenderHour = Math.ceil(lastActiveHour / 24) * 24;

  const hours = Array.from(
    { length: totalRenderHour },
    (_, i) => `${String(i % 24).padStart(2, "0")}:00`,
  );

  const handleSave = async () => {
    try {
      setSaving(true);

      const ref = doc(db, "laporan", id);

      await updateDoc(ref, {
        planning: {
          selectedHolds,
          totalGang: Number(totalGang),
          dischRate: Number(dischRate),
          holdBL,
          schedule,
          estimatedHour,
        },
        planningUpdatedAt: serverTimestamp(),
      });

      alert("Planning berhasil disimpan ✅");
    } catch (err) {
      console.error(err);
      alert("Gagal menyimpan planning ❌");
    } finally {
      setSaving(false);
    }
  };

  const baseHour = laporan.commDisch?.toDate()?.getHours() || 0;

  const estimatedHour = schedule.length
    ? Math.max(...schedule.map((s) => s.endHour)) - baseHour
    : 0;

  console.log("selectedHolds", selectedHolds);
  console.log("holdBL", holdBL);
  console.log("schedule", schedule);
  return (
    <Wrapper>
      {/* ================= HEADER ================= */}
      <Section>
        <HeaderSection>
          <MainTitle>CRANE WORKING PROGRAMME</MainTitle>

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
                <label>TOTAL B/L</label>
                <span>{laporan.jumlahMuatan || "-"}</span>
              </InfoRow>

              <InfoRow>
                <label>TOTAL DISCHARGE</label>
                <span>{totalDischarge}</span>
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
                <label>PPK</label>
                <span>{laporan.ppk || "-"}</span>
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
                <span>{formatDateTime(laporan.commDisch)}</span>
              </InfoRow>

              <InfoRow>
                <label>CARGO ROB</label>
                <span>{cargoROB}</span>
              </InfoRow>
            </InfoColumn>
          </InfoGrid>
        </HeaderSection>
      </Section>
      {/* ================= PARAMETER ================= */}
      <Section>
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
              onChange={(e) => {
                const value = e.target.value;
                setTotalGang(value === "" ? "" : Number(value));
              }}
            />
          </InfoBox>

          <InfoBox>
            <label>Total Working Hour</label>
            <span>{estimatedHour} Jam</span>
          </InfoBox>
        </Grid>
        <SaveBar>
          <SaveButton onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "💾 Simpan"}
          </SaveButton>
        </SaveBar>
      </Section>

      <Section>
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
                  {selectedHolds.includes(h) && (
                    <input
                      type="number"
                      placeholder="MT"
                      value={holdBL[h] || ""}
                      onChange={(e) =>
                        setHoldBL((prev) => ({
                          ...prev,
                          [h]: Number(e.target.value),
                        }))
                      }
                    />
                  )}
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

          const isNewDay = i % 24 === 0;
          const dayOffset = Math.floor(i / 24);
          const currentDate = new Date(comDiscDate);
          currentDate.setDate(currentDate.getDate() + dayOffset);

          const isNewShift = hour === 0 || hour === 8 || hour === 16;

          return (
            <PlannerRow key={i}>
              {/* ================= KIRI ================= */}
              <LeftHeader>
                {/* SLOT DATE (kosong tapi konsisten tinggi) */}
                <DateBox />

                {/* DATE MERGED — hanya di jam pertama */}
                {isNewDay && (
                  <DateBoxMerged rows={26.5} rowHeight={ROW_HEIGHT}>
                    <VerticalDate>
                      {currentDate.toLocaleDateString("id-ID", {
                        weekday: "short",
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </VerticalDate>
                  </DateBoxMerged>
                )}

                {/* SHIFT */}
                <ShiftBox>{isNewShift ? getShift(hour) : ""}</ShiftBox>

                {/* TIME */}
                <TimeBox bordered>{time}</TimeBox>
              </LeftHeader>

              {/* ================= KANAN ================= */}
              <RightTable>
                <HoldRowCompact>
                  <HoldLabel />

                  {[7, 6, 5, 4, 3, 2, 1].map((h) => {
                    const activeHolds = schedule
                      .filter((s) => i >= s.startHour && i < s.endHour)
                      .map((s) => s.hold);

                    return (
                      <HoldCellCompact
                        key={h}
                        active={activeHolds.includes(h)}
                      />
                    );
                  })}
                </HoldRowCompact>
              </RightTable>
            </PlannerRow>
          );
        })}
      </Section>
    </Wrapper>
  );
}

/* ===================== STYLES ===================== */
const HoldRowCompact = styled.div`
  display: grid;
  grid-template-columns: 140px repeat(7, 1fr);
  height: ${ROW_HEIGHT}px;
  min-height: 18px;
`;

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
  position: relative;
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

const HoldCellCompact = styled(HoldCell)`
  height: 8px;
  padding: 0;
`;

const SmallBox = styled.div`
  width: 50px;
  font-size: 10px;
  text-align: center;
  color: #555;
`;

const DateBox = styled.div`
  width: 40px;
  height: ${ROW_HEIGHT}px;
`;

const DateBoxMerged = styled.div`
  position: absolute;
  top: 0;
  left: 0;

  width: ${DATE_WIDTH}px;
  height: ${({ rows, rowHeight }) => rows * rowHeight}px;

  display: flex;
  align-items: center;
  justify-content: center;

  z-index: 2;
  background: #f7f7f7;
`;

const ShiftBox = styled.div`
  flex: 1;
  height: ${ROW_HEIGHT}px;
  font-size: 10px;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: 1px solid #ccc;
`;

const TimeBox = styled.div`
  flex: 1;
  height: ${ROW_HEIGHT}px;
  font-size: 11px;
  font-weight: 500;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid #ccc;
`;

const VerticalDate = styled.div`
  transform: rotate(-90deg);
  transform-origin: center;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  line-height: 1;
  text-align: center;
`;

const SaveBar = styled.div`
  position: sticky;
  top: 8px;
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
  z-index: 10;
`;

const SaveButton = styled.button`
  background: #003fc7;
  color: white;
  border: none;
  padding: 10px 16px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;