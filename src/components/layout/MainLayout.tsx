import React from "react";
import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export const MainLayout: React.FC = () => {
  return (
    <div className="app-container">
      <Header />
      <div className="main-layout">
        <Sidebar />
        <main className="content-area">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
