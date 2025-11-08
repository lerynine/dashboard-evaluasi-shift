import { useState, useEffect } from "react";
import styled from "styled-components";
import { FaBars, FaTimes } from "react-icons/fa";
import Sidebar from "../components/Sidebar";
import axios from "axios";
import { db } from "../firebase";
import {
  doc,
  updateDoc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

export default function InputPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [formData, setFormData] = useState({});
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [berthData, setBerthData] = useState({});
  const [berthLoading, setBerthLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    const { name, value, type } = e.target;

    // reset pilihan berth jika terminal berubah
    if (name === "terminal") {
      setFormData((prev) => ({ ...prev, [name]: value, tambatan: "" }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: type === "number" ? Number(value) : value,
      }));
    }
  };

  const handleFileChange = (e) => setFile(e.target.files[0]);

  // 🔹 Ambil daftar field dari dokumen berth/{terminal}
  useEffect(() => {
    const fetchBerthData = async () => {
      if (!formData.terminal) {
        setBerthData({});
        return;
      }

      setBerthLoading(true);
      try {
        const docRef = doc(db, "berth", formData.terminal);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setBerthData(snap.data());
        } else {
          setBerthData({});
        }
      } catch (err) {
        console.error("Error fetching berth data:", err);
        setBerthData({});
      } finally {
        setBerthLoading(false);
      }
    };

    fetchBerthData();
  }, [formData.terminal]);

  const handleSubmit = async (e) => {
  e.preventDefault();

  // 🔹 Validasi angka decimal
  const decimalFields = ["jumlahMuatan", "realisasiBongkar", "perencanaanShift", "realisasiShift"];
  for (let field of decimalFields) {
    const value = formData[field];
    // Ganti koma dengan titik untuk parsing
    const normalized = value?.toString().replace(",", ".");
    if (value === undefined || value === "" || isNaN(Number(normalized))) {
      alert(`Kolom "${field}" harus berupa angka desimal yang valid!\nContoh: 100, 150.5`);
      return; // hentikan submit
    } else {
      // simpan kembali sebagai number dengan titik
      formData[field] = Number(normalized);
    }
  }

  setLoading(true);

  try {
    let imageUrl = "";

    if (file) {
      const formDataCloud = new FormData();
      formDataCloud.append("file", file);
      formDataCloud.append(
        "upload_preset",
        process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET
      );

      const res = await axios.post(
        `https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/image/upload`,
        formDataCloud
      );
      imageUrl = res.data.secure_url;
    }

    const finalJenisKemasan =
      formData.jenisKemasan === "Yang lain..."
        ? formData.jenisKemasanLain || "Lain-lain"
        : formData.jenisKemasan;

    await addDoc(collection(db, "laporan"), {
      ...formData,
      jenisKemasan: finalJenisKemasan,
      lampiran: imageUrl || null,
      createdAt: serverTimestamp(),
    });

    const terminalName = formData.terminal;
    const berthField = formData.tambatan?.toLowerCase();
    const shipName = formData.namaKapal;

    if (terminalName && berthField && shipName) {
      const berthDocRef = doc(db, "berth", terminalName);
      const berthSnap = await getDoc(berthDocRef);

      if (berthSnap.exists()) {
        await updateDoc(berthDocRef, { [berthField]: shipName });
      } else {
        await setDoc(berthDocRef, { [berthField]: shipName });
      }
    }

    setFormData({});
    setFile(null);
    setSubmitted(true);
  } catch (err) {
    console.error("Error upload:", err);
    alert("Gagal menyimpan data!");
  } finally {
    setLoading(false);
  }
};



  return (
    <PageWrapper>
      <TopBar>
        <MenuButton onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <FaTimes /> : <FaBars />}
        </MenuButton>
        <Title>Formulir Serah Terima Shift Dispatcher Janira</Title>
      </TopBar>

      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <Content onClick={() => sidebarOpen && setSidebarOpen(false)}>
        <FormWrapper>
          {submitted ? (
            <CompletionWrapper>
              <h2>Terima kasih! Formulir telah berhasil disimpan.</h2>
              <p>
                <button onClick={() => setSubmitted(false)}>Kirim Formulir Lagi</button>
              </p>
            </CompletionWrapper>
          ) : (
            <>
          <FormHeader>
            <h1>Formulir Serah Terima Shift Dispatcher Janira</h1>
            <Description>
              <strong>Petunjuk Pengisian:</strong>
              <ol>
                <li>
                  Petugas dispatcher per shift dibagi menjadi PIC dari keseluruhan kapal yang
                  berkegiatan untuk PBM SPMT dan NON SPMT dengan mengisikan nama pada kolom
                  nama dispatcher;
                </li>
                <li>
                  Untuk dispatcher Nilam/Mirah berkoordinasi dengan foreman untuk pengisian remark;
                </li>
                <li>
                  PIC Dispatcher akan membantu memberikan informasi dan konfirmasi terkait
                  jalannya kegiatan B/M saat dilakukan evaluasi kinerja;
                </li>
                <li>
                  Kolom "Remark" diisi dengan informasi lain yang belum termuat pada time sheet,
                  contoh case:
                  <ul>
                    <li>
                      a. Kegiatan bongkar mencapai target dikarenakan kapal memiliki shipcrane
                      dengan SWL yang besar dan kondisi baik (dilampirkan komunikasi dengan PBM /
                      foto kondisi crane);
                    </li>
                    <li>
                      b. Kegiatan bongkar tidak mencapai target dikarenakan proses cleaning yang
                      lama disebabkan kondisi dinding palka banyak terdapat gading - gading
                      (dilampirkan foto kondisi gading - gading dalam palka);
                    </li>
                    <li>
                      c. Kapal pada malam hari belum berkegiatan dikarenakan kegiatan ship to ship
                      untuk ijin berkegiatan di siang hari;
                    </li>
                  </ul>
                </li>
                <li>
                  Apabila pada shift tersebut kapal telah selesai berkegiatan namun tetap berada di
                  dermaga, agar dilakukan monitoring dan klarifikasi kepada PBM/agent untuk kapal
                  yang tidak kunjung berangkat dan dimasukkan ke dalam kolom remark; contoh:
                  <ul>
                    <li>a. Kapal belum berangkat dikarenakan kerusakan mesin;</li>
                    <li>b. Kapal belum berangkat dikarenakan proses lasing;</li>
                  </ul>
                </li>
                <li>
                  Disertakan lampiran, time sheet PBM, komunikasi WA, foto, screenshot tampilan
                  CCTV atau dokumen lainnya untuk mendukung keterangan pada kolom remark;
                </li>
                <li>
                  Akan dilakukan monitoring dan evaluasi terhadap ketertiban petugas dispatcher
                  dalam pengisian form;
                </li>
                <li>
                  Target Kinerja (RKAP) sebagai berikut:
                  <ul>
                    <li>
                      <strong>Terminal Jamrud:</strong>
                      <ul>
                        <li>a. Petikemas BCH : 13</li>
                        <li>b. General Cargo TGH : 153,49</li>
                        <li>c. Curah Kering TGH : 140,13</li>
                        <li>d. Curah Cair TGH : 137,25</li>
                      </ul>
                    </li>
                    <li>
                      <strong>Nilam Mirah:</strong>
                      <ul>
                        <li>a. General Cargo TGH : 43,5</li>
                        <li>b. Curah Kering TGH : 271,60</li>
                        <li>c. Curah Cair TGH : 187,46</li>
                      </ul>
                    </li>
                  </ul>
                </li>
              </ol>
            </Description>
          </FormHeader>

          <Form onSubmit={handleSubmit}>
            <Question>
              <Label>
                Terminal <span className="required">*</span>
              </Label>
              <select name="terminal" onChange={handleChange} required>
                <option value="">Pilih</option>
                <option>Jamrud Utara</option>
                <option>Jamrud Selatan</option>
                <option>Jamrud Barat</option>
                <option>Nilam Selatan</option>
                <option>Nilam Utara</option>
                <option>Mirah Selatan</option>
                <option>Mirah Timur</option>
              </select>
            </Question>

            <Question>
              <Label>Tambatan <span className="required">*</span></Label>
              {formData.terminal ? (
                berthLoading ? (
                  <p>Memuat data berth...</p>
                ) : Object.keys(berthData).length > 0 ? (
                  <select
                    name="tambatan"
                    onChange={handleChange}
                    required
                  >
                    <option value="">Pilih Tambatan</option>
                    {Object.entries(berthData)
                      .sort(([keyA], [keyB]) => {
                        // Ekstrak angka dari nama berth, misal 'berth 12'
                        const numA = parseInt(keyA.match(/\d+/)?.[0] || 0, 10);
                        const numB = parseInt(keyB.match(/\d+/)?.[0] || 0, 10);
                        return numA - numB;
                      })
                      .map(([key, value]) => (
                        <option key={key} value={key} disabled={Boolean(value)}>
                          {key.toUpperCase()} {value ? `(${value})` : ""}
                        </option>
                      ))}
                  </select>
                ) : (
                  <p>Tidak ada data berth untuk terminal ini.</p>
                )
              ) : (
                <DisabledNotice>
                  Pilih terminal terlebih dahulu untuk menampilkan daftar tambatan.
                </DisabledNotice>
              )}
            </Question>

            <Question>
              <Label>Nama Dispatcher <span className="required">*</span></Label>
              <input name="dispatcher" onChange={handleChange} required />
            </Question>

            <Question>
              <Label>Shift <span className="required">*</span></Label>
              <SelectGroup>
                {["I (08.00 - 16.00)", "II (16.00 - 00.00)", "III (00.00 - 08.00)"].map((s) => (
                  <label key={s}>
                    <input type="radio" name="shift" value={s} onChange={handleChange} required /> Shift {s}
                  </label>
                ))}
              </SelectGroup>
            </Question>

            <Question>
              <Label>Grup <span className="required">*</span></Label>
              <SelectGroup>
                {["A", "B", "C", "D"].map((g) => (
                  <label key={g}>
                    <input type="radio" name="grup" value={g} onChange={handleChange} required /> {g}
                  </label>
                ))}
              </SelectGroup>
            </Question>

            <Question>
              <Label>Nama Kapal <span className="required">*</span></Label>
              <input name="namaKapal" onChange={handleChange} required />
            </Question>

            {/* Informasi Dokumen & Waktu Kapal */}
            <Question>
              <Label>SPMK</Label>
              <input name="spmk" onChange={handleChange}/>
            </Question>

            <Question>
              <Label>PPK</Label>
              <input name="ppk" onChange={handleChange}/>
            </Question>

            <Question>
              <Label>Agent / Stevedore</Label>
              <input name="agentStevedore" onChange={handleChange}/>
            </Question>

            <Question>
              <Label>ETB (Estimated Time Berth)</Label>
              <input type="datetime-local" name="etb" onChange={handleChange} />
            </Question>

            <Question>
              <Label>ETD (Estimated Time Departure)</Label>
              <input type="datetime-local" name="etd" onChange={handleChange} />
            </Question>

            <Question>
              <Label>Activity Type</Label>
              <select name="activityType" onChange={handleChange}>
                <option value="">Pilih Aktivitas</option>
                <option value="DISCHARGE">DISCHARGE</option>
                <option value="LOAD">LOAD</option>
              </select>
            </Question>

            <Question>
              <Label>Equipment</Label>
              <input name="equipment" onChange={handleChange} placeholder="Contoh: SHIP CRANE / HMC / DUCTING TO TNU" />
            </Question>

            {/* Efisiensi Waktu Kerja */}
            <Question>
              <Label>Not Time (Jam)</Label>
              <input type="number" name="not_time_hours" onChange={handleChange} min="0" step="0.1" placeholder="Contoh: 0" />
            </Question>

            <Question>
              <Label>Idle Time (Jam)</Label>
              <input type="number" name="idle_time_hours" onChange={handleChange} min="0" step="0.1" placeholder="Contoh: 0" />
            </Question>

            <Question>
              <Label>Effective Time (Jam)</Label>
              <input type="number" name="effective_time_hours" onChange={handleChange} min="0" step="0.1" placeholder="Contoh: 0" />
            </Question>

            <Question>
              <Label>Jenis Kemasan <span className="required">*</span></Label>
              <SelectGroup>
                {[
                  "CURAH KERING",
                  "CURAH CAIR",
                  "GENERAL CARGO - STEEL PRODUCT",
                  "GENERAL CARGO - JUMBO BAG",
                  "GENERAL CARGO - BAG",
                  "GENERAL CARGO - KELONTONG",
                  "Yang lain...",
                ].map((item) => (
                  <label key={item} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input
                      type="radio"
                      name="jenisKemasan"
                      value={item}
                      onChange={handleChange}
                      required
                    />
                    {item === "Yang lain..." ? (
                      <>
                        {item}
                        {formData.jenisKemasan === "Yang lain..." && (
                          <input
                            type="text"
                            placeholder="Tulis jenis kemasan..."
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                jenisKemasanLain: e.target.value,
                              }))
                            }
                            style={{
                              border: "none",
                              borderBottom: "2px solid #dadce0",
                              outline: "none",
                              padding: "4px",
                              fontSize: "14px",
                              width: "200px",
                            }}
                          />
                        )}
                      </>
                    ) : (
                      item
                    )}
                  </label>
                ))}
              </SelectGroup>
            </Question>


            <Question>
              <Label>Jenis Barang <span className="required">*</span></Label>
              <input name="jenisBarang" onChange={handleChange} required />
            </Question>

            <Question>
              <Label>Realisasi TGH <span className="required">*</span></Label>
              <input
                type="text"
                name="realisasiTgh"
                onChange={handleChange}
                required
                pattern="^\d*\.?\d*$"
                inputMode="decimal"
              />
            </Question>

            <Question>
              <Label>Ketercapaian <span className="required">*</span></Label>
              <SelectGroup>
                <label><input type="radio" name="ketercapaian" value="TERCAPAI" onChange={handleChange} required /> TERCAPAI</label>
                <label><input type="radio" name="ketercapaian" value="TIDAK TERCAPAI" onChange={handleChange} /> TIDAK TERCAPAI</label>
              </SelectGroup>
            </Question>

            <Question>
              <Label>Jumlah Muatan (ton) <span className="required">*</span></Label>
              <input
                type="text"
                name="jumlahMuatan"
                onChange={handleChange}
                required
                pattern="^\d*\.?\d*$"
                inputMode="decimal"
              />
            </Question>

            <Question>
              <Label>Realisasi Bongkar/Muat (ton) <span className="required">*</span></Label>
              <input
                type="text"
                name="realisasiBongkar"
                onChange={handleChange}
                required
                pattern="^\d*\.?\d*$"
                inputMode="decimal"
              />
            </Question>

            <Question>
              <Label>Jumlah Perencanaan Shift <span className="required">*</span></Label>
              <input
                type="text"
                name="perencanaanShift"
                onChange={handleChange}
                required
                pattern="^\d*\.?\d*$"
                inputMode="decimal"
              />
            </Question>

            <Question>
              <Label>Realisasi Shift <span className="required">*</span></Label>
              <input
                type="text"
                name="realisasiShift"
                onChange={handleChange}
                required
                pattern="^\d*\.?\d*$"
                inputMode="decimal"
              />
            </Question>

            <Question>
              <Label>Remark Capaian Kinerja <span className="required">*</span></Label>
              <textarea name="remark" rows="4" onChange={handleChange} required />
            </Question>

            <Question>
              <Label>Lampiran Dokumentasi</Label>
              <input type="file" accept="image/*" onChange={handleFileChange} />
            </Question>

            <SubmitButton type="submit" disabled={loading}>
              {loading ? "Menyimpan..." : "Kirim"}
            </SubmitButton>
          </Form>
          </>
          )}
        </FormWrapper>
      </Content>
    </PageWrapper>
  );
}

/* ---------- 🎨 Styled Components ---------- */
const PageWrapper = styled.div`
  display: flex;
  background-color: #f1f3f4;
  min-height: 100vh;
  font-family: "Roboto", sans-serif;
`;

const TopBar = styled.div`
  position: fixed;
  top: 0;
  width: 100%;
  background-color: #002b5b;
  color: white;
  padding: 12px 20px;
  display: flex;
  align-items: center;
  z-index: 100;
  box-shadow: 0 2px 6px rgba(0,0,0,0.2);
`;

const MenuButton = styled.button`
  background: none;
  border: none;
  color: white;
  font-size: 22px;
  margin-right: 10px;
  cursor: pointer;
`;

const Title = styled.h1`
  font-size: 16px;
  font-weight: 500;
`;

const Content = styled.div`
  flex: 1;
  padding: 100px 20px 40px;
  display: flex;
  justify-content: center;
`;

const FormWrapper = styled.div`
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.1);
  max-width: 800px;
  width: 100%;
  padding: 40px 50px;
`;

const FormHeader = styled.div`
  border-left: 8px solid #002b5b;
  padding-left: 20px;
  margin-bottom: 30px;
`;

const Description = styled.div`
  font-size: 14px;
  color: #555;
  line-height: 1.6;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const Question = styled.div`
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  transition: all 0.2s ease;
  border: 1px solid #e0e0e0;

  &:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.12);
    transform: translateY(-2px);
  }

  input[type="text"],
  input[type="number"],
  select,
  textarea {
    border: 1px solid #ccc;
    border-radius: 8px;
    padding: 10px;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s ease;

    &:focus {
      border-color: #002b5b;
      box-shadow: 0 0 0 3px rgba(0,43,91,0.1);
    }
  }
`;

const SelectGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const SubmitButton = styled.button`
  background-color: #002b5b;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 12px 25px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  align-self: flex-start;

  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
`;

const Label = styled.label`
  font-weight: 500;
  margin-bottom: 8px;
  color: #333;
  display: inline-flex;
  align-items: center;
  gap: 4px;

  span.required {
    color: red;
    font-size: 18px;
    line-height: 1;
  }
`;

const DisabledNotice = styled.p`
  font-size: 14px;
  color: #777;
  font-style: italic;
`;

const CompletionWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  align-items: center;
  justify-content: center;
  padding: 40px;

  h2 {
    color: #002b5b;
  }

  button {
    background-color: #002b5b;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 15px;

    &:hover {
      background-color: #004080;
    }
  }
`;
