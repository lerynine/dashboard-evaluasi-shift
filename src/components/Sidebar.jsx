// src/components/Sidebar.jsx
import styled from "styled-components";
import {
  FaTachometerAlt,
  FaChartBar,
  FaShip,
  FaSignOutAlt,
  FaUserCircle,
} from "react-icons/fa";
import { NavLink, useNavigate } from "react-router-dom";
import { getAuth, signOut } from "firebase/auth";
import { useEffect, useState } from "react";
import { FaListOl } from "react-icons/fa";

import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export default function Sidebar({ open, setOpen, user }) {
  const auth = getAuth();
  const firebaseUser = auth.currentUser;
  const navigate = useNavigate();

  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      if (!firebaseUser) return;

      const q = query(
        collection(db, "users"),
        where("uid", "==", firebaseUser.uid),
      );

      const snap = await getDocs(q);

      if (!snap.empty) {
        // ambil user pertama (harusnya cuma 1)
        setUserData(snap.docs[0].data());
      }
    };

    fetchUser();
  }, [firebaseUser]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  return (
    <SidebarContainer open={open}>
      {/* LOGO */}
      <Brand>
        <img src="/images/spmt-logo.png" alt="SPMT Logo" />
      </Brand>

      {/* MENU */}
      <NavList>
        <StyledNavLink to="/dashboard" onClick={() => setOpen(false)}>
          <FaTachometerAlt />
          <span>Dashboard</span>
        </StyledNavLink>

        <StyledNavLink to="/weekly" onClick={() => setOpen(false)}>
          <FaChartBar />
          <span>Weekly</span>
        </StyledNavLink>

        <StyledNavLink to="/kegiatan" onClick={() => setOpen(false)}>
          <FaShip />
          <span>Input</span>
        </StyledNavLink>

        {/* MENU BARU */}
        <StyledNavLink to="/sequence" onClick={() => setOpen(false)}>
          <FaListOl />
          <span>Sequence</span>
        </StyledNavLink>
      </NavList>

      {/* ⬇️ BAGIAN BAWAH */}
      <BottomSection>
        {/* USER INFO */}
        <UserBox>
          <FaUserCircle />
          <div>
            <div className="name">{userData?.nama || "-"}</div>
            <div className="meta">
              {userData?.nipp || "-"} • {userData?.branch || "-"}
            </div>
          </div>
        </UserBox>

        {/* LOGOUT */}
        <LogoutButton onClick={handleLogout}>
          <FaSignOutAlt />
          Logout
        </LogoutButton>
      </BottomSection>
    </SidebarContainer>
  );
}

/* ==================== STYLED COMPONENTS ==================== */
const SidebarContainer = styled.aside`
  position: fixed;
  top: 60px;
  left: ${({ open }) => (open ? "0" : "-230px")};
  width: 230px;
  height: calc(100vh - 60px);
  background-color: #002b5b;
  color: white;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
  z-index: 100;
`;

const Brand = styled.div`
  background: #fff;
  text-align: center;
  padding: 15px 0;

  img {
    width: 150px;
  }
`;

const NavList = styled.nav`
  display: flex;
  flex-direction: column;
  margin-top: 20px;
`;

const StyledNavLink = styled(NavLink)`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  color: white;
  text-decoration: none;
  font-size: 15px;

  &.active {
    background: rgba(255, 255, 255, 0.15);
    color: #0bda51;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #0bda51;
  }
`;

const BottomSection = styled.div`
  margin-top: auto;
  padding: 15px;
  border-top: 1px solid rgba(255, 255, 255, 0.15);
`;

const UserBox = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.1);
  padding: 10px;
  border-radius: 6px;
  margin-bottom: 10px;

  svg {
    font-size: 28px;
    color: #0bda51;
  }

  .name {
    font-weight: 600;
    font-size: 14px;
  }

  .meta {
    font-size: 12px;
    opacity: 0.8;
  }
`;

const LogoutButton = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  background: #d62828;
  color: white;
  border: none;
  padding: 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;

  &:hover {
    background: #b71c1c;
  }
`;
