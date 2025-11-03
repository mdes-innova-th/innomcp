"use client";

import React from "react";
import DashboardHome from "./dashboard-echarts/DashboardHome";

export default function Page() {
  return (
    <div className="flex flex-col flex-1 w-full">
      {/* Charts Dashboard Section */}
      <div className="w-full mx-auto mt-8 mb-8 px-4">
        <DashboardHome />
      </div>
    </div>
  );
}
