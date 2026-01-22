// src/components/Sidebar.jsx
import styled from "styled-components";
import {
  FaTachometerAlt,
  FaPlusCircle,
  FaFileAlt,
  FaChartBar,
  FaShip, // ⬅️ TAMBAH INI
} from "react-icons/fa";
import { NavLink } from "react-router-dom";

export default function Sidebar({ open, setOpen }) {
  return (
    <SidebarContainer open={open}>
      <Brand>
        <img
          src="/images/spmt-logo.png"
          alt="SPMT Logo"
          style={{
            width: "150px",
            height: "auto",
            objectFit: "contain",
          }}
        />
      </Brand>

      <NavList>
        {/* Menu Dashboard */}
        <StyledNavLink to="/dashboard" onClick={() => setOpen(false)}>
          <FaTachometerAlt />
          <span>Dashboard</span>
        </StyledNavLink>

        {/* ⭐ Menu Weekly Dashboard (Baru) */}
        <StyledNavLink to="/weekly" onClick={() => setOpen(false)}>
          <FaChartBar />
          <span>Weekly</span>
        </StyledNavLink>

        <StyledNavLink to="/kegiatan" onClick={() => setOpen(false)}>
          <FaShip />
          <span>Input</span>
        </StyledNavLink>
      </NavList>
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
  padding-top: 0;
  transition: all 0.3s ease;
  z-index: 100;
  box-shadow: ${({ open }) =>
    open ? "4px 0 15px rgba(0, 0, 0, 0.3)" : "none"};
`;

const Brand = styled.div`
  background-color: #fff;
  text-align: center;
  padding: 15px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);

  img {
    display: block;
    margin: 0 auto;
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
  color: white;
  text-decoration: none;
  padding: 12px 20px;
  font-size: 15px;
  font-weight: 500;
  transition: all 0.2s ease;

  &.active {
    background-color: rgba(255, 255, 255, 0.15);
    color: #0bda51;
  }

  &:hover {
    background-color: rgba(255, 255, 255, 0.1);
    color: #0bda51;
  }

  svg {
    font-size: 18px;
  }
`;
