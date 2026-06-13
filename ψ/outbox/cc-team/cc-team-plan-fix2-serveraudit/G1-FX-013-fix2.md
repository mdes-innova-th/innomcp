<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-013 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: length | tokens: {"prompt_tokens":3638,"completion_tokens":7000,"total_tokens":10638,"prompt_tokens_details":{"cached_tokens":3584,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":6118,"image_tokens":0},"cache_creation_input_tokens":0} | 75s
 generated: 2026-06-13T11:58:19.572Z -->
FILE: innomcp-server-node/src/mcp/tools/docWriterTool.ts
<<<<<<< SEARCH
(async () => {
  try { await fs.mkdir(STORAGE_ROOT, { recursive: true }); } catch {}
})();
=======
await fs.mkdir(STORAGE_ROOT, { recursive: true });
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/docWriterTool.ts
<<<<<<< SEARCH
  const doc = new Document({
    title: input.title || input.filename,
    creator: input.metadata?.author || "INNOMCP",
    subject: input.metadata?.subject,
    keywords: input.metadata?.keywords?.join(", "),
    sections: [{ properties: {}, children }],
  });
  return await Packer.toBuffer(doc);
=======
  const doc = new Document({
    title: input.title || input.filename,
    creator: input.metadata?.author || "INNOMCP",
    subject: input.metadata?.subject,
    keywords: input.metadata?.keywords?.join(", "),
    numbering: {
      config: [
        {
          reference: "ordered",
          levels: [
            { level: 0, format: "decimal", text: "%1.", alignment: "left" },
          ],
        },
      ],
    },
    sections: [{ properties: {}, children }],
  });
  return await Packer.toBuffer(doc);
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/docWriterTool.ts
<<<<<<< SEARCH
    } else if (block.type === "table") {
      const rows = block.rows.map((cells, i) => new TableRow({
        children: cells.map((c) => new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: c, bold: i === 0 && !!block.hasHeader })] })],
        })),
      }));
      children.push(new Table({
        rows,
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
          left: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
          right: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC" },
          insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC" },
        },
      }));
    }
=======
    } else if (block.type === "table") {
      if (block.rows.length === 0) continue;
      const rows = block.rows.map((cells, i) => new TableRow({
        children: cells.map((c) => new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: c, bold: i === 0 && !!block.hasHeader })] })],
        })),
      }));
      children.push(new Table({
        rows,
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
          left: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
          right: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC" },
          insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC" },
        },
      }));
    }
>>>>>>> REPLACE

SKIP: MEDIUM – Top-level directory creation IIFE silent failure: already fixed by the same edit that addresses the race condition (replacing the
