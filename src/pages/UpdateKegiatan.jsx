import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import styled from "styled-components";
import Sidebar from "../components/Sidebar";
import { FaBars, FaSave } from "react-icons/fa";
import axios from "axios";

export default function UpdateKegiatan() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updateIndex, setUpdateIndex] = useState(1);
  const [statusKegiatan, setStatusKegiatan] = useState("");

  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    shift: "",
    realisasiTgh: "",
    ketercapaian: "",
    realisasiBongkarMuat: "",
    completed: "",
    realisasiShift: "",
    notTime: "",
    idleTime: "",
    effectiveTime: "",
    keterangan: "",
    lampiran: "",
  });

  /* ================= FETCH DATA ================= */
  useEffect(() => {
    const fetchData = async () => {
      const ref = doc(db, "laporan", id);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        alert("Data tidak ditemukan");
        navigate("/kegiatan");
        return;
      }

      const d = snap.data();

      // 🔢 tentukan index update berikutnya
      let idx = 1;
      while (d[`createdAt${idx}`]) idx++;
      setUpdateIndex(idx);

      setData(d);
      setLoading(false);
    };

    fetchData();
  }, [id, navigate]);

  /* ================= HANDLER ================= */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleSubmit = async () => {
    // 🔴 VALIDASI WAJIB
    const wajibDiisi = [
      "shift",
      "realisasiTgh",
      "ketercapaian",
      "realisasiBongkarMuat",
      "completed",
      "realisasiShift",
      "notTime",
      "idleTime",
      "effectiveTime",
      "keterangan",
    ];

    for (const key of wajibDiisi) {
      if (!form[key]) {
        alert("Semua field wajib diisi");
        return;
      }
    }

    if (!statusKegiatan) {
      alert("❗ Silakan pilih status kegiatan (Selesai / Belum)");
      return;
    }

    try {
      setUploading(true);
      const ref = doc(db, "laporan", id);

      let lampiranUrl = null;
      
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append(
          "upload_preset",
          process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET,
        );

        const res = await axios.post(
          `https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/image/upload`,
          fd,
        );

        lampiranUrl = res.data.secure_url;
      }

      const payload = {
        [`createdAt${updateIndex}`]: Timestamp.now(),
        [`shift${updateIndex}`]: form.shift,
        [`realisasiTgh${updateIndex}`]: form.realisasiTgh,
        [`ketercapaian${updateIndex}`]: form.ketercapaian,
        [`realisasiBongkarMuat${updateIndex}`]: Number(
          form.realisasiBongkarMuat,
        ),
        [`completed${updateIndex}`]: Number(form.completed),
        [`realisasiShift${updateIndex}`]: Number(form.realisasiShift),
        [`notTime${updateIndex}`]: Number(form.notTime),
        [`idleTime${updateIndex}`]: Number(form.idleTime),
        [`effectiveTime${updateIndex}`]: Number(form.effectiveTime),
        [`keterangan${updateIndex}`]: form.keterangan,

        // ✅ JIKA SELESAI → status false
        ...(statusKegiatan === "SELESAI" && { status: false }),

        ...(lampiranUrl && {
          [`lampiran${updateIndex}`]: [lampiranUrl],
        }),
      };

      await updateDoc(ref, payload);

      alert("✅ Update berhasil disimpan");
      navigate(`/kegiatan/${id}`);
    } catch (err) {
      console.error(err);
      alert("❌ Gagal menyimpan update");
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <p style={{ padding: 24 }}>Loading...</p>;

  return (
    <Page>
      <TopBar>
        <MenuButton onClick={() => setSidebarOpen(!sidebarOpen)}>
          <FaBars />
        </MenuButton>
      </TopBar>

      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <Content>
        <h2>Update Kegiatan Kapal</h2>

        {/* ================= READ ONLY ================= */}
        <Card>
          <Row>
            <Field>
              <label>Nama Kapal</label>
              <input value={data.namaKapal || ""} readOnly />
            </Field>
            <Field>
              <label>Terminal</label>
              <input value={data.terminal || ""} readOnly />
            </Field>
            <Field>
              <label>Branch</label>
              <input value={data.branch || ""} readOnly />
            </Field>
          </Row>
        </Card>

        {/* ================= UPDATE HARIAN ================= */}
        <Card>
          <Row>
            <Field>
              <label>Shift</label>
              <select name="shift" value={form.shift} onChange={handleChange}>
                <option value="">Pilih Shift</option>
                <option value="I (08.00 - 16.00)">
                  Shift I (08.00 - 16.00)
                </option>
                <option value="II (16.00 - 00.00)">
                  Shift II (16.00 - 00.00)
                </option>
                <option value="III (00.00 - 08.00)">
                  Shift III (00.00 - 08.00)
                </option>
              </select>
            </Field>

            <Field>
              <label>Realisasi TGH</label>
              <input
                name="realisasiTgh"
                value={form.realisasiTgh}
                onChange={handleChange}
              />
            </Field>

            <Field>
              <label>Ketercapaian</label>
              <select
                name="ketercapaian"
                value={form.ketercapaian}
                onChange={handleChange}
              >
                <option value="">Pilih</option>
                <option value="TERCAPAI">TERCAPAI</option>
                <option value="TIDAK TERCAPAI">TIDAK TERCAPAI</option>
              </select>
            </Field>
          </Row>

          <Row>
            <Field>
              <label>Realisasi Bongkar/Muat</label>
              <input
                type="number"
                name="realisasiBongkarMuat"
                onChange={handleChange}
              />
            </Field>

            <Field>
              <label>Completed</label>
              <input
                type="number"
                step="0.01"
                name="completed"
                onChange={handleChange}
              />
            </Field>

            <Field>
              <label>Realisasi Shift Saat Ini</label>
              <input
                type="number"
                name="realisasiShift"
                onChange={handleChange}
              />
            </Field>
          </Row>

          <Row>
            <Field>
              <label>Not Time</label>
              <input type="number" name="notTime" onChange={handleChange} />
            </Field>
            <Field>
              <label>Idle Time</label>
              <input type="number" name="idleTime" onChange={handleChange} />
            </Field>
            <Field>
              <label>Effective Time</label>
              <input
                type="number"
                name="effectiveTime"
                onChange={handleChange}
              />
            </Field>
          </Row>

          <Field>
            <label>Keterangan</label>
            <textarea name="keterangan" onChange={handleChange} />
          </Field>

          <Field>
            <label>Status Kegiatan Kapal</label>

            <div style={{ display: "flex", gap: "24px", marginTop: "8px" }}>
              <label>
                <input
                  type="radio"
                  name="statusKegiatan"
                  value="SELESAI"
                  checked={statusKegiatan === "SELESAI"}
                  onChange={(e) => setStatusKegiatan(e.target.value)}
                />
                Selesai
              </label>

              <label>
                <input
                  type="radio"
                  name="statusKegiatan"
                  value="BELUM"
                  checked={statusKegiatan === "BELUM"}
                  onChange={(e) => setStatusKegiatan(e.target.value)}
                />
                Belum
              </label>
            </div>
          </Field>
          <Field>
            <label>Lampiran Dokumentasi</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files[0])}
            />
          </Field>
        </Card>

        <SaveButton onClick={handleSubmit} disabled={uploading}>
          <FaSave /> {uploading ? "Mengunggah..." : "Simpan Update"}
        </SaveButton>
      </Content>
    </Page>
  );
}

/* ================= STYLES ================= */

const Page = styled.div`
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

const Card = styled.div`
  background: #fff;
  padding: 24px;
  border-radius: 10px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);

  h3 {
    margin-bottom: 16px;
    color: #002b5b;
  }
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 12px;

  label {
    font-size: 12px;
    color: #6c757d;
    margin-bottom: 4px;
  }

  input,
  textarea {
    padding: 8px;
    border-radius: 6px;
    border: 1px solid #ccc;
  }

  textarea {
    min-height: 80px;
  }
`;

const SaveButton = styled.button`
  background: #198754;
  color: #fff;
  border: none;
  padding: 10px 18px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    background: #157347;
  }
`;