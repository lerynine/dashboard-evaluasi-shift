// src/pages/KegiatanList.jsx
import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";

import Sidebar from "../components/Sidebar";
import { FaBars, FaPlus, FaEdit } from "react-icons/fa";

/* ==================== PAGE ==================== */

export default function KegiatanList() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      const q = query(collection(db, "laporan"), where("status", "==", true));

      const snap = await getDocs(q);
      const data = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setList(data);
      setLoading(false);
    };

    fetchData();
  }, []);

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
        <HeaderRow>
          <h2>Daftar Kegiatan Kapal Aktif</h2>

          <PrimaryButton onClick={() => navigate("/input")}>
            <FaPlus />
            Tambah Kegiatan
          </PrimaryButton>
        </HeaderRow>

        {loading ? (
          <LoadingText>Memuat data...</LoadingText>
        ) : (
          <TableWrapper>
            <StyledTable>
              <thead>
                <tr>
                  <th>No</th>
                  <th>Nama Kapal</th>
                  <th>Terminal</th>
                  <th>Tanggal Mulai</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row, i) => (
                  <tr key={row.id}>
                    <td>{i + 1}</td>

                    <ClickableCell
                      onClick={() => navigate(`/kegiatan/${row.id}`)}
                    >
                      {row.namaKapal}
                    </ClickableCell>

                    <td>{row.terminal}</td>
                    <td>
                      {row.createdAt?.toDate
                        ? row.createdAt.toDate().toLocaleDateString("id-ID")
                        : "-"}
                    </td>

                    <td>
                      <ActionButton
                        onClick={() => navigate(`/kegiatan/${row.id}/update`)}
                      >
                        <FaEdit />
                        Update
                      </ActionButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </StyledTable>
          </TableWrapper>
        )}
      </Content>
    </PageWrapper>
  );
}

/* ==================== STYLES ==================== */

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
  margin-left: 0;
  padding: 24px;
`;

const HeaderRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  h2 {
    margin: 0;
    color: #002b5b;
  }
`;

const PrimaryButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  background: #00802b;
  color: #fff;
  border: none;
  padding: 8px 14px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    background: #a4d3b4;
  }
`;

const ActionButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #002b5b;
  color: #fff;
  border: none;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;

  &:hover {
    background: #01407f;
  }
`;

const TableWrapper = styled.div`
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: auto;
  background: #fff;
`;

const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;

  th,
  td {
    border: 1px solid #ddd;
    padding: 6px 8px;
    text-align: center;
  }

  thead {
    background: #002b5b;
    color: #fff;
  }

  tbody tr:nth-child(even) {
    background: #f0f4f8;
  }

  tbody tr:hover {
    background: #e5eef7;
  }
`;

const ClickableCell = styled.td`
  cursor: pointer;
  color: #0b5ed7;
  font-weight: 600;

  &:hover {
    text-decoration: underline;
  }
`;

const LoadingText = styled.p`
  margin-top: 20px;
  color: #555;
`;
