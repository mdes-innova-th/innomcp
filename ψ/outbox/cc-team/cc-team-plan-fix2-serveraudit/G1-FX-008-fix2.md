<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-008 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2593,"completion_tokens":3153,"total_tokens":5746,"prompt_tokens_details":{"cached_tokens":2560,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2739,"image_tokens":0},"cache_creation_input_tokens":0} | 30s
 generated: 2026-06-13T11:56:11.137Z -->
FILE: innomcp-server-node/src/mcp/tmdApiConfig.ts
<<<<<<< SEARCH
  // Fallback to deprecated TMD_UID / TMD_UKEY
  if (!uid)  uid  = String(process.env.TMD_UID  || "").trim();
  if (!ukey) ukey = String(process.env.TMD_UKEY || "").trim();

  if (!uid || !ukey) {
    const hint = tier === "api"
      ? "ตั้งค่า TMD_UID_API + TMD_UKEY_API ใน .env (สมัครที่ https://data.tmd.go.th/)"
      : "ตั้งค่า TMD_UID_DEMO + TMD_UKEY_DEMO ใน .env (ใช้ demo/demo สำหรับ public datasets)";
    throw new Error(`TMD_API_PARAMS_MISSING [tier=${tier}]: ${hint}`);
  }
=======
  // Fallback to deprecated TMD_UID / TMD_UKEY as a whole pair
  if (!uid || !ukey) {
    const fallbackUid = String(process.env.TMD_UID  || "").trim();
    const fallbackUkey = String(process.env.TMD_UKEY || "").trim();
    if (fallbackUid && fallbackUkey) {
      uid = fallbackUid;
      ukey = fallbackUkey;
    } else {
      const hint = tier === "api"
        ? "ตั้งค่า TMD_UID_API + TMD_UKEY_API ใน .env (สมัครที่ https://data.tmd.go.th/)"
        : "ตั้งค่า TMD_UID_DEMO + TMD_UKEY_DEMO ใน .env (ใช้ demo/demo สำหรับ public datasets)";
      throw new Error(`TMD_API_PARAMS_MISSING [tier=${tier}]: ${hint}`);
    }
  }
>>>>>>> REPLACE
