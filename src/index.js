import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom"; // ⬅️ Tambahkan ini
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <BrowserRouter> {/* ⬅️ Bungkus App di dalam Router */}
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

reportWebVitals();
