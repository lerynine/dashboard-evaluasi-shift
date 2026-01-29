// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Input from "./pages/Input";
import Laporan from "./pages/Laporan";
import WeeklyDashboard from "./pages/WeeklyDashboard";
import KegiatanList from "./pages/KegiatanList";
import DetailKegiatan from "./pages/DetailKegiatan";
import UpdateKegiatan from "./pages/UpdateKegiatan"; // ⭐ TAMBAHAN
import SequencePlannerList from "./pages/SequencePlannerList";
import PlannerForm from "./pages/PlannerForm";

import { PrivateRoute } from "./PrivateRoute";

function App() {
  return (
    <Routes>
      {/* 🔓 PUBLIC */}
      <Route path="/login" element={<Login />} />

      {/* 🔐 PROTECTED */}
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />

      {/* ⭐ LIST KEGIATAN */}
      <Route
        path="/kegiatan"
        element={
          <PrivateRoute>
            <KegiatanList />
          </PrivateRoute>
        }
      />

      {/* ⭐ DETAIL KEGIATAN */}
      <Route
        path="/kegiatan/:id"
        element={
          <PrivateRoute>
            <DetailKegiatan />
          </PrivateRoute>
        }
      />

      {/* ⭐ UPDATE KEGIATAN (BERDASAR ID) */}
      <Route
        path="/kegiatan/:id/update"
        element={
          <PrivateRoute>
            <UpdateKegiatan />
          </PrivateRoute>
        }
      />

      {/* ⭐ INPUT */}
      <Route
        path="/input"
        element={
          <PrivateRoute>
            <Input />
          </PrivateRoute>
        }
      />

      {/* ⭐ LAPORAN */}
      <Route
        path="/laporan"
        element={
          <PrivateRoute>
            <Laporan />
          </PrivateRoute>
        }
      />

      {/* ⭐ WEEKLY */}
      <Route
        path="/weekly"
        element={
          <PrivateRoute>
            <WeeklyDashboard />
          </PrivateRoute>
        }
      />

      {/* ⭐ SEQUENCE PLANNER */}
<Route
  path="/sequence"
  element={
    <PrivateRoute>
      <SequencePlannerList />
    </PrivateRoute>
  }
/>

      {/* ⭐ PLANNER FORM */}
      <Route
        path="/planner/:id"
        element={
          <PrivateRoute>
            <PlannerForm />
          </PrivateRoute>
        }
      />

      {/* ⭐ DEFAULT */}
      <Route path="/" element={<Navigate to="/dashboard" />} />
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

export default App;
