"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/app/context/ThemeContext";

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  error: string | null;
  permission: PermissionState | null;
}

export default function GeolocationManager() {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    error: null,
    permission: null,
  });
  const [showBanner, setShowBanner] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    // Check if geolocation is supported
    if (!("geolocation" in navigator)) {
      setState(prev => ({ ...prev, error: "Geolocation not supported" }));
      return;
    }

    // Check permission status
    if ("permissions" in navigator) {
      navigator.permissions.query({ name: "geolocation" }).then(result => {
        setState(prev => ({ ...prev, permission: result.state }));
        
        if (result.state === "prompt") {
          setShowBanner(true);
        } else if (result.state === "granted") {
          requestLocation();
        }

        result.addEventListener("change", () => {
          setState(prev => ({ ...prev, permission: result.state }));
          if (result.state === "granted") {
            requestLocation();
            setShowBanner(false);
          }
        });
      });
    }
  }, []);

  const requestLocation = () => {
    navigator.geolocation.getCurrentPosition(
      position => {
        setState({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          error: null,
          permission: "granted",
        });
        setShowBanner(false);
        
        // Store in localStorage for AI to access
        localStorage.setItem("userLocation", JSON.stringify({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          timestamp: Date.now(),
        }));
      },
      error => {
        setState(prev => ({
          ...prev,
          error: error.message,
          permission: "denied",
        }));
        setShowBanner(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 300000, // 5 minutes cache
      }
    );
  };

  if (!showBanner) return null;

  return (
    <div
      className={`fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 max-w-md rounded-lg shadow-lg p-4 ${
        theme === "light"
          ? "bg-blue-50 border border-blue-200"
          : "bg-blue-900/20 border border-blue-800"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <svg
            className={`w-6 h-6 ${
              theme === "light" ? "text-blue-600" : "text-blue-400"
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h3
            className={`font-semibold mb-1 ${
              theme === "light" ? "text-blue-900" : "text-blue-300"
            }`}
          >
            📍 อนุญาตให้เข้าถึงตำแหน่งของคุณ
          </h3>
          <p
            className={`text-sm mb-3 ${
              theme === "light" ? "text-blue-800" : "text-blue-400"
            }`}
          >
            AI จะสามารถให้ข้อมูลสภาพอากาศและข่าวสารในพื้นที่ของคุณได้แม่นยำขึ้น
          </p>
          <div className="flex gap-2">
            <button
              onClick={requestLocation}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                theme === "light"
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-blue-500 text-white hover:bg-blue-600"
              }`}
            >
              อนุญาต
            </button>
            <button
              onClick={() => setShowBanner(false)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                theme === "light"
                  ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              ไม่อนุญาต
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
