import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css"; 
import { Toaster } from "react-hot-toast"; 

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* Toaster để hiển thị toast toàn app */}
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: "#333",
          color: "#fff",
          borderRadius: "8px",
          padding: "10px 16px",
        },
        success: {
          iconTheme: {
            primary: "#4ade80",
            secondary: "#fff",
          },
        },
      }}
    />
    <App />
  </React.StrictMode>
);
