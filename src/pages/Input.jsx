import { useState, useEffect } from "react";
import styled from "styled-components";
import { FaBars, FaTimes } from "react-icons/fa";
import Sidebar from "../components/Sidebar";
import axios from "axios";
import { db } from "../firebase";
import {
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  addDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { auth } from "../firebase";

export default function InputPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [formData, setFormData] = useState({});
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [berthData, setBerthData] = useState({});
  const [branch, setBranch] = useState("");
  const [berthLoading, setBerthLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [dispatcherName, setDispatcherName] = useState("");

  const handleChange = (e) => {
    const { name, value, type } = e.target;

    // 🔹 BRANCH berubah → reset terminal & tambatan
    if (name === "branch") {
      setFormData((prev) => ({
        ...prev,
        branch: value, // ✅ MASUK formData
        terminal: "",
        tambatan: "",
      }));
      return;
    }

    // 🔹 TERMINAL berubah → reset tambatan
    if (name === "terminal") {
      setFormData((prev) => ({
        ...prev,
        terminal: value,
        tambatan: "",
      }));
      return;
    }

    // 🔹 DEFAULT
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }));
  };

  const handleFileChange = (e) => setFile(e.target.files[0]);

  useEffect(() => {
    const fetchDispatcherName = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const q = query(collection(db, "users"), where("uid", "==", user.uid));

        const snap = await getDocs(q);

        if (!snap.empty) {
          const userData = snap.docs[0].data();
          setDispatcherName(userData.nama);
        } else {
          console.warn("❗ User tidak ditemukan di collection users");
        }
      } catch (err) {
        console.error("❌ Gagal ambil nama dispatcher:", err);
      }
    };

    fetchDispatcherName();
  }, []);

  // 🔹 Ambil daftar field dari dokumen berth/{terminal}
  useEffect(() => {
    const fetchBerthData = async () => {
      if (!formData.terminal) {
        setBerthData({});
        return;
      }

      setBerthLoading(true);
      try {
        const berthDocRef = doc(db, "berth", formData.terminal);
        const berthSnap = await getDoc(berthDocRef);

        if (berthSnap.exists()) {
          const data = berthSnap.data();

          // 🔹 Cek setiap berth yang terisi kapal
          const updates = {};
          const now = new Date();

          for (const [berthName, shipName] of Object.entries(data)) {
            if (shipName) {
              // Ambil dokumen laporan terbaru berdasarkan nama kapal
              const laporanRef = collection(db, "laporan");
              const q = query(
                laporanRef,
                where("namaKapal", "==", shipName),
                orderBy("createdAt", "desc"),
                limit(1),
              );

              const snap = await getDocs(q);

              if (!snap.empty) {
                const latestDoc = snap.docs[0].data();
                const etdStr = latestDoc.etd;

                if (etdStr) {
                  const etd = new Date(etdStr);

                  // Jika waktu sekarang sudah lewat ETD, kosongkan berth
                  if (now > etd) {
                    console.log(
                      `⏰ ${shipName} di ${berthName} sudah lewat ETD (${etd.toLocaleString()}) – dikosongkan.`,
                    );
                    updates[berthName] = ""; // hanya hapus value-nya, field tetap ada
                  }
                }
              }
            }
          }

          // Jika ada yang perlu dikosongkan, update Firestore
          if (Object.keys(updates).length > 0) {
            await updateDoc(berthDocRef, updates);
            console.log("✅ Berth dikosongkan:", updates);
            // Ambil ulang data terbaru setelah update
            const refreshedSnap = await getDoc(berthDocRef);
            setBerthData(refreshedSnap.data());
          } else {
            setBerthData(data);
          }
        } else {
          setBerthData({});
        }
      } catch (err) {
        console.error("❌ Error fetching berth data:", err);
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
    const decimalFields = [
      "jumlahMuatan",
      "realisasiBongkarMuat",
      "perencanaanShift",
      "realisasiShift",
    ];

    const normalizedNumbers = {};

    for (let field of decimalFields) {
      const value = formData[field];
      const normalized = value?.toString().replace(",", ".");
      if (value === undefined || value === "" || isNaN(Number(normalized))) {
        alert(`Kolom "${field}" harus berupa angka desimal yang valid`);
        return;
      }
      normalizedNumbers[field] = Number(normalized);
    }

    setLoading(true);

    try {
      let imageUrl = null;

      // 🔹 Upload Cloudinary (optional)
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
        imageUrl = res.data.secure_url;
      }

      // 🔹 Timestamp fields
      const toTimestamp = (value) =>
        value ? Timestamp.fromDate(new Date(value)) : null;

      const etb = toTimestamp(formData.etb);
      const etd = toTimestamp(formData.etd);
      const firstLine = toTimestamp(formData.firstLine);
      const startDL = toTimestamp(formData.firstDL);

      // 🔹 Jenis kemasan final
      const finalJenisKemasan =
        formData.jenisKemasan === "Yang lain..."
          ? formData.jenisKemasanLain || "Lain-lain"
          : formData.jenisKemasan;

      // 🔹 Payload FINAL (bersih & sesuai requirement)
      const payload = {
        // system
        createdAt: serverTimestamp(),
        status: true,
        completed: formData.completed === true,

        // identitas
        dispatcherName,
        branch: formData.branch,
        terminal: formData.terminal,
        shift: formData.shift,
        namaKapal: formData.namaKapal,

        // tambatan hanya JNM
        ...(formData.branch === "JNM" && { tambatan: formData.tambatan }),

        // dokumen
        spmk: formData.spmk || null,
        ppk: formData.ppk || null,
        agentStevedore: formData.agentStevedore || null,

        // waktu
        etb,
        etd,
        firstLine,
        startDL,

        // muatan
        jenisKemasan: finalJenisKemasan,
        jenisBarang: formData.jenisBarang,
        realisasiTgh: formData.realisasiTgh,
        ketercapaian: formData.ketercapaian,
        jumlahMuatan: normalizedNumbers.jumlahMuatan,
        realisasiBongkarMuat: normalizedNumbers.realisasiBongkarMuat,

        // shift
        perencanaanShift: normalizedNumbers.perencanaanShift,
        realisasiShift: normalizedNumbers.realisasiShift,

        // efisiensi (optional)
        not_time_hours: formData.not_time_hours || null,
        idle_time_hours: formData.idle_time_hours || null,
        effective_time_hours: formData.effective_time_hours || null,

        // lainnya
        remark: formData.remark,
        lampiran: imageUrl,
      };

      // 🔹 Simpan laporan
      await addDoc(collection(db, "laporan"), payload);

      // 🔹 Update berth (KHUSUS JNM)
      if (
        formData.branch === "JNM" &&
        formData.terminal &&
        formData.tambatan &&
        formData.namaKapal
      ) {
        const berthRef = doc(db, "berth", formData.terminal);
        await updateDoc(berthRef, {
          [formData.tambatan.toLowerCase()]: formData.namaKapal,
        });
      }

      setFormData({});
      setFile(null);
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      alert("Gagal menyimpan data");
    } finally {
      setLoading(false);
    }
  };

  const BRANCH_TERMINAL_MAP = {
    BALIKPAPAN: ["KARIANGAU KALTIM TERMINAL", "SEMAYANG"],
    BELAWAN: [
      "CITRA-KADE 200",
      "Citra - KADE 201",
      "Citra - KADE 202",
      "Citra - KADE 203",
      "DERMAGA BELAWAN",
      "DERMAGA BELAWAN LAMA",
      "DERMAGA BELAWAN LAMA KD 001",
      "DERMAGA BELAWAN LAMA KD 002",
      "DERMAGA BELAWAN LAMA KD 003",
      "DERMAGA BELAWAN LAMA KD 004",
      "DERMAGA BELAWAN LAMA KD 005",
      "DERMAGA BELAWAN LAMA KD 006",
      "DERMAGA BELAWAN LAMA KD 007",
      "DERMAGA BELAWAN LAMA KD 008",
      "DERMAGA CITRA",
      "DERMAGA IKD",
      "DERMAGA PLTU BELAWAN",
      "DERMAGA SEMEN ANDALAS BELAWAN",
      "DERMAGA TJIPTA RIMBA DJAJA",
      "Dermaga TUKS PT. PERUSAHAAN LISTRIK NEGARA (PERSERO) KITLUR SUMBAGUT",
      "Dermaga TUKS PT. SEMEN ANDALAS INDONESIA",
      "Dermaga TUKS PT. TJIPTA RIMBA DJAJA",
      "DERMAGA UJUNG BARU",
      "DERMAGA UJUNG BARU 101",
      "DERMAGA UJUNG BARU 102",
      "DERMAGA UJUNG BARU 103",
      "DERMAGA UJUNG BARU 104",
      "DERMAGA UJUNG BARU 105",
      "DERMAGA UJUNG BARU 106",
      "DERMAGA UJUNG BARU 107",
      "DERMAGA UJUNG BARU 108",
      "DERMAGA UJUNG BARU 109",
      "DERMAGA UJUNG BARU 110",
      "DERMAGA UJUNG BARU 111",
      "DERMAGA UJUNG BARU 112",
      "DERMAGA UJUNG BARU 113",
      "DERMAGA UJUNG BARU 114",
      "IKD 1",
      "TERMINAL CURAH KERING IKD II",
      "UJUNG BARU - DERMAGA FERRY",
    ],
    BENOA: ["DERMAGA SELATAN"],
    BIMABADAS: [
      "DERMAGA BIMA",
      "DMG BIMA",
      "DMG BIMA - NUSANTARA II",
      "DMG KSOP BIMA NUSANTARA I KSP",
      "DMG KSOP BIMA NUSANTARA KSP",
      "DMG PELRA BIMA 1",
      "DMG PELRA BIMA 2",
      "KSOP BIMA PELRA KSP",
      "RTK 01",
      "SECURITY CHECK AREA",
      "TERM PENUMPANG KOTABARU",
    ],
    BUMIHARJOBAGENDANG: [
      "BUMBU KUNING YUTABA",
      "DERMAGA ASDP",
      "DERMAGA CITRA BORNEO CENTER",
      "DERMAGA CURAH CAIR 1 BUMIHARJO",
      "DERMAGA CURAH CAIR 2 BUMIHARJO",
      "DERMAGA CURAHCAIR BUMIHARJO J2",
      "DERMAGA JETTY 3 BUMIHARJO",
      "DERMAGA KAPUAS PRIMA COAL 2",
      "DERMAGA KORINDO PANGKALAN BUN",
      "DERMAGA MULTIPURPOSE BUMIHARJO",
      "DERMAGA PERTAMINA KUMAI",
      "DERMAGA PINGGIRAN",
      "DERMAGA PT.SAP",
      "DERMAGA PUTRA BALI",
      "DERMAGA SBI",
      "DERMAGA UMUM KUMAI",
      "DERMAGA UMUM PANGKALAN BUN",
      "DERMAGA UMUM (P) PANGKALAN BUN",
      "DERMAGA UMUM (P) SUKAMARA",
      "DERMAGA UMUM SUKAMARA",
      "EAGLE HIGH PLANTATION",
      "ERYTHRINA NUGRAHA MEGAH",
      "FAJAR ANEKA SENTOSA",
      "GUNTUR ARTHA WIGUNA",
      "INDOTRUBA TENGAH",
      "IRVAN PRIMA PRATAMA",
      "KALIMANTAN SAWIT KUSUMA",
      "KALIMANTAN SUMBER ENERGI",
      "KUMAI USAHA MARINA",
      "PETRO ANDALAN",
      "PRIMA BUDIARTA NUSA",
      "SUNGAI RANGIT",
      "WANASAWIT SUBUR LESTARI",
    ],
    DUMAI: [
      "DERMAGA A DUMAI (DERMAGA_A)",
      "DERMAGA A (KHUSUS SEMEN) (A-SEMEN)",
      "DERMAGA B DALAM DUMAI (DERMAGA_BD)",
      "DERMAGA B DUMAI (DERMAGA_B)",
      "DERMAGA BEACHING DUMAI (BEACHING)",
      "DERMAGA C DUMAI (DERMAGA_C)",
      "DERMAGA D DUMAI (DERMAGA_D)",
    ],
    GRESIK: [
      "DERMAGA 180",
      "DERMAGA 265",
      "DERMAGA 70",
      "DERMAGA 78",
      "DERMAGA BANGUN ARTA",
      "DERMAGA IBL SISI DALAM",
      "DERMAGA PELRA",
      "DERMAGA PENUMPANG",
      "DERMAGA TALUD TEGAK",
      "DERMAGA TALUD TEGAK SISI DALAM",
      "DERMAGA UMUM IBL SISI LUAR",
      "DERMAGA UMUM MULTIPURPOSE",
      "DERMAGA UMUM PENUMPANG",
      "DERMAGA UMUM PT. GRESIK JASA TAMA",
      "DERMAGA UMUM TALUD TEGAK KONVENSIONAL",
      "RUANG TUNGGU KENDARAAN 01",
      "RUANG TUNGGU PENUMPANG 01",
    ],
    JNM: [
      "Jamrud Utara",
      "Jamrud Selatan",
      "Jamrud Barat",
      "Nilam Selatan",
      "Nilam Utara",
      "Mirah Selatan",
      "Mirah Timur",
      "Surabaya Veem",
    ],
    KALIMAS: [],
    LEMBAR: [
      "BOARDING GATE 01",
      "DERMAGA GILIMAS",
      "DERMAGA LOKAL",
      "DERMAGA LOKAL I",
      "DERMAGA LOKAL II",
      "DERMAGA NUSANTARA 2",
      "DERMAGA NUSANTARA I",
      "DERMAGA NUSANTARA II",
      "DERMAGA PONTON",
      "DERMAGA RAKYAT",
      "MAIN GATE 01",
      "MOORING BUOY BOSOWA",
      "MOORING BUOY TIGA RODA",
      "RTK GILIMAS",
      "RTK GILIMAS 02",
      "RTK LEMBAR",
      "RTK LEMBAR 02",
      "RUANG TUNGGU 01",
      "RUANG TUNGGU 02",
      "SECURITY CHECK AREA",
      "TERMINAL GILIMAS",
    ],
    LHOKSEUMAWELANGSA: [
      "Dermaga Umum",
      "PELINDO - BREASTING DOLPHIN / CURAH CAIR",
      "PELINDO - BREASTING DOLPHIN/ CURAH KERING",
      "PELINDO - DERMAGA PENUMPANG",
      "PELINDO - MULTIPURPOSE",
      "PELINDO - MULTIPURPOSE (EX. AAF)",
      "DERMAGA BARU EX-SINGAPORE",
      "DERMAGA TAPAKTUAN",
    ],
    MAKASSAR: [
      "DERMAGA CURAH CAIR BAGENDANG",
      "DERMAGA MAKASSAR",
      "DERMAGA MULTIPURSP BAGENDANG 1",
      "DERMAGA MULTIPURSP BAGENDANG 2",
      "HASANUDDIN - MULTIPURPOSE I",
      "HATTA - CURAH KERING",
      "SOEKARNO",
      "SOEKARNO - MULTIPURPOSE III - BERDIKARI",
      "SOEKARNO - MULTIPURPOSE II - INTERNASIONAL",
      "SOEKARNO - RO RO",
    ],
    MALAHAYATIMEULABOH: [
      "JETTY 1",
      "JETTY 2",
      "JETTY 3",
      "DERMAGA BARU EX-SINGAPORE",
      "DERMAGA MEULABOH LAMA",
      "DERMAGA TAPAKTUAN",
    ],
    PAREPAREGARONKONG: [
      "DERMAGA APBN",
      "DERMAGA APBN - CAPPA UJUNG",
      "DERMAGA LONTANGNGE",
      "DERMAGA NUSANTARA",
      "DERMAGA PARE PARE",
      "DERMAGA PETI KEMAS",
      "DERMAGA UMUM 1 GARONGKONG",
    ],
    SIBOLGA: [
      "AREA SHIP TO SHIP (STS)",
      "CARGO DAN TERMINAL PENUMPANG",
      "DERMAGA 01 KIJANG",
      "DERMAGA 46 DARAT",
      "DERMAGA 46 LAUT",
      "DERMAGA DOLPHIN DARAT",
      "DERMAGA DOLPHIN LAUT",
      "DERMAGA FERRY",
      "DERMAGA LABUHAN ANGIN",
      "DERMAGA SISI LUAR",
      "DERMAGA TRESTEL DARAT",
      "DERMAGA TRESTEL LAUT",
      "LABUH",
    ],
    TANJUNGBALAIKARIMUN: [],
    TANJUNGEMAS: [],
    TANJUNGINTAN: [
      "DERMAGA PUSRI",
      "MULTIPURPOSE II (TAMBATAN VI)",
      "MULTIPURPOSE I (TAMBATAN I - IV)",
      "TAMBATAN I",
      "TAMBATAN II",
      "TAMBATAN III",
      "TAMBATAN S2P PLTU I",
      "TAMBATAN S2P PLTU II",
      "TAMBATAN S2P PLTU III",
      "TAMBATAN VI",
      "TAMB. KARANG TALUN I",
      "TAMB. KARANG TALUN II",
      "WIJAYAPURA",
      "YETTY DONAN I AREA 60",
      "YETTY DONAN II AREA 60",
    ],
    TANJUNGPINANG: [
      "AREA LABUH CAPE SETUMU",
      "AREA LABUH PENYENGAT",
      "AREA LABUH TERKULAI",
      "BINTAN ALUMINA INDONESIA",
      "BINTAN NUSAMULTI TUKS",
      "BINTAN OFSHORE POSTPAY",
      "DERMAGA 01 BATU ANAM",
      "DERMAGA 01 KIJANG",
      "DERMAGA 02 KIJANG",
      "DERMAGA 50 METER",
      "DERMAGA BATU ANAM",
      "DERMAGA BEACHING",
      "DERMAGA BETON",
      "DERMAGA BINTAN MAHKOTA SUKSES",
      "DERMAGA MEITECH EKA BINTAN",
      "DERMAGA PERTAMINA KIJANG",
      "DERMAGA PETIKEMAS",
      "DERMAGA TUKS BINTANG KARTIKA",
      "DERMAGA UMUM SRI BAYINTAN KIJANG",
      "LABUH",
      "PONTON A1",
      "PONTON A2",
      "PONTON BRAVO",
      "PONTON C1",
      "PONTON C2",
      "PONTON D1",
      "PONTON D2",
      "PONTON VIP",
      "RTK 01",
      "RTK 02",
      "RUANG TUNGGU DOMESTIK",
      "RUANG TUNGGU INTERNASIONAL",
      "SECURITY CHECK AREA",
      "Terminal Penumpang SRI BAYINTAN KIJANG",
      "Terminal Penumpang SRI BINTAN PURA",
      "TUKS BINTAN KARISMA PRATAMA",
      "TUKS CAPITAL TURBINES",
      "WILAYAH LABUH PERAIRAN TEMBORA",
      "WILAYAH STS TANJUNG TILI",
      "WILAYAH STS TELANG POSTPAY",
    ],
    TANJUNGWANGI: [
      "DERMAGA UMUM",
      "DERMAGA UMUM TG WANGI",
      "MAIN GATE 01",
      "RTK 01",
      "RTK 02",
      "RUANG TUNGGU 01",
      "RUANG TUNGGU 02",
    ],
    TRISAKTIMEKARPUTIH: [
      "BASIRIH",
      "DERMAGA 50",
      "DERMAGA BEACHING",
      "DERMAGA UMUM",
      "JETTY 1",
      "KADE AKR",
      "MARTAPURA BARU",
      "PELRA BASIRIH",
      "PELRA MARTAPURA BARU",
      "PELRA MARTAPURA LAMA",
      "RTK 01",
      "SECURITY CHECK AREA",
      "TERM PENUMPANG TRISAKTI",
      "TRISAKTI",
      "TRISAKTI100",
      "TRISAKTI200",
      "TRISAKTI300",
      "TRISAKTI400",
      "TRISAKTI500",
    ],
  };

  return (
    <PageWrapper>
      <TopBar>
        <MenuButton onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <FaTimes /> : <FaBars />}
        </MenuButton>
        <Title>Formulir Serah Terima Shift Dispatcher</Title>
      </TopBar>

      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <Content onClick={() => sidebarOpen && setSidebarOpen(false)}>
        <FormWrapper>
          {submitted ? (
            <CompletionWrapper>
              <h2>Terima kasih! Formulir telah berhasil disimpan.</h2>
              <p>
                <button onClick={() => setSubmitted(false)}>
                  Kirim Formulir Lagi
                </button>
              </p>
            </CompletionWrapper>
          ) : (
            <>
              <FormHeader>
                <h1>Formulir Serah Terima Shift Dispatcher</h1>
              </FormHeader>

              <Form onSubmit={handleSubmit}>
                <Question>
                  <Label>Nama User</Label>
                  <input value={dispatcherName} disabled />
                </Question>

                <Question>
                  <Label>
                    Branch <span className="required">*</span>
                  </Label>
                  <select
                    name="branch"
                    value={formData.branch || ""}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Pilih Branch</option>
                    <option value="BALIKPAPAN">Balikpapan</option>
                    <option value="BELAWAN">Belawan</option>
                    <option value="BENOA">Benoa</option>
                    <option value="BIMABADAS">Bima Badas</option>
                    <option value="BUMIHARJOBAGENDANG">
                      Bumiharjo Bagendang
                    </option>
                    <option value="DUMAI">Dumai</option>
                    <option value="GRESIK">Gresik</option>
                    <option value="JNM">Jamrud Nilam Mirah</option>
                    <option value="KALIMAS">Kalimas</option>
                    <option value="LEMBAR">Lembar</option>
                    <option value="LHOKSEUMAWELANGSA">
                      Lhokseumawe Langsa
                    </option>
                    <option value="MAKASSAR">Makassar</option>
                    <option value="MALAHAYATIMEULABOH">
                      Malahayati Meulaboh
                    </option>
                    <option value="PAREPAREGARONKONG">
                      Pare Pare Garongkong
                    </option>
                    <option value="SIBOLGA">Sibolga</option>
                    <option value="TANJUNGBALAIKARIMUN">
                      Tanjung Balai Karimun
                    </option>
                    <option value="TANJUNGEMAS">Tanjung Emas</option>
                    <option value="TANJUNGINTAN">Tanjung Intan</option>
                    <option value="TANJUNGPINANG">Tanjung Pinang</option>
                    <option value="TANJUNGWANGI">Tanjung Wangi</option>
                    <option value="TRISAKTIMEKARPUTIH">
                      Trisakti Mekar Putih
                    </option>
                  </select>
                </Question>

                <Question>
                  <Label>
                    Terminal <span className="required">*</span>
                  </Label>

                  {formData.branch ? (
                    <select
                      name="terminal"
                      value={formData.terminal || ""}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Pilih Terminal</option>

                      {BRANCH_TERMINAL_MAP[formData.branch]?.map((terminal) => (
                        <option key={terminal} value={terminal}>
                          {terminal}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <DisabledNotice>
                      Pilih branch terlebih dahulu untuk menampilkan terminal.
                    </DisabledNotice>
                  )}
                </Question>

                {formData.branch === "JNM" && (
                  <Question>
                    <Label>
                      Tambatan <span className="required">*</span>
                    </Label>

                    {formData.terminal ? (
                      berthLoading ? (
                        <p>Memuat data berth...</p>
                      ) : Object.keys(berthData).length > 0 ? (
                        <select
                          name="tambatan"
                          value={formData.tambatan || ""}
                          onChange={handleChange}
                          required
                        >
                          <option value="">Pilih Tambatan</option>

                          {Object.keys(berthData)
                            .sort((a, b) => {
                              const numA = parseInt(
                                a.match(/\d+/)?.[0] || 0,
                                10,
                              );
                              const numB = parseInt(
                                b.match(/\d+/)?.[0] || 0,
                                10,
                              );
                              return numA - numB;
                            })
                            .map((key) => (
                              <option key={key} value={key}>
                                {key.toUpperCase()}
                              </option>
                            ))}
                        </select>
                      ) : (
                        <p>Tidak ada data berth untuk terminal ini.</p>
                      )
                    ) : (
                      <DisabledNotice>
                        Pilih terminal terlebih dahulu untuk menampilkan daftar
                        tambatan.
                      </DisabledNotice>
                    )}
                  </Question>
                )}

                <Question>
                  <Label>
                    Shift <span className="required">*</span>
                  </Label>
                  <SelectGroup>
                    {[
                      "I (08.00 - 16.00)",
                      "II (16.00 - 00.00)",
                      "III (00.00 - 08.00)",
                    ].map((s) => (
                      <label key={s}>
                        <input
                          type="radio"
                          name="shift"
                          value={s}
                          onChange={handleChange}
                          required
                        />{" "}
                        Shift {s}
                      </label>
                    ))}
                  </SelectGroup>
                </Question>

                <Question>
                  <Label>
                    Grup <span className="required">*</span>
                  </Label>
                  <SelectGroup>
                    {["A", "B", "C", "D"].map((g) => (
                      <label key={g}>
                        <input
                          type="radio"
                          name="grup"
                          value={g}
                          onChange={handleChange}
                          required
                        />{" "}
                        {g}
                      </label>
                    ))}
                  </SelectGroup>
                </Question>

                <Question>
                  <Label>
                    Nama Kapal <span className="required">*</span>
                  </Label>
                  <input name="namaKapal" onChange={handleChange} required />
                </Question>

                {/* Informasi Dokumen & Waktu Kapal */}
                <Question>
                  <Label>
                    SPMK <span className="required">*</span>
                  </Label>
                  <input name="spmk" onChange={handleChange} />
                </Question>

                <Question>
                  <Label>
                    PPK <span className="required">*</span>
                  </Label>
                  <input name="ppk" onChange={handleChange} />
                </Question>

                <Question>
                  <Label>
                    Agent / Stevedore <span className="required">*</span>
                  </Label>
                  <input name="agentStevedore" onChange={handleChange} />
                </Question>

                <Question>
                  <Label>
                    ETB (Estimated Time Berth)
                    <span className="required">*</span>
                  </Label>
                  <input
                    type="datetime-local"
                    name="etb"
                    onChange={handleChange}
                  />
                </Question>

                <Question>
                  <Label>
                    ETD (Estimated Time Departure)
                    <span className="required">*</span>
                  </Label>
                  <input
                    type="datetime-local"
                    name="etd"
                    onChange={handleChange}
                  />
                </Question>

                <Question>
                  <Label>
                    First Line (Waktu Sandar Pertama)
                    <span className="required">*</span>
                  </Label>
                  <input
                    type="datetime-local"
                    name="firstLine"
                    onChange={handleChange}
                  />
                </Question>

                <Question>
                  <Label>
                    First D/L (Waktu Bongkar/Muat Pertama)
                    <span className="required">*</span>
                  </Label>
                  <input
                    type="datetime-local"
                    name="firstDL"
                    onChange={handleChange}
                  />
                </Question>

                <Question>
                  <Label>
                    Activity Type<span className="required">*</span>
                  </Label>
                  <select name="activityType" onChange={handleChange}>
                    <option value="">Pilih Aktivitas</option>
                    <option value="DISCHARGE">DISCHARGE</option>
                    <option value="LOAD">LOAD</option>
                  </select>
                </Question>

                <Question>
                  <Label>
                    Equipment<span className="required">*</span>
                  </Label>
                  <input
                    name="equipment"
                    onChange={handleChange}
                    placeholder="Contoh: SHIP CRANE / HMC / DUCTING TO TNU"
                  />
                </Question>

                {/* Efisiensi Waktu Kerja */}
                <Question>
                  <Label>
                    Not Time (Jam)<span className="required">*</span>
                  </Label>
                  <input
                    type="number"
                    name="not_time_hours"
                    onChange={handleChange}
                    min="0"
                    step="0.1"
                    placeholder="Contoh: 0"
                  />
                </Question>

                <Question>
                  <Label>
                    Idle Time (Jam)<span className="required">*</span>
                  </Label>
                  <input
                    type="number"
                    name="idle_time_hours"
                    onChange={handleChange}
                    min="0"
                    step="0.1"
                    placeholder="Contoh: 0"
                  />
                </Question>

                <Question>
                  <Label>
                    Effective Time (Jam)<span className="required">*</span>
                  </Label>
                  <input
                    type="number"
                    name="effective_time_hours"
                    onChange={handleChange}
                    min="0"
                    step="0.1"
                    placeholder="Contoh: 0"
                  />
                </Question>

                <Question>
                  <Label>
                    Jenis Kemasan <span className="required">*</span>
                  </Label>
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
                      <label
                        key={item}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
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
                  <Label>
                    Jenis Barang <span className="required">*</span>
                  </Label>
                  <input name="jenisBarang" onChange={handleChange} required />
                </Question>

                <Question>
                  <Label>
                    Realisasi TGH <span className="required">*</span>
                  </Label>
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
                  <Label>
                    Ketercapaian <span className="required">*</span>
                  </Label>
                  <SelectGroup>
                    <label>
                      <input
                        type="radio"
                        name="ketercapaian"
                        value="TERCAPAI"
                        onChange={handleChange}
                        required
                      />{" "}
                      TERCAPAI
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="ketercapaian"
                        value="TIDAK TERCAPAI"
                        onChange={handleChange}
                      />{" "}
                      TIDAK TERCAPAI
                    </label>
                  </SelectGroup>
                </Question>

                <Question>
                  <Label>
                    Jumlah Muatan (ton) <span className="required">*</span>
                  </Label>
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
                  <Label>
                    Realisasi Bongkar/Muat (ton){" "}
                    <span className="required">*</span>
                  </Label>
                  <input
                    type="text"
                    name="realisasiBongkarMuat"
                    onChange={handleChange}
                    required
                    pattern="^\d*\.?\d*$"
                    inputMode="decimal"
                  />
                </Question>

                <Question>
                  <Label>
                    Completed <span className="required">*</span>
                  </Label>
                  <input
                    type="text"
                    name="completed"
                    onChange={handleChange}
                    required
                    pattern="^\d*\.?\d*$"
                    inputMode="decimal"
                  />
                </Question>

                <Question>
                  <Label>
                    Jumlah Hari <span className="required">*</span>
                  </Label>
                  <input
                    type="text"
                    name="day"
                    onChange={handleChange}
                    required
                    pattern="^\d*\.?\d*$"
                    inputMode="decimal"
                  />
                </Question>

                <Question>
                  <Label>
                    Jumlah Perencanaan Shift <span className="required">*</span>
                  </Label>
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
                  <Label>
                    Realisasi Shift <span className="required">*</span>
                  </Label>
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
                  <Label>
                    Remark Capaian Kinerja <span className="required">*</span>
                  </Label>
                  <textarea
                    name="remark"
                    rows="4"
                    onChange={handleChange}
                    required
                  />
                </Question>

                <Question>
                  <Label>Lampiran Dokumentasi</Label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                  />
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
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
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
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
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
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  transition: all 0.2s ease;
  border: 1px solid #e0e0e0;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
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
      box-shadow: 0 0 0 3px rgba(0, 43, 91, 0.1);
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