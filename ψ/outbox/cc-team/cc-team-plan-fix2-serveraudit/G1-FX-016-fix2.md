<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-016 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2569,"completion_tokens":1763,"total_tokens":4332,"prompt_tokens_details":{"cached_tokens":2560,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1487,"image_tokens":0},"cache_creation_input_tokens":0} | 19s
 generated: 2026-06-13T11:58:38.802Z -->
FILE: innomcp-server-node/src/mcp/tools/fileReaderTool.ts
<<<<<<< SEARCH
  filePath: z.string().describe("Path หรือ base64 ของไฟล์ที่ต้องการอ่าน"),
=======
  filePath: z.string().describe("Path ของไฟล์ที่ต้องการอ่าน"),
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/fileReaderTool.ts
<<<<<<< SEARCH
  const pdfData: any = await (PDFParser as any)(dataBuffer, {
    max: options.maxPages || undefined
  });
=======
  const pdfData: any = await (PDFParser as any)(dataBuffer, {
    max: options.maxPages ?? undefined
  });
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/fileReaderTool.ts
<<<<<<< SEARCH
  const workbook = XLSX.readFile(filePath);
  const sheetName = options.sheetName || workbook.SheetNames[0];
=======
  const workbook = XLSX.readFile(filePath);
  if (workbook.SheetNames.length === 0) {
    throw new Error("Workbook contains no sheets");
  }
  const sheetName = options.sheetName || workbook.SheetNames[0];
>>>>>>> REPLACE
