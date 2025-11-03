import React from "react";
import { postUrlsInBatches } from "@/utils/requestChunks";
import LoadingSpinner from "@/app/components/common/ui/loading-spinner";
import ViolationGroupSelector from "@/app/dashboard-echarts/components/searchurl/filter/ViolationGroupSelector";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faKeyboard,
  faFileUpload,
  faSearch,
  faPercent,
  faRotateRight,
  faFileExcel,
  faFileAlt,
  faUpRightAndDownLeftFromCenter,
  faDownLeftAndUpRightToCenter,
  faCircleStop,
} from "@fortawesome/free-solid-svg-icons";
import * as XLSX from "xlsx";

interface SearchURLProps {
  onSearch?: (url: string) => void;
}

const SearchURL: React.FC<SearchURLProps> = ({ onSearch }) => {
  const [url, setUrl] = React.useState("");
  const [selectedFileName, setSelectedFileName] = React.useState<string | null>(
    null
  );
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [inputMode, setInputMode] = React.useState<"text" | "file">("text");
  const [searchMode, setSearchMode] = React.useState<
    "detailed" | "exact" | "partial"
  >("detailed");
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Search result state inside this component now
  const [searchResults, setSearchResults] = React.useState<
    Array<{
      input: string;
      outputs: Array<{
        variant: string;
        note: string;
        createDate?: string;
        orderNo?: string;
        orderedDate?: string;
        type?: string;
      }>;
    }>
  >([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // batching progress state and configurable options
  const [batchTotal, setBatchTotal] = React.useState(0);
  const [chunkSize, setChunkSize] = React.useState<number>(50);
  const [concurrencyVal, setConcurrencyVal] = React.useState<number>(4);
  // per-chunk status: 'pending' | 'in-progress' | 'success' | 'error'
  const [chunkStatuses, setChunkStatuses] = React.useState<
    Array<"pending" | "in-progress" | "success" | "error">
  >([]);

  // Store original Excel data for modified export
  const [originalExcelData, setOriginalExcelData] = React.useState<{
    workbook: XLSX.WorkBook | null;
    urlColumnIndex: number;
    fileName: string;
  }>({
    workbook: null,
    urlColumnIndex: -1,
    fileName: "",
  });

  // Modal state
  const [modalConfig, setModalConfig] = React.useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "error" | "warning" | "info";
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });

  const showModal = (
    title: string,
    message: string,
    type: "error" | "warning" | "info" = "info"
  ) => {
    setModalConfig({ isOpen: true, title, message, type });
  };

  const closeModal = () => {
    setModalConfig({ ...modalConfig, isOpen: false });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setSelectedFileName(null);
      setSelectedFile(null);
      return;
    }

    setSelectedFileName(file.name);
    setSelectedFile(file);
    console.log("Selected file:", file.name);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const file = e.dataTransfer.files?.[0] ?? null;
    if (!file) {
      setSelectedFileName(null);
      setSelectedFile(null);
      return;
    }

    const name = file.name.toLowerCase();
    if (
      !name.endsWith(".xlsx") &&
      !name.endsWith(".xls") &&
      !name.endsWith(".txt")
    ) {
      console.warn(
        "Dropped file is not supported (expect .xlsx/.xls/.txt):",
        file.name
      );
      return;
    }

    setSelectedFileName(file.name);
    setSelectedFile(file);
    console.log("Dropped file:", file.name);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleClear = () => {
    setUrl("");
    setSelectedFileName(null);
    setSelectedFile(null);
    setSearchResults([]);
    // also clear batching UI state
    setChunkStatuses([]);
    setBatchTotal(0);
    setOriginalExcelData({
      workbook: null,
      urlColumnIndex: -1,
      fileName: "",
    });
    try {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch {
      // ignore
    }
  };

  // Normalize backend response into local shape
  const normalizeResponse = (data: unknown) => {
    if (!Array.isArray(data))
      return [] as Array<{
        input: string;
        outputs: Array<{
          variant: string;
          note: string;
          createDate?: string;
          orderNo?: string;
          orderedDate?: string;
        }>;
      }>;
    return data
      .filter((x) => x && typeof x === "object")
      .map((x) => {
        const obj = x as Record<string, unknown>;
        const input = String(obj.input ?? "");
        if (Array.isArray(obj.outputs)) {
          const outputsRaw = obj.outputs as unknown[];
          const outs = outputsRaw.map((o) => {
            const rec = (o ?? {}) as Record<string, unknown>;
            return {
              variant: String(rec.variant ?? ""),
              note: String(rec.note ?? ""),
              createDate: rec.createDate ? String(rec.createDate) : undefined,
              orderNo: rec.orderNo ? String(rec.orderNo) : undefined,
              orderedDate: rec.orderedDate
                ? String(rec.orderedDate)
                : undefined,
              type: rec.type ? String(rec.type) : undefined,
            };
          });
          return { input, outputs: outs };
        }

        if (typeof obj.output === "string") {
          const outStr = String(obj.output);
          let note = outStr;
          if (input && outStr.startsWith(input)) {
            note = outStr.slice(input.length);
          }
          note = note.replace(/^,*/, "").trim();
          return { input, outputs: [{ variant: input, note }] };
        }

        return { input, outputs: [] };
      });
  };

  const handleSearch = async () => {
    // Validate input based on mode
    if (inputMode === "text" && !url.trim()) {
      showModal("ข้อผิดพลาด", "กรุณาป้อน URL ที่ต้องการค้นหา", "warning");
      return;
    }
    if (inputMode === "file" && !selectedFile) {
      showModal("ข้อผิดพลาด", "กรุณาเลือกไฟล์ที่ต้องการอัปโหลด", "warning");
      return;
    }

    try {
      setIsSearching(true);
      setSearchResults([]);

      let inputs: string[] = [];

      // Handle text input mode
      if (inputMode === "text") {
        inputs = url
          .split(/[\,\n]+/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
      // Handle file input mode
      else if (inputMode === "file" && selectedFile) {
        // Check file type and parse accordingly
        if (selectedFile.name.toLowerCase().endsWith(".txt")) {
          const fileContent = await selectedFile.text();
          inputs = fileContent
            .split(/[\r\n]+/)
            .map((s) => s.trim())
            .filter(Boolean);
        } else if (
          selectedFile.name.toLowerCase().endsWith(".xlsx") ||
          selectedFile.name.toLowerCase().endsWith(".xls")
        ) {
          // Read Excel file
          try {
            const arrayBuffer = await selectedFile.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: "array" });

            // Get first sheet
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            // Convert to JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet, {
              header: 1,
            }) as unknown[][];

            // Check if file has data
            if (!jsonData || jsonData.length === 0) {
              showModal(
                "ไฟล์ว่างเปล่า",
                "ไฟล์ Excel ว่างเปล่า กรุณาตรวจสอบไฟล์",
                "error"
              );
              setIsSearching(false);
              return;
            }

            // Try to find URL column
            const headers = jsonData[0] as string[];
            let urlColumnIndex = -1;

            // Look for column named "url" or "URL" (case insensitive)
            if (headers && Array.isArray(headers)) {
              urlColumnIndex = headers.findIndex(
                (h) => h && String(h).toLowerCase().trim() === "url"
              );
            }

            // If no header named "url", show error
            if (urlColumnIndex === -1) {
              const headerList =
                headers && Array.isArray(headers)
                  ? headers
                      .filter((h) => h)
                      .map((h) => `"${h}"`)
                      .join(", ")
                  : "ไม่พบหัวคอลัมน์";

              showModal(
                "ไม่พบคอลัมน์ URL",
                `ไม่พบคอลัมน์ชื่อ "url" ในไฟล์ Excel\nชื่อคอลัมน์ที่พบ: ${headerList}\nกรุณาตรวจสอบว่าไฟล์ Excel มีคอลัมน์ชื่อ "url"\n(ตัวพิมพ์เล็กหรือใหญ่ก็ได้)`,
                "error"
              );
              setIsSearching(false);
              return;
            }

            // Store original Excel data for modified export
            setOriginalExcelData({
              workbook: workbook,
              urlColumnIndex: urlColumnIndex,
              fileName: selectedFile.name,
            });

            // Extract URLs from the column (skip header row)
            for (let i = 1; i < jsonData.length; i++) {
              const row = jsonData[i];
              if (row && Array.isArray(row) && row[urlColumnIndex]) {
                const value = String(row[urlColumnIndex]).trim();
                if (value) {
                  inputs.push(value);
                }
              }
            }

            if (inputs.length === 0) {
              showModal(
                "ไม่พบข้อมูล",
                "ไม่พบ URL ในคอลัมน์ที่ระบุ กรุณาตรวจสอบข้อมูลในไฟล์",
                "warning"
              );
              setIsSearching(false);
              return;
            }
          } catch (error) {
            console.error("Error reading Excel file:", error);
            showModal(
              "ข้อผิดพลาด",
              "เกิดข้อผิดพลาดในการอ่านไฟล์ Excel กรุณาลองใหม่อีกครั้ง",
              "error"
            );
            setIsSearching(false);
            return;
          }
        }
      }

      if (inputs.length === 0) {
        showModal("ไม่พบข้อมูล", "ไม่พบ URL ที่ต้องการค้นหา", "warning");
        setIsSearching(false);
        return;
      }

      const host = process.env.NEXT_PUBLIC_NODE_HOST || "";
      const endpoint = `${host}/api/urlsearch`;
      // If the user selected every available group, send an empty array so
      // backend will treat it as "no group filter" and avoid adding WHERE.
      const vgToSend =
        availableGroupIds.length > 0 &&
        selectedGroups.length === availableGroupIds.length
          ? []
          : selectedGroups;

      // initialize batching progress (we only track total count)
      setBatchTotal(inputs.length);

      // prepare chunk status array
      const totalChunks = Math.max(1, Math.ceil(inputs.length / chunkSize));
      setChunkStatuses(new Array(totalChunks).fill("pending"));

      // Use the requestChunks helper to post URLs in batches of configured chunkSize
      // create an AbortController so we can cancel the whole batch
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const results = await postUrlsInBatches(
        endpoint,
        inputs,
        { violationGroups: vgToSend, matchMode: searchMode },
        {
          chunkSize: chunkSize,
          concurrency: concurrencyVal,
          signal: controller.signal,
          onProgress: (_processed: number, total: number) => {
            // only track total URLs; per-item processed count is not displayed
            setBatchTotal(total);
          },
          onChunk: (index, status) => {
            setChunkStatuses((prev) => {
              const next = [...prev];
              // ignore out-of-range indices just in case
              if (index >= 0 && index < next.length) next[index] = status;
              return next;
            });
          },
        }
      );

      let data: unknown = results;
      // Diagnostic: log what the batch helper returned so we can debug missing results
      try {
        console.debug("postUrlsInBatches returned:", results);
      } catch {}

      // Some proxies/helpers may wrap the real array in layers like
      // { data: [...] } per chunk. We need to deeply collect inner items so
      // normalizeResponse receives the actual item objects.
      const collectItems = (v: unknown, out: unknown[]) => {
        if (v === null || v === undefined) return;
        if (Array.isArray(v)) {
          for (const el of v) collectItems(el, out);
          return;
        }
        if (typeof v === "object") {
          const rec = v as Record<string, unknown>;
          // If this object wraps an array under `data`, dive into it
          if (Array.isArray(rec.data)) {
            collectItems(rec.data, out);
            return;
          }
          // If object is a plain item (has 'input' or 'outputs'), accept it
          if (rec.input !== undefined || rec.outputs !== undefined) {
            out.push(rec);
            return;
          }
          // Otherwise, if it has enumerable properties that are arrays, try to collect them
          for (const k of Object.keys(rec)) {
            const val = rec[k];
            if (Array.isArray(val)) collectItems(val, out);
          }
          return;
        }
        // primitive values are ignored
      };

      const flattened: unknown[] = [];
      collectItems(data, flattened);
      try {
        console.debug("Flattened search response items:", flattened.length);
      } catch {}

      // Use the flattened items as the data for normalization. If nothing was
      // collected but `data` itself is an array-like object, fall back to data.
      if (flattened.length > 0) data = flattened;

      const mapped = normalizeResponse(data) as Array<{
        input: string;
        outputs: Array<{
          variant: string;
          note: string;
          createDate?: string;
          orderNo?: string;
          orderedDate?: string;
          type?: string;
        }>;
      }>;
      setSearchResults(mapped);

      // call optional external handler for compatibility
      try {
        if (onSearch) onSearch(url);
      } catch {}
    } catch (err) {
      // If the operation was aborted by the user, show a friendly info modal instead of error
      const errObj = err as { name?: string; message?: string } | undefined;
      const isAbort =
        (errObj &&
          (errObj.name === "AbortError" || errObj.message === "Aborted")) ||
        (abortControllerRef.current &&
          abortControllerRef.current.signal.aborted);

      if (isAbort) {
        showModal("หยุด", "หยุดการค้นหาแล้ว", "info");
      } else {
        console.error("Search error:", err);
        showModal(
          "ข้อผิดพลาด",
          "เกิดข้อผิดพลาดในการค้นหา กรุณาลองใหม่อีกครั้ง",
          "error"
        );
      }
    } finally {
      setIsSearching(false);
      // clear controller
      try {
        abortControllerRef.current = null;
      } catch {}
    }
  };

  const handleCancel = () => {
    try {
      abortControllerRef.current?.abort();
    } catch {}
    setIsSearching(false);
  };

  // Export to Excel function
  const handleExportToExcel = () => {
    if (searchResults.length === 0) {
      showModal("ไม่มีข้อมูล", "ไม่มีผลการค้นหาที่จะส่งออก", "warning");
      return;
    }

    try {
      // Prepare data for export
      const exportData: Array<{
        ลำดับ: number | string;
        "Input URL": string;
        "Variant URL": string;
        Status: string;
        วันที่บันทึกข้อมูล: string;
        คำสั่งศาล: string;
        วันที่คำสั่งศาล: string;
        ประเภท: string;
      }> = [];

      let inputRowNumber = 1;
      searchResults.forEach((r) => {
        r.outputs.forEach((o, j) => {
          // Format dates if available
          const createDate = o.createDate
            ? new Date(o.createDate).toLocaleString("th-TH", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })
            : "";
          const orderNo = o.orderNo || "";
          const orderedDate = o.orderedDate
            ? new Date(o.orderedDate).toLocaleDateString("th-TH", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              })
            : "";

          exportData.push({
            ลำดับ: j === 0 ? inputRowNumber : "", // เลขลำดับเฉพาะแถว input เท่านั้น
            "Input URL": j === 0 ? r.input : "",
            "Variant URL": o.variant,
            Status: o.note,
            วันที่บันทึกข้อมูล: createDate,
            คำสั่งศาล: orderNo,
            วันที่คำสั่งศาล: orderedDate,
            ประเภท: o.type || "",
          });
        });
        inputRowNumber++; // เพิ่มเลขลำดับเฉพาะหลังจากประมวลผล input แต่ละตัวแล้ว
      });

      // Create worksheet from data
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      ws["!cols"] = [
        { wch: 8 }, // ลำดับ
        { wch: 50 }, // Input URL
        { wch: 50 }, // Variant URL
        { wch: 20 }, // Status
        { wch: 20 }, // วันที่บันทึกข้อมูล
        { wch: 15 }, // คำสั่งศาล
        { wch: 20 }, // วันที่คำสั่งศาล
        { wch: 20 }, // ประเภท
      ];

      // Create workbook and add worksheet
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Search Results");

      // Generate file name with timestamp
      const timestamp = new Date()
        .toLocaleString("th-TH", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
        .replace(/\//g, "-")
        .replace(/:/g, "-")
        .replace(/, /g, "_");

      const fileName = `URL_Search_Results_${timestamp}.xlsx`;

      // Save file
      XLSX.writeFile(wb, fileName);

      showModal(
        "สำเร็จ",
        `ส่งออกข้อมูลเป็นไฟล์ Excel สำเร็จ\nชื่อไฟล์: ${fileName}`,
        "info"
      );
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      showModal(
        "ข้อผิดพลาด",
        "เกิดข้อผิดพลาดในการส่งออกข้อมูล กรุณาลองใหม่อีกครั้ง",
        "error"
      );
    }
  };

  // Export modified Excel with results inserted
  const handleExportModifiedExcel = () => {
    if (searchResults.length === 0) {
      showModal("ไม่มีข้อมูล", "ไม่มีผลการค้นหาที่จะส่งออก", "warning");
      return;
    }

    if (!originalExcelData.workbook) {
      showModal(
        "ข้อผิดพลาด",
        "ไม่พบข้อมูลไฟล์ต้นฉบับ กรุณาอัปโหลดไฟล์ Excel อีกครั้ง",
        "error"
      );
      return;
    }

    try {
      // Clone the original workbook
      const wb = originalExcelData.workbook;
      const firstSheetName = wb.SheetNames[0];
      const worksheet = wb.Sheets[firstSheetName];

      // Convert to JSON to manipulate
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
      }) as unknown[][];

      if (!jsonData || jsonData.length === 0) {
        showModal("ข้อผิดพลาด", "ไม่สามารถอ่านข้อมูลจากไฟล์ได้", "error");
        return;
      }

      // Create new data array with inserted results
      const newData: unknown[][] = [];
      const headers = jsonData[0] as unknown[];
      const urlColumnIndex = originalExcelData.urlColumnIndex;

      // Add new columns after original columns
      const newHeaders = [
        ...headers,
        "Variant URL",
        "Status",
        "วันที่บันทึกข้อมูล",
        "คำสั่งศาล",
        "วันที่คำสั่งศาล",
        "ประเภท",
      ];
      newData.push(newHeaders);

      // Create a map of input URLs to their results
      const resultsMap = new Map<
        string,
        Array<{
          variant: string;
          note: string;
          createDate?: string;
          orderNo?: string;
          orderedDate?: string;
          type?: string;
        }>
      >();
      searchResults.forEach((r) => {
        resultsMap.set(r.input.toLowerCase().trim(), r.outputs);
      });

      // Process each data row
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || !Array.isArray(row)) continue;

        // Check if this row has a URL that was searched
        if (row[urlColumnIndex]) {
          const urlValue = String(row[urlColumnIndex]).toLowerCase().trim();
          const results = resultsMap.get(urlValue);

          if (results && results.length > 0) {
            // Add the original row with first result
            const firstResult = results[0];
            const createDate = firstResult.createDate
              ? new Date(firstResult.createDate).toLocaleString("th-TH", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })
              : "";
            const orderNo = firstResult.orderNo || "";
            const orderedDate = firstResult.orderedDate
              ? new Date(firstResult.orderedDate).toLocaleDateString("th-TH", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                })
              : "";
            const firstRow = [
              ...row,
              firstResult.variant,
              firstResult.note,
              createDate,
              orderNo,
              orderedDate,
              firstResult.type || "",
            ];
            newData.push(firstRow);

            // If there are more results, insert additional rows
            for (let j = 1; j < results.length; j++) {
              const result = results[j];
              const resultCreateDate = result.createDate
                ? new Date(result.createDate).toLocaleString("th-TH", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })
                : "";
              const resultOrderNo = result.orderNo || "";
              const resultOrderedDate = result.orderedDate
                ? new Date(result.orderedDate).toLocaleDateString("th-TH", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  })
                : "";
              // Create a row with empty cells for original columns, then add variant, note, and dates
              const emptyRow = new Array(headers.length).fill("");
              // Copy the URL to keep reference
              emptyRow[urlColumnIndex] = row[urlColumnIndex];
              const resultRow = [
                ...emptyRow,
                result.variant,
                result.note,
                resultCreateDate,
                resultOrderNo,
                resultOrderedDate,
                result.type || "",
              ];
              newData.push(resultRow);
            }
          } else {
            // No results found for this URL, add original row with empty result columns
            newData.push([...row, "", "", "", "", ""]);
          }
        } else {
          // No URL in this row, add original row with empty result columns
          newData.push([...row, "", "", "", "", ""]);
        }
      }

      // Create new worksheet from modified data
      const newWs = XLSX.utils.aoa_to_sheet(newData);

      // Set column widths - copy original widths and add new columns
      const originalCols = worksheet["!cols"] || [];
      const newCols = [...originalCols];

      // Add width for "Variant URL" column
      newCols.push({ wch: 50 });

      // Add width for "Status" column
      newCols.push({ wch: 30 });

      // Add width for "วันที่บันทึกข้อมูล" column
      newCols.push({ wch: 20 });

      // Add width for "คำสั่งศาล" column
      newCols.push({ wch: 15 });

      // Add width for "วันที่คำสั่งศาล" column
      newCols.push({ wch: 20 });

      // Add width for "ประเภท" column
      newCols.push({ wch: 20 });

      newWs["!cols"] = newCols;

      // Create new workbook
      const newWb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(newWb, newWs, firstSheetName);

      // Generate file name with "mod-" prefix
      const originalFileName = originalExcelData.fileName.replace(
        /\.xlsx?$/i,
        ""
      );
      const timestamp = new Date()
        .toLocaleString("th-TH", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
        .replace(/\//g, "-")
        .replace(/:/g, "-")
        .replace(/, /g, "_");

      const fileName = `mod-${originalFileName}_${timestamp}.xlsx`;

      // Save file
      XLSX.writeFile(newWb, fileName);

      showModal(
        "สำเร็จ",
        `ส่งออกแบบรวมไฟล์ Excel เดิมสำเร็จ\nชื่อไฟล์: ${fileName}`,
        "info"
      );
    } catch (error) {
      console.error("Error exporting modified Excel:", error);
      showModal(
        "ข้อผิดพลาด",
        "เกิดข้อผิดพลาดในการส่งออกแบบรวมไฟล์ Excel เดิม กรุณาลองใหม่อีกครั้ง",
        "error"
      );
    }
  };

  // --- Violation group (ประเภทความผิด) fetching and selection ---
  // selected violation group ids (kept in parent so we can include them in search)
  const [selectedGroups, setSelectedGroups] = React.useState<string[]>([]);
  // available group ids reported by child selector so we can detect "all"
  const [availableGroupIds, setAvailableGroupIds] = React.useState<string[]>(
    []
  );

  // Load and persist selected groups in localStorage
  const vgStorageKey = "search_violationGroups_selected";

  React.useEffect(() => {
    // Load persisted selection if any
    try {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem(vgStorageKey);
        if (stored) {
          const arr = JSON.parse(stored);
          if (Array.isArray(arr)) setSelectedGroups(arr);
        }
      }
    } catch {}
  }, []);

  React.useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(vgStorageKey, JSON.stringify(selectedGroups));
      }
    } catch {}
  }, [selectedGroups]);

  // Search mode: detailed -> check variants (default), exact -> only check exact provided value
  // persisted selection is not necessary but could be added later

  return (
    <div className="p-4 bg-white dark:bg-white">
      <>
        {modalConfig.isOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
            onClick={closeModal}
          >
            <div
              className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                className={`px-6 py-4 ${
                  modalConfig.type === "error"
                    ? "bg-red-500"
                    : modalConfig.type === "warning"
                    ? "bg-yellow-500"
                    : "bg-blue-500"
                }`}
              >
                <h3 className="text-lg font-bold text-white">
                  {modalConfig.title}
                </h3>
              </div>

              {/* Body */}
              <div className="px-6 py-4">
                <p className="text-gray-700 whitespace-pre-line break-words">
                  {modalConfig.message}
                </p>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-gray-50 flex justify-end">
                <button
                  onClick={closeModal}
                  className={`px-6 py-2 rounded-lg font-medium transition-all shadow-md cursor-pointer ${
                    modalConfig.type === "error"
                      ? "bg-red-500 hover:bg-red-600"
                      : modalConfig.type === "warning"
                      ? "bg-yellow-500 hover:bg-yellow-600"
                      : "bg-blue-500 hover:bg-blue-600"
                  } text-white`}
                >
                  ปิด
                </button>
              </div>
            </div>
          </div>
        )}
        <h2 className="text-xl font-bold mb-4 text-gray-700">ค้นหา URL</h2>

        {/* Input Mode Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            เลือกวิธีการค้นหา
          </label>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setInputMode("text")}
              className={`flex-1 flex items-center justify-center px-4 py-2 rounded-lg border-2 transition-all cursor-pointer ${
                inputMode === "text"
                  ? "border-blue-500 bg-blue-50 text-blue-700 font-semibold"
                  : "border-gray-300 bg-white text-gray-600 hover:border-blue-300"
              }`}
            >
              <FontAwesomeIcon icon={faKeyboard} className="mr-2 w-8 h-8" />
              ป้อน URL
            </button>
            <button
              type="button"
              onClick={() => setInputMode("file")}
              className={`flex-1 flex items-center justify-center px-4 py-2 rounded-lg border-2 transition-all cursor-pointer ${
                inputMode === "file"
                  ? "border-blue-500 bg-blue-50 text-blue-700 font-semibold"
                  : "border-gray-300 bg-white text-gray-600 hover:border-blue-300"
              }`}
            >
              <FontAwesomeIcon icon={faFileUpload} className="mr-2 w-8 h-8" />
              อัปโหลดไฟล์
            </button>
          </div>
        </div>

        {/* removed top progress UI; progress moved under batch options */}

        {/* Text Input Mode */}
        {inputMode === "text" && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ป้อน URL (คั่นด้วยเครื่องหมาย , หรือขึ้นบรรทัดใหม่)
            </label>
            <textarea
              className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
              placeholder={`ตัวอย่าง:
https://example.com, https://another-example.com 
หรือ
https://example.com
https://another-example.com`}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              rows={6}
            ></textarea>
          </div>
        )}

        {/* File Upload Mode */}
        {inputMode === "file" && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              อัปโหลดไฟล์ (.txt หรือ .xlsx)
            </label>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`flex items-center justify-center w-full p-6 border-2 rounded-lg mb-2 transition-all ${
                isDragOver
                  ? "border-blue-500 bg-blue-50 border-solid"
                  : "border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100"
              }`}
            >
              <div className="text-center w-full">
                <input
                  id="file-input"
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.xlsx,.xls,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  onChange={handleFileChange}
                  aria-label="เลือกไฟล์ .txt หรือ .xlsx"
                  className="hidden"
                />

                {selectedFileName ? (
                  <div>
                    <p className="text-sm font-medium text-green-600 mb-2 flex justify-center items-center">
                      ไฟล์ที่เลือก:
                    </p>
                    <div className="flex justify-center items-center gap-2">
                      {selectedFileName.toLowerCase().endsWith(".xlsx") ||
                      selectedFileName.toLowerCase().endsWith(".xls") ? (
                        <FontAwesomeIcon
                          icon={faFileExcel}
                          className="text-green-600 w-8 h-8"
                        />
                      ) : selectedFileName.toLowerCase().endsWith(".txt") ? (
                        <FontAwesomeIcon
                          icon={faFileAlt}
                          className="text-blue-600 w-8 h-8"
                        />
                      ) : (
                        <FontAwesomeIcon
                          icon={faFileAlt}
                          className="text-gray-600 w-8 h-8"
                        />
                      )}
                      <p className="text-sm text-gray-700 font-semibold">
                        {selectedFileName}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label
                      htmlFor="file-input"
                      className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg cursor-pointer hover:bg-blue-600 transition-colors mb-2"
                    >
                      <FontAwesomeIcon
                        icon={faFileUpload}
                        className="mr-2 w-8 h-8"
                      />
                      เลือกไฟล์
                    </label>
                    <p className="text-sm text-gray-600">
                      หรือลากไฟล์มาวางที่นี่
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      รองรับไฟล์ .txt (บรรทัดละ 1 URL หรือคั่นด้วยเครื่องหมาย ,)
                      และ .xlsx (ต้องกำหนดหัวคอลัมน์ชื่อ &quot;url&quot;)
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mb-4">
          <ViolationGroupSelector
            selectedGroups={selectedGroups}
            setSelectedGroups={setSelectedGroups}
            onAvailableGroups={setAvailableGroupIds}
            disabled={isSearching}
          />
        </div>

        {/* Search Mode Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            รูปแบบการค้นหา
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setSearchMode("detailed")}
              aria-pressed={searchMode === "detailed"}
              title="แบบละเอียด (ค้นหาทุกโปรโตคอลและ path)"
              disabled={isSearching}
              className={`inline-flex items-center gap-3 px-3 py-2 rounded-lg border-2 transition-all cursor-pointer ${
                searchMode === "detailed"
                  ? "border-blue-500 bg-blue-50 text-blue-700 font-semibold"
                  : "border-gray-300 bg-white text-gray-600 hover:border-blue-300"
              } ${isSearching ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <FontAwesomeIcon
                icon={faUpRightAndDownLeftFromCenter}
                className="w-5 h-5"
              />
              <span className="text-sm">แบบละเอียด</span>
              <span className="text-xs text-gray-500">
                (ค้นหาทุกโดเมน http, https และ path)
              </span>
            </button>

            {/* Exact: only exact provided value */}
            <button
              type="button"
              onClick={() => setSearchMode("exact")}
              aria-pressed={searchMode === "exact"}
              title="แบบตรง (ค้นหาเฉพาะตรงกับค่าที่ป้อน)"
              disabled={isSearching}
              className={`inline-flex items-center gap-3 px-3 py-2 rounded-lg border-2 transition-all cursor-pointer ${
                searchMode === "exact"
                  ? "border-blue-500 bg-blue-50 text-blue-700 font-semibold"
                  : "border-gray-300 bg-white text-gray-600 hover:border-blue-300"
              } ${isSearching ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <FontAwesomeIcon
                icon={faDownLeftAndUpRightToCenter}
                className="w-5 h-5"
              />
              <span className="text-sm">แบบตรง</span>
              <span className="text-xs text-gray-500">
                (ค้นหาเฉพาะตรงกับค่าที่ป้อน)
              </span>
            </button>

            {/* Partial: partial match (search partial in URL or domain) */}
            <button
              type="button"
              onClick={() => setSearchMode("partial")}
              aria-pressed={searchMode === "partial"}
              title="แบบบางส่วน (ค้นหาบางส่วนใน URL หรือโดเมน)"
              disabled={isSearching}
              className={`inline-flex items-center gap-3 px-3 py-2 rounded-lg border-2 transition-all cursor-pointer ${
                searchMode === "partial"
                  ? "border-blue-500 bg-blue-50 text-blue-700 font-semibold"
                  : "border-gray-300 bg-white text-gray-600 hover:border-blue-300"
              } ${isSearching ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <FontAwesomeIcon icon={faPercent} className="w-5 h-5" />
              <span className="text-sm">แบบบางส่วน</span>
              <span className="text-xs text-gray-500">
                (ค้นหาบางส่วนใน URL หรือโดเมน)
              </span>
            </button>
          </div>
        </div>

        {/* Batch options (chunk size & concurrency) */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-gray-700">ขนาดงาน (chunk):</label>
            <div className="text-sm font-medium text-gray-700">{chunkSize}</div>
          </div>
          <input
            type="range"
            min={1}
            max={1000}
            value={chunkSize}
            onChange={(e) =>
              setChunkSize(Math.max(1, Number(e.target.value) || 1))
            }
            disabled={isSearching}
            className={`w-full mb-3 ${
              isSearching ? "opacity-60 cursor-not-allowed" : ""
            }`}
            aria-label="ขนาดงาน (chunk)"
          />

          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-gray-700">concurrency:</label>
            <div className="text-sm font-medium text-gray-700">
              {concurrencyVal}
            </div>
          </div>
          <input
            type="range"
            min={1}
            max={20}
            value={concurrencyVal}
            onChange={(e) =>
              setConcurrencyVal(Math.max(1, Number(e.target.value) || 1))
            }
            disabled={isSearching}
            className={`w-full ${
              isSearching ? "opacity-60 cursor-not-allowed" : ""
            }`}
            aria-label="concurrency"
          />
        </div>

        {/* Chunk activity shown directly under batch options */}
        {chunkStatuses && chunkStatuses.length > 0 && (
          <div className="mb-4">
            <div className="text-md text-gray-700 mb-2">สถานะการงานค้นหา</div>

            {/* show only total URLs being processed (no processed/total or chunk counts) */}
            {batchTotal > 0 && (isSearching || chunkStatuses.length > 0) && (
              <div className="text-sm text-gray-700 mb-1">
                กำลังประมวลผล {batchTotal} รายการ
              </div>
            )}

            <div className="flex flex-wrap gap-1">
              {chunkStatuses.map((s, i) => {
                const bgClass =
                  s === "success"
                    ? "bg-green-200 dark:bg-green-200"
                    : s === "in-progress"
                    ? "bg-yellow-200 dark:bg-yellow-200"
                    : s === "error"
                    ? "bg-red-200 dark:bg-red-200"
                    : "bg-gray-100 dark:bg-gray-100";
                const textClass = "text-gray-800 dark:text-gray-800";
                const displayIndex = String(i + 1).padStart(2, "0");
                return (
                  <div
                    key={`chunk-ctl-${i}`}
                    className={`${bgClass} ${textClass} px-2 py-1 text-xs font-medium border border-gray-400`}
                    title={`Chunk ${displayIndex}: ${s}`}
                  >
                    งาน {displayIndex}: {s}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            className={`inline-flex items-center px-4 py-2 rounded-lg font-medium transition-all ${
              (inputMode === "text" && url.trim()) ||
              (inputMode === "file" && selectedFileName)
                ? "bg-blue-500 text-white hover:bg-blue-600 shadow-md cursor-pointer"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
            onClick={handleSearch}
            disabled={
              isSearching ||
              (inputMode === "text" && !url.trim()) ||
              (inputMode === "file" && !selectedFileName)
            }
          >
            {isSearching ? (
              <>
                <LoadingSpinner size="sm" color="white" />
                <span className="ml-2">กำลังค้นหา...</span>
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faSearch} className="w-6 h-6" />
                <span className="ml-2">ค้นหา</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={!isSearching}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              isSearching
                ? "bg-yellow-500 text-white hover:bg-yellow-600 shadow-md cursor-pointer"
                : "bg-gray-200 text-gray-500 cursor-not-allowed"
            }`}
          >
            <FontAwesomeIcon icon={faCircleStop} className="w-5 h-5" />
            <span className="ml-2">หยุด</span>
          </button>

          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium transition-all shadow-md cursor-pointer"
          >
            <FontAwesomeIcon icon={faRotateRight} className="w-6 h-6" />
            <span className="ml-2">รีเซ็ต</span>
          </button>
        </div>

        {/* Results area inside SearchURL */}
        <div className="mt-4">
          {searchResults.length > 0 && (
            <div className="mt-2">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-medium">ผลการค้นหา</h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleExportToExcel}
                    className="inline-flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium transition-all shadow-md cursor-pointer"
                    title="ส่งออกเป็นไฟล์ Excel"
                  >
                    <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5" />
                    <span className="ml-2">ส่งออก Excel</span>
                  </button>
                  {originalExcelData.workbook && (
                    <button
                      type="button"
                      onClick={handleExportModifiedExcel}
                      className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium transition-all shadow-md cursor-pointer"
                      title="ส่งออกไฟล์ Excel แบบแทรกผลลัพธ์ (mod-)"
                    >
                      <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5" />
                      <span className="ml-2">ส่งออกแบบรวมไฟล์ Excel เดิม</span>
                    </button>
                  )}
                </div>
              </div>
              {/* จำนวนรายการที่พบ (แสดงด้านบนของตาราง) */}
              <div className="text-sm text-blue-500 mb-2 font-bold">
                {`จำนวนรายการที่พบ: ${searchResults.reduce(
                  (acc, r) =>
                    acc + (Array.isArray(r.outputs) ? r.outputs.length : 0),
                  0
                )}`}
              </div>

              <div className="max-h-72 overflow-y-auto pr-2">
                <table className="min-w-full text-sm text-left border-collapse text-black table-fixed border border-gray-200">
                  <thead>
                    <tr className="bg-gray-100 sticky top-0">
                      <th className="px-2 py-2 border-b border-r border-gray-200 w-12">
                        #
                      </th>
                      <th className="px-2 py-2 border-b border-r border-gray-200 w-64">
                        Input URL
                      </th>
                      <th className="px-2 py-2 border-b border-r border-gray-200">
                        Variant URL
                      </th>
                      <th className="px-1 py-2 border-b border-r border-gray-200 w-36">
                        Status
                      </th>
                      <th className="px-1 py-2 border-b border-r border-gray-200 w-40">
                        วันที่บันทึกข้อมูล
                      </th>
                      <th className="px-1 py-2 border-b border-r border-gray-200 w-24">
                        คำสั่งศาล
                      </th>
                      <th className="px-1 py-2 border-b border-r border-gray-200 w-40">
                        วันที่คำสั่งศาล
                      </th>
                      <th className="px-1 py-2 border-b border-r border-gray-200 w-28">
                        ประเภท
                      </th>
                      <th className="px-1 py-2 border-b border-gray-200 w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((r, idx) =>
                      r.outputs.map((o, j) => {
                        const n = String(o.note ?? "").toLowerCase();
                        const exists =
                          n.includes("มีอยู่แล้ว") ||
                          n.includes("[มีอยู่แล้ว]");
                        const rowBg = exists
                          ? "bg-red-200"
                          : j % 2 === 0
                          ? "bg-white"
                          : "bg-gray-50";

                        // Format dates for display
                        const createDate =
                          o.createDate && exists
                            ? new Date(o.createDate).toLocaleString("th-TH", {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "";
                        const orderNo = o.orderNo && exists ? o.orderNo : "";
                        const orderedDate =
                          o.orderedDate && exists
                            ? new Date(o.orderedDate).toLocaleDateString(
                                "th-TH",
                                {
                                  year: "numeric",
                                  month: "2-digit",
                                  day: "2-digit",
                                }
                              )
                            : "";

                        return (
                          <tr key={`${idx}-${j}`} className={rowBg}>
                            <td className="align-top px-2 py-2 border-b border-r border-gray-200 w-12">{`${
                              idx + 1
                            }`}</td>
                            <td className="align-top px-2 py-2 border-b border-r border-gray-200 w-64 break-words">
                              {j === 0 ? r.input : ""}
                            </td>
                            <td className="align-top px-2 py-2 border-b border-r border-gray-200 break-words">
                              {o.variant}
                            </td>
                            <td className="align-top px-1 py-2 border-b border-r border-gray-200 w-36">
                              {o.note}
                            </td>
                            <td className="align-top px-1 py-2 border-b border-r border-gray-200 w-40 text-xs">
                              {createDate}
                            </td>
                            <td className="align-top px-1 py-2 border-b border-r border-gray-200 w-24 text-xs">
                              {orderNo}
                            </td>
                            <td className="align-top px-1 py-2 border-b border-r border-gray-200 w-40 text-xs">
                              {orderedDate}
                            </td>
                            <td className="align-top px-1 py-2 border-b border-r border-gray-200 w-28 text-xs">
                              {o.type || ""}
                            </td>
                            <td className="align-top px-1 py-2 border-b border-gray-200 w-12 text-center">
                              {(() => {
                                const n2 = String(o.note ?? "").toLowerCase();
                                if (
                                  n2.includes("มีอยู่แล้ว") ||
                                  n2.includes("[มีอยู่แล้ว]")
                                )
                                  return (
                                    <span className="text-red-500 mr-1 font-bold">
                                      ✓
                                    </span>
                                  );
                                if (
                                  n2.includes("ไม่มี") ||
                                  n2.includes("[ไม่มี]")
                                )
                                  return (
                                    <span className="text-green-500 mr-1 font-bold">
                                      ◯
                                    </span>
                                  );
                                if (
                                  n2.includes("รูปแบบไม่ถูกต้อง") ||
                                  n2.includes("[รูปแบบไม่ถูกต้อง]")
                                )
                                  return (
                                    <span className="text-yellow-500 mr-1 font-bold">
                                      ⚠
                                    </span>
                                  );
                                return null;
                              })()}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </>
    </div>
  );
};

export default SearchURL;
