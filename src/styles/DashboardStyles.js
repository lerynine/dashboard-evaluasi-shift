// src/styles/DashboardStyles.js
import styled from "styled-components";

/* ===========================
   WRAPPER & LAYOUT
=========================== */

export const Container = styled.div`
  padding: 20px;
  background: #ffffff;
  min-height: 100vh;
  transition: all 0.3s ease;

  @media (max-width: 768px) {
    padding-left: 20px;
  }
`;

export const TopBar = styled.div`
  height: 60px;
  background: #002b5b;
  color: white;
  display: flex;
  align-items: center;
  padding: 0 20px;
  margin-left: -20px;
  margin-right: -20px;
  margin-top: -20px;
`;

export const MenuButton = styled.button`
  background: none;
  border: none;
  color: white;
  font-size: 22px;
  cursor: pointer;
`;

export const Header = styled.div`
  background-color: #002b5b; /* 🔹 biru navy */
  color: #ffffff;
  text-align: center;
  padding: 20px 0 25px 0;
  border-radius: 10px;
  margin-top: 30px;
  margin-bottom: 30px;
  box-shadow: 0 4px 10px rgba(0, 43, 91, 0.3);

  h1 {
    font-size: 27px;
    font-weight: 700;
    margin: 0;
    letter-spacing: 0.5px;
  }

  h2 {
    font-size: 18px;
    font-weight: 500;
    margin: 4px 0 0 0;
    opacity: 0.9;
  }
`;
/* ===========================
   TOP ROW (Filters + Stat)
=========================== */

export const TopRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 16px;
  flex-wrap: nowrap;
  margin-bottom: 16px;
`;


export const FilterGroup = styled.div`
  display: flex;
  flex-direction: column;
  font-size: 14px;

  label {
    margin-bottom: 4px;
  }

  input {
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 6px;
  }
`;

export const StatBox = styled.div`
  background-color: ${({ color }) => color}20;
  border-left: 5px solid ${({ color }) => color};
  border-radius: 8px;
  padding: 8px 10px;
  color: ${({ color }) => color};
  font-weight: 600;
  min-width: 120px; /* sebelumnya 160px */
  text-align: center;

  div {
    font-size: 16px; /* sebelumnya 18px */
    font-weight: 700;
  }
`;

/* ===========================
   CONTENT LAYOUT
=========================== */

export const Content = styled.div`
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
`;

export const LeftPanel = styled.div`
  flex: 2;
  min-width: 300px;
`;

export const RightPanel = styled.div`
  flex: 1;
  min-width: 260px;
  max-width: 280px;   // 🔥 Batasi lebarnya
  background: #f6f7fb;
  padding: 15px;
  border-radius: 10px;
`;


/* ===========================
   TABLE STYLE
=========================== */

export const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;

  th {
    background: #002b5b;
    color: white;
    padding: 10px;
    text-align: left;
    font-weight: 600;
  }

  td {
    padding: 10px;
    border-bottom: 1px solid #eaeaea;
  }

  tr:hover {
    background: #f1f1f1;
  }
`;

export const StatusCell = styled.td`
  font-weight: bold;
  color: ${({ status }) =>
    status === "ON SCHEDULE" ? "#0BDA51" : "#D62828"};
`;

/* ===========================
   CHART AREA
=========================== */

export const ChartTitle = styled.h3`
  text-align: center;
  margin-bottom: 10px;
`;

export const ChartContainer = styled.div`
  width: 100%;
  height: 200px;
`;

