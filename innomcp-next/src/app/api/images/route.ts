import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { apiKeyMiddleware } from "@/apikeymiddleware";

export async function GET(request: NextRequest) {
  const result = await apiKeyMiddleware(request, handleImageRequest);
  console.log(
    "[api-images] Result status from apiKeyMiddleware:",
    result.status
  );
  return result;
}

// แยก handler function ออกมาเพื่อให้สามารถเรียกใช้ได้ทั้งแบบมี API key และไม่มี
async function handleImageRequest(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let imagePath = searchParams.get("path");
  const thumbnail = searchParams.get("thumbnail");
  if (!imagePath) {
    return new NextResponse("Image path is required", { status: 400 });
  }

  // ถ้าเป็น thumbnail ให้เพิ่ม -thumbnail ที่ชื่อไฟล์ แล้วตามด้วยนามสกุล
  if (thumbnail === "true") {
    const ext = path.extname(imagePath);
    const baseName = path.basename(imagePath, ext);
    const pathDir = path.dirname(imagePath);
    imagePath = path.join(pathDir, `${baseName}-thumbnail${ext}`);
  }

  console.log("[api-images] Fetching image:", imagePath);

  try {
    const filePath = path.join(process.cwd(), imagePath);
    if (!fs.existsSync(filePath)) {
      return new NextResponse("Image not found", { status: 404 });
    }
    // Check if filePath is a directory
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      return new NextResponse("Requested path is a directory", { status: 400 });
    }

    const imageBuffer = fs.readFileSync(filePath);
    const ext = path.extname(imagePath).toLowerCase();
    let contentType = "application/octet-stream";
    if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
    else if (ext === ".png") contentType = "image/png";
    else if (ext === ".gif") contentType = "image/gif";
    else if (ext === ".webp") contentType = "image/webp";
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err: unknown) {
    console.error("Error serving image:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
