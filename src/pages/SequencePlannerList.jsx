// src/pages/SequencePlannerList.jsx
import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";

import Sidebar from "../components/Sidebar";
import { FaBars, FaClipboardList } from "react-icons/fa";
import { getAuth } from "firebase/auth";

/* ==================================================
   HALAMAN SEQUENCE PLANNER
   Dispatcher input general
   Planner melengkapi: palka, durasi, dll
   ================================================== */

export default function SequencePlannerList() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigate = useNavigate();
  const auth = getAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const user = auth.currentUser;
        if (!user) return;

        // ambil data user
        const userSnap = await getDocs(
          query(collection(db, "users"), where("uid", "==", user.uid))
        );

        if (userSnap.empty) return;

        const userBranch = userSnap.docs[0].data().branch;

        // ambil kegiatan hasil input dispatcher
        let q;
        if (userBranch) {
          q = query(
            collection(db, "laporan"),
            where("status", "==", true),
            where("branch", "==", userBranch)
          );
        } else {
          q = query(collection(db, "laporan"), where("status", "==", true));
        }

        const snap = await getDocs(q);

        const data = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setList(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
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

      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <Content>
        <HeaderRow>
          <h2>Sequence Planner</h2>
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
                  <th>Tanggal Input</th>
                  <th>Aksi Planner</th>
                  <th>Status Plan</th>
                </tr>
              </thead>

              <tbody>
                {list.map((row, i) => {
                  const isPlanned = row.sequencePlan?.completed === true;

                  return (
                    <tr key={row.id}>
                      <td>{i + 1}</td>
                      <td>{row.namaKapal}</td>
                      <td>{row.terminal}</td>
                      <td>
                        {row.createdAt?.toDate
                          ? row.createdAt
                              .toDate()
                              .toLocaleDateString("id-ID")
                          : "-"}
                      </td>

                      {/* AKSI */}
                      <td>
                        <ActionButton
                          onClick={() =>
                            navigate(`/planner/${row.id}`)
                          }
                        >
                          <FaClipboardList />
                          Isi Plan
                        </ActionButton>
                      </td>

                      {/* STATUS */}
                      <td>
                        {isPlanned ? (
                          <StatusDone>Sudah Diisi</StatusDone>
                        ) : (
                          <StatusPending>Belum Diisi</StatusPending>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </StyledTable>
          </TableWrapper>
        )}
      </Content>
    </PageWrapper>
  );
}

/* ===================== STYLES ===================== */

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
  margin-bottom: 16px;

  h2 {
    margin: 0;
    color: #002b5b;
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

const ActionButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #0b5ed7;
  color: #fff;
  border: none;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;

  &:hover {
    background: #084298;
  }
`;

const StatusDone = styled.span`
  padding: 4px 10px;
  border-radius: 20px;
  background: #d1e7dd;
  color: #0f5132;
  font-weight: 600;
  font-size: 11px;
`;

const StatusPending = styled.span`
  padding: 4px 10px;
  border-radius: 20px;
  background: #fff3cd;
  color: #664d03;
  font-weight: 600;
  font-size: 11px;
`;

const LoadingText = styled.p`
  margin-top: 20px;
  color: #555;
`;
