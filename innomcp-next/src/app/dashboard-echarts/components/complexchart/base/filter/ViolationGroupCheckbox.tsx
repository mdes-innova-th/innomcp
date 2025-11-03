"use client";

import React, { useEffect, useRef, useState } from "react";
import LoadingSpinner from "@/app/components/common/ui/loading-spinner";
import { ViolationGroup } from "./ViolationGroupContext";

interface ViolationGroupCheckboxProps {
  violationGroups: ViolationGroup[];
  loading: boolean;
  selectedGroups: string[];
  setSelectedGroups: (ids: string[]) => void;
}

export const ViolationGroupCheckbox: React.FC<ViolationGroupCheckboxProps> = ({
  violationGroups,
  loading,
  selectedGroups,
  setSelectedGroups,
}) => {
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selectedGroups.length > 0 &&
        selectedGroups.length < violationGroups.length;
    }
  }, [selectedGroups, violationGroups]);

  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  return (
    <div className="flex flex-col w-full mt-0">
      <label
        className="block text-sm font-medium text-gray-700 mb-2 cursor-pointer select-none hover:text-blue-600 transition-colors"
        onClick={toggleVisibility}
        onTouchStart={toggleVisibility}
      >
        <span className="flex items-center gap-1">
          ประเภทความผิด
          <span className="text-xs text-gray-500">{isVisible ? "▼" : "▶"}</span>
        </span>
      </label>
      {isVisible && (
        <>
          {loading ? (
            <span className="flex items-center gap-2 text-xs text-gray-400">
              <LoadingSpinner size="sm" color="blue" />
            </span>
          ) : violationGroups.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <label className="flex items-center gap-1 font-semibold bg-gray-100 px-2 py-1 rounded shadow-sm">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={
                    selectedGroups.length === violationGroups.length &&
                    violationGroups.length > 0
                  }
                  onChange={() => {
                    if (selectedGroups.length === violationGroups.length) {
                      setSelectedGroups([]);
                    } else {
                      setSelectedGroups(violationGroups.map((g) => g.id));
                    }
                  }}
                  className="rounded border-gray-300 focus:ring-blue-500"
                />
                <span className="text-xs">เลือกทั้งหมด</span>
              </label>
              {violationGroups.map((group) => (
                <label
                  key={group.id + group.name}
                  className="flex items-center gap-1 bg-white px-2 py-1 rounded shadow-sm border border-gray-200"
                >
                  <input
                    type="checkbox"
                    checked={selectedGroups.includes(group.id)}
                    onChange={(e) => {
                      let updated: string[];
                      if (e.target.checked) {
                        updated = [...selectedGroups, group.id];
                      } else {
                        updated = selectedGroups.filter(
                          (id) => id !== group.id
                        );
                      }
                      setSelectedGroups(updated);
                    }}
                    className="rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-700">{group.name}</span>
                </label>
              ))}
            </div>
          ) : (
            <span className="text-xs text-gray-400">
              ไม่สามารถแสดงประเภทความผิดได้
            </span>
          )}
        </>
      )}
    </div>
  );
};
