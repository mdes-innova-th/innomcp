import sharp from "sharp";
import fs from "fs";
import path from "path";

/**
 * Generates a thumbnail for the given image and saves it in the 'thumbnail' folder.
 * @param {string} imagePath - The path to the original image.
 * @returns {Promise<string>} - The path to the generated thumbnail.
 */
export async function generateThumbnail(imagePath: string): Promise<string> {
  try {
    // Ensure the parent folder exists
    const parentDir = path.dirname(imagePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    // Generate the thumbnail with name <original>-thumbnail.<ext>
    const ext = path.extname(imagePath);
    const base = path.basename(imagePath, ext);
    const thumbnailPath = path.join(parentDir, `${base}-thumbnail${ext}`);
    await sharp(imagePath).resize(150, 150).toFile(thumbnailPath);
    return thumbnailPath;
  } catch (error) {
    console.error("Error generating thumbnail:", error);
    throw error;
  }
}
