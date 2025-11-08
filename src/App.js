// src/App.jsx
import { Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Input from "./pages/Input";
import Laporan from "./pages/Laporan"; // ✅ Tambahkan import halaman laporan

function App() {
  return (
    <Routes>
      <Route path="/input" element={<Input />} />  {/* ✅ Input Data */}
      <Route path="/dashboard" element={<Dashboard />} />  {/* ✅ Dashboard */}
      <Route path="/laporan" element={<Laporan />} />  {/* ✅ Halaman Laporan */}
      <Route path="*" element={<Input />} />  {/* ✅ Default ke Input */}
    </Routes>
  );
}

export default App;
