import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirebaseStorage } from "@/lib/firebase";

// Mismos valores que ImageCompressionUtils en Android (MAX_WIDTH/HEIGHT=1024,
// COMPRESSION_QUALITY=85) -- mantiene el contrato de storage.rules
// (isValidImage: debe ser image/jpeg, <= 5MB) sin depender de qué formato
// haya elegido quien captura (PNG, HEIC, WEBP, etc. todos se convierten).
const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.85;

async function compressImageToJpeg(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("El archivo seleccionado no es una imagen válida.");
  }

  const scale  = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width  = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width  = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("No se pudo procesar la imagen en este navegador.");
  }

  // Fondo blanco antes de dibujar: JPEG no soporta transparencia, y sin esto
  // las áreas transparentes de un PNG se verían negras.
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo comprimir la imagen."))),
      "image/jpeg",
      JPEG_QUALITY
    );
  });
}

export async function uploadEvidenceFile(path: string, file: File): Promise<string> {
  const storage = getFirebaseStorage();
  if (!storage) throw new Error("Firebase Storage no está configurado.");

  const compressed = await compressImageToJpeg(file);

  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, compressed, { contentType: "image/jpeg" });
  return getDownloadURL(storageRef);
}
