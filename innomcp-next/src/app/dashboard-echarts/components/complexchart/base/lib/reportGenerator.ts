"use client";

import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  BorderStyle,
  WidthType,
  ImageRun,
  AlignmentType,
  TextRun, // เพิ่ม TextRun สำหรับกำหนดฟอนต์
} from "docx";
import { saveAs } from "file-saver";
import * as htmlToImage from "html-to-image";
import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";

export interface ChartDataPoint {
  timestamp: string;
  value: number;
  category: string;
  tooltipSuffix?: string;
}

export interface GenerateReportOptions {
  title: string;
  subtitle?: string;
  tableHeaders: string[];
  tableRows: string[][]; // Array of rows, each row is an array of cell values
  chartRef:
    | React.RefObject<HTMLDivElement>
    | React.MutableRefObject<HTMLDivElement | null>;
  filename: string;
  valueSuffix?: string;
  dateRange?: {
    startDate?: string;
    endDate?: string;
  };
  // optional per-column alignment hints used by preview/export: 'left'|'center'|'right'
  columnAlignments?: ("left" | "center" | "right")[];
  // Optional PDF image capture options: captureScale controls html2canvas
  // pixel scaling; jpegQuality controls final JPEG encoding quality (0..1)
  captureScale?: number;
  jpegQuality?: number;
}

/**
 * Generates and downloads a Word document report with chart data
 * @param options Configuration options for the report
 * @returns Promise that resolves when the report is generated and download starts
 * @throws Error if chart reference is null or if there's an issue generating the report
 */
export const generateChartReport = async (
  options: GenerateReportOptions
): Promise<void> => {
  const {
    title,
    subtitle,
    tableHeaders,
    tableRows,
    chartRef,
    filename,
    valueSuffix,
    dateRange,
    columnAlignments,
    captureScale: optCaptureScale,
    jpegQuality: optJpegQuality,
  } = options;

  if (!chartRef.current || tableRows.length === 0) return;

  console.log("Initiating date range for report:", dateRange);

  try {
    // Capture chart as image
    if (!chartRef.current) {
      throw new Error("Chart reference is null or undefined");
    }

    // Set data attribute for report mode
    chartRef.current.setAttribute("data-for-report", "true");

    // Add chart type attribute if available from the container
    const chartContainer = chartRef.current.querySelector("[data-chart-type]");
    if (chartContainer) {
      const chartType = chartContainer.getAttribute("data-chart-type");
      chartRef.current.setAttribute("data-chart-type", chartType || "bar");
    }

    // Wait for re-render before capturing
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Use configurable capture scale and jpeg quality for DOCX export as well.
    // Default to scale=2 and quality=0.85 to reduce file sizes vs lossless PNG.
    const captureScale =
      typeof optCaptureScale === "number" && optCaptureScale > 0
        ? optCaptureScale
        : 2;
    const jpegQuality =
      typeof optJpegQuality === "number" && optJpegQuality > 0
        ? optJpegQuality
        : 0.85;

    const dataUrl = await htmlToImage.toJpeg(chartRef.current, {
      backgroundColor: "#ffffff",
      pixelRatio: captureScale,
      quality: jpegQuality,
      // Explicitly request a larger capture area using offsetWidth/Height as fallback
      width: chartRef.current.scrollWidth || chartRef.current.offsetWidth,
      height: chartRef.current.scrollHeight || chartRef.current.offsetHeight,
    });

    // Reset attributes after capture
    chartRef.current.removeAttribute("data-for-report");
    chartRef.current.removeAttribute("data-chart-type");

    // Extract chart title dynamically
    const chartTitleElement = chartRef.current.querySelector(".chart-title");
    const dynamicTitle = chartTitleElement?.textContent || title;
    // Use public env var for application display name in reports (fallback to existing label)
    const appName =
      (process?.env?.NEXT_PUBLIC_APP_NAME as string) || "wedD Dashboard";

    // Convert data URL to ArrayBuffer without using fetch
    // This avoids CSP violations with data: URLs
    const base64Content = dataUrl.split(",")[1];
    const binaryString = window.atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const imageArrayBuffer = bytes.buffer;

    // Get image size to preserve aspect ratio
    const img = new window.Image();
    img.src = dataUrl;
    await new Promise((resolve) => {
      if (img.complete) return resolve(true);
      img.onload = resolve;
    });
    // Allow larger image sizes for better visibility in Word
    // Increased caps so charts can occupy more of the page when exported
    const maxWidth = 1400;
    const maxHeight = 2000;
    let imgWidth = img.width;
    let imgHeight = img.height;
    if (imgWidth > maxWidth || imgHeight > maxHeight) {
      const widthRatio = maxWidth / imgWidth;
      const heightRatio = maxHeight / imgHeight;
      const ratio = Math.min(widthRatio, heightRatio);
      imgWidth = Math.round(imgWidth * ratio);
      imgHeight = Math.round(imgHeight * ratio);
    }

    // Create Word document
    // For DOCX: create two sections so table and chart are always on separate pages
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1134, // 2 cm in twips
                bottom: 1134, // 2 cm in twips
                left: 1134, // 2 cm in twips
                right: 1134, // 2 cm in twips
              },
            },
          },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: dynamicTitle,
                  font: "TH Sarabun New",
                  size: 36, // 18pt
                  bold: true,
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
            subtitle
              ? new Paragraph({
                  children: [
                    new TextRun({
                      text: subtitle,
                      font: "TH Sarabun New",
                      size: 32, // 16pt
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                })
              : new Paragraph({
                  children: [
                    new TextRun({
                      text: "",
                      font: "TH Sarabun New",
                      size: 12, // 6pt
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
            new Paragraph({ text: "" }),

            // Add table (first section)
            new Table({
              width: { size: 80, type: WidthType.PERCENTAGE }, // ปรับความกว้างตารางให้แคบลง
              alignment: AlignmentType.CENTER, // จัดตารางตรงกลาง
              rows: [
                // Header row
                new TableRow({
                  children: tableHeaders.map(
                    (header, index) =>
                      new TableCell({
                        margins: {
                          top: 20,
                          bottom: 20,
                          left: 20,
                          right: 20,
                        },
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: header,
                                font: "TH Sarabun New",
                                size: 28, // 14pt (larger)
                                bold: true,
                              }),
                            ],
                            alignment:
                              columnAlignments &&
                              columnAlignments[index] === "left"
                                ? AlignmentType.LEFT
                                : columnAlignments &&
                                  columnAlignments[index] === "right"
                                ? AlignmentType.RIGHT
                                : AlignmentType.CENTER,
                          }),
                        ],
                        borders: {
                          top: { style: BorderStyle.SINGLE, size: 1 },
                          bottom: { style: BorderStyle.SINGLE, size: 1 },
                          left: { style: BorderStyle.SINGLE, size: 1 },
                          right: { style: BorderStyle.SINGLE, size: 1 },
                        },
                      })
                  ),
                }),
                // Data rows
                ...tableRows.map(
                  (row) =>
                    new TableRow({
                      children: row.map((cell, index) => {
                        let displayValue = cell;
                        const isNumber =
                          index > 0 && !isNaN(Number(cell)) && cell !== "";
                        if (isNumber) {
                          displayValue = Number(cell).toLocaleString("en-US");
                          if (valueSuffix) displayValue += ` ${valueSuffix}`;
                        } else if (index > 0 && valueSuffix) {
                          displayValue = `${cell} ${valueSuffix}`;
                        }
                        return new TableCell({
                          margins: {
                            top: 20,
                            bottom: 20,
                            left: 20,
                            right: 20,
                          },
                          children: [
                            new Paragraph({
                              children: [
                                new TextRun({
                                  text: displayValue,
                                  font: "TH Sarabun New",
                                  size: 28, // 14pt
                                }),
                              ],
                              alignment:
                                columnAlignments && columnAlignments[index]
                                  ? columnAlignments[index] === "left"
                                    ? AlignmentType.LEFT
                                    : columnAlignments[index] === "right"
                                    ? AlignmentType.RIGHT
                                    : AlignmentType.CENTER
                                  : isNumber
                                  ? AlignmentType.RIGHT
                                  : AlignmentType.LEFT,
                            }),
                          ],
                          borders: {
                            top: { style: BorderStyle.SINGLE, size: 1 },
                            bottom: { style: BorderStyle.SINGLE, size: 1 },
                            left: { style: BorderStyle.SINGLE, size: 1 },
                            right: { style: BorderStyle.SINGLE, size: 1 },
                          },
                        });
                      }),
                    })
                ),
              ],
            }),
            // small spacer paragraph to ensure section break
            new Paragraph({ text: "" }),
          ],
        },
        // Second section solely for the chart and footer (forces new page)
        {
          properties: {
            page: {
              margin: {
                top: 1134,
                bottom: 1134,
                left: 1134,
                right: 1134,
              },
            },
          },
          children: [
            new Paragraph({
              children: [
                new ImageRun({
                  data: imageArrayBuffer,
                  transformation: {
                    width: Math.min(imgWidth, 1200),
                    height: Math.round(
                      (Math.min(imgWidth, 1200) / imgWidth) * imgHeight
                    ),
                  },
                  type: "jpg",
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `วันที่สร้างรายงาน จาก ${appName}: ${new Date().toLocaleDateString(
                    "th-TH"
                  )} เวลา: ${new Date().toLocaleTimeString("th-TH")} น.`,
                  font: "TH Sarabun New",
                  size: 16, // 8pt
                }),
              ],
              alignment: AlignmentType.RIGHT,
            }),
          ],
        },
      ],
    });

    // Generate and save the document
    const buffer = await Packer.toBuffer(doc);

    // Sanitize filename to ensure it's valid
    const sanitizedFilename = filename.replace(/[\/:*?"<>|]/g, "_");
    const dateTimeString = new Date()
      .toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })
      .replace(/:/g, "-")
      .replace(/\s/g, "T");
    // Save Word document
    saveAs(
      new Blob([new Uint8Array(buffer)]),
      `${sanitizedFilename}-${dateTimeString}.docx`
    );

    return;
  } catch (err) {
    // Reset attributes in case of error
    if (chartRef.current) {
      chartRef.current.removeAttribute("data-for-report");
      chartRef.current.removeAttribute("data-chart-type");
    }
    console.error("Error generating report:", err);
    throw new Error(
      `Failed to generate report: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
};

// Helper: Load and register THSarabunNew font for jsPDF
type JsPDFWithFonts = jsPDF & {
  addFileToVFS: (fileName: string, fileData: string) => void;
  addFont: (
    postScriptName: string,
    fontName: string,
    fontStyle: string
  ) => void;
};

async function loadAndRegisterTHSarabunFont(doc: jsPDF) {
  // Fetch font file from public/fonts/THSarabunNew.ttf
  const fontUrl = "/fonts/THSarabunNew.ttf";
  const response = await fetch(fontUrl);
  const fontBuffer = await response.arrayBuffer();
  // Convert to base64
  const uint8Array = new Uint8Array(fontBuffer);
  let binary = "";
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  const base64Font = btoa(binary);
  // Register font with jsPDF
  (doc as JsPDFWithFonts).addFileToVFS("THSarabunNew.ttf", base64Font);
  (doc as JsPDFWithFonts).addFont("THSarabunNew.ttf", "THSarabunNew", "normal");
  (doc as JsPDFWithFonts).addFont("THSarabunNew.ttf", "THSarabunNew", "bold");
}

/**
 * Generates and downloads a PDF report with chart data (structure similar to Word)
 * @param options Configuration options for the report
 * @returns Promise that resolves when the report is generated and download starts
 */
export const generateChartReportPDF = async (
  options: GenerateReportOptions
): Promise<void> => {
  const {
    title,
    subtitle,
    tableHeaders,
    tableRows,
    chartRef,
    valueSuffix = "",
    dateRange,
    captureScale: optCaptureScale,
    jpegQuality: optJpegQuality,
    columnAlignments,
  } = options;

  if (!chartRef.current || tableRows.length === 0) return;

  try {
    // Set data attribute for report mode
    if (chartRef.current) {
      chartRef.current.setAttribute("data-for-report", "true");

      // Add chart type attribute if available from the container
      const chartContainer =
        chartRef.current.querySelector("[data-chart-type]");
      if (chartContainer) {
        const chartType = chartContainer.getAttribute("data-chart-type");
        chartRef.current.setAttribute("data-chart-type", chartType || "bar");
      }

      // Wait for re-render before capturing
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Capture chart as image
    // Capture chart as canvas. Use a configurable scale to avoid creating
    // extremely large bitmaps which inflate PDF size. We default to
    // scale=2 (good balance between quality and size) and default JPEG
    // quality to 0.85. Callers may override via options.captureScale and
    // options.jpegQuality.
    const captureScale =
      typeof optCaptureScale === "number" && optCaptureScale > 0
        ? optCaptureScale
        : 2;
    const chartCanvas = await html2canvas(chartRef.current, {
      backgroundColor: "#fff",
      // Configurable scale to limit pixel dimensions and file size
      scale: captureScale,
      useCORS: true,
      allowTaint: true,
    });
    // Encode as JPEG (smaller than PNG for photographic/complex charts)
    // quality default: 0.85
    const jpegQuality =
      typeof optJpegQuality === "number" && optJpegQuality > 0
        ? optJpegQuality
        : 0.85;
    const chartImgData = chartCanvas.toDataURL("image/jpeg", jpegQuality);

    // Reset attributes after capture
    if (chartRef.current) {
      chartRef.current.removeAttribute("data-for-report");
      chartRef.current.removeAttribute("data-chart-type");
    }

    // Create PDF
    const doc = new jsPDF({
      orientation: "portrait", // Changed orientation to portrait
      unit: "pt",
      format: "a4",
    });

    // Application name for report footer (use public env var or fallback)
    const appName =
      (process?.env?.NEXT_PUBLIC_APP_NAME as string) || "wedD Dashboard";

    // Register THSarabunNew font
    await loadAndRegisterTHSarabunFont(doc);

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    // Use more of the page width for the chart while leaving margins
    // Increase available space so the chart can occupy a majority of the page
    const pdfMaxWidth = pageWidth - 40; // Slightly smaller margins left/right
    const pdfMaxHeight = pageHeight - 80; // Allow taller chart area before page break
    const chartImg = new window.Image();
    chartImg.src = chartImgData;
    await new Promise((resolve) => {
      if (chartImg.complete) return resolve(true);
      chartImg.onload = resolve;
    });
    // Compute dimensions preserving aspect ratio and fitting within max bounds
    let pdfImgWidth = chartImg.width;
    let pdfImgHeight = chartImg.height;
    const pdfWidthRatio = pdfMaxWidth / pdfImgWidth;
    const pdfHeightRatio = pdfMaxHeight / pdfImgHeight;
    const pdfRatio = Math.min(pdfWidthRatio, pdfHeightRatio, 1);
    pdfImgWidth = Math.round(pdfImgWidth * pdfRatio);
    pdfImgHeight = Math.round(pdfImgHeight * pdfRatio);

    // Page break logic
    let y = 40;

    // Title
    doc.setFont("THSarabunNew", "bold");
    doc.setFontSize(28);
    doc.text(title, pageWidth / 2, y, { align: "center" });
    y += 32;

    // Subtitle or date range
    doc.setFont("THSarabunNew", "normal");
    doc.setFontSize(20);
    if (subtitle) {
      doc.text(subtitle, pageWidth / 2, y, { align: "center" });
      y += 24;
    }
    let dateRangeText = "";
    if (dateRange?.startDate && dateRange?.endDate) {
      const startDateObj = new Date(dateRange.startDate);
      const endDateObj = new Date(dateRange.endDate);
      if (!isNaN(startDateObj.getTime()) && !isNaN(endDateObj.getTime())) {
        dateRangeText =
          dateRange.startDate === dateRange.endDate
            ? `วันที่ ${startDateObj.toLocaleDateString("th-TH")}`
            : `วันที่ ${startDateObj.toLocaleDateString("th-TH")}` +
              ` ถึง ${endDateObj.toLocaleDateString("th-TH")}`;
      }
    }
    doc.text(dateRangeText, pageWidth / 2, y, { align: "center" });
    y += 28;

    // Table
    // Slightly reduced base font size for denser table layout
    doc.setFontSize(22);
    const tableStartY = y;
    const cellPadding = 6; // reduced padding for denser layout
    const colCount = tableHeaders.length;
    // ปรับความกว้างตารางให้แคบลง (80% ของหน้ากระดาษ) และจัดตรงกลาง
    const tableWidth = pageWidth * 0.8;
    const tableX = (pageWidth - tableWidth) / 2;
    const colWidth = tableWidth / colCount;
    let tableY = tableStartY;

    // Header row
    tableHeaders.forEach((header, i) => {
      doc.setFillColor(230, 230, 230);
      // Slightly smaller header row height for denser table
      const headerHeight = 34;
      doc.rect(tableX + i * colWidth, tableY, colWidth, headerHeight, "F");
      doc.setTextColor(0);
      // Draw header text bold
      doc.setFont("THSarabunNew", "bold");
      doc.setFontSize(22);
      // Determine header alignment for PDF
      const headerAlign =
        columnAlignments && columnAlignments[i]
          ? columnAlignments[i]
          : "center";
      const headerX =
        headerAlign === "left"
          ? tableX + i * colWidth + cellPadding
          : headerAlign === "right"
          ? tableX + i * colWidth + colWidth - cellPadding
          : tableX + i * colWidth + colWidth / 2;
      doc.text(header, headerX, tableY + 22, {
        align: headerAlign as "left" | "center" | "right",
      });
      // Reset font to normal for data rows
      doc.setFont("THSarabunNew", "normal");
      doc.setFontSize(22);
    });
    tableY += 34;

    // Data rows
    const rowHeight = 28; // reduced row height for denser table
    tableRows.forEach((row, rowIdx) => {
      if (tableY + rowHeight > pageHeight - 40) {
        doc.addPage();
        tableY = 40; // Reset Y position for new page
      }
      row.forEach((cell, i) => {
        doc.setFillColor(rowIdx % 2 === 0 ? 255 : 245, 255, 255);
        doc.rect(tableX + i * colWidth, tableY, colWidth, rowHeight, "F");
        doc.setTextColor(0);
        let displayValue = cell;
        const isNumber = !isNaN(Number(cell)) && cell !== "";
        if (isNumber) {
          displayValue = Number(cell).toLocaleString("en-US");
          if (valueSuffix && i > 0) displayValue += ` ${valueSuffix}`;
        } else if (i > 0 && valueSuffix) {
          displayValue = `${cell} ${valueSuffix}`;
        }
        // Determine alignment: explicit columnAlignments override number heuristic
        const align =
          columnAlignments && columnAlignments[i]
            ? columnAlignments[i]
            : isNumber
            ? "right"
            : "left";
        const xPos =
          align === "left"
            ? tableX + i * colWidth + cellPadding
            : align === "right"
            ? tableX + i * colWidth + colWidth - cellPadding
            : tableX + i * colWidth + colWidth / 2;
        doc.setFontSize(18);
        doc.text(displayValue, xPos, tableY + rowHeight / 2 + 6, {
          align: align as "left" | "center" | "right",
        });
      });
      tableY += rowHeight;
    });
    y = tableY + 16;

    // Chart image
    // Force chart onto its own page (always break page after table)
    doc.addPage();
    y = 40; // Reset Y position for new page
    const pdfImgX = (pageWidth - pdfImgWidth) / 2;
    doc.addImage(chartImgData, "PNG", pdfImgX, y, pdfImgWidth, pdfImgHeight);
    y += pdfImgHeight + 10;

    // Report date
    if (y + 14 > pageHeight - 40) {
      doc.addPage();
      y = 40; // Reset Y position for new page
    }
    doc.setFontSize(8);
    doc.text(
      `วันที่สร้างรายงาน จาก ${appName}: ${new Date().toLocaleDateString(
        "th-TH"
      )} เวลา: ${new Date().toLocaleTimeString("th-TH")} น.`,
      pageWidth - 60,
      y,
      { align: "right" }
    );

    // Save PDF
    const sanitizedFilename = title.replace(/[\\/:*?"<>|]/g, "_");
    const dateTimeString = new Date()
      .toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })
      .replace(/:/g, "-")
      .replace(/\s/g, "T");
    // Save PDF
    const pdfFilename = `${sanitizedFilename}-${dateTimeString}.pdf`;
    doc.save(pdfFilename);
  } catch (err) {
    // Reset attributes in case of error
    if (chartRef.current) {
      chartRef.current.removeAttribute("data-for-report");
      chartRef.current.removeAttribute("data-chart-type");
    }
    console.error("Error generating PDF report:", err);
    throw new Error(
      `Failed to generate PDF report: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
};
