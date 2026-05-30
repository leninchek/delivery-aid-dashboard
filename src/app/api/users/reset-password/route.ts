import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { requireBackofficeAuth } from "@/lib/require-auth";
import type { ResetPasswordPayload, ResetPasswordResult } from "@/types/app-user";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateTempPassword(): string {
  let result = "";
  for (let i = 0; i < 8; i++) result += CHARS[Math.floor(Math.random() * CHARS.length)];
  return result;
}

export async function POST(req: Request) {
  const auth = await requireBackofficeAuth(req);
  if (!auth.ok) return auth.response;

  let body: ResetPasswordPayload;

  try {
    body = (await req.json()) as ResetPasswordPayload;
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido." }, { status: 400 });
  }

  const { uid } = body;

  if (!uid?.trim()) {
    return NextResponse.json({ error: "El uid es obligatorio." }, { status: 400 });
  }

  try {
    const tempPassword = generateTempPassword();

    await adminAuth().updateUser(uid, { password: tempPassword });

    await adminDb().collection("SystemUsers").doc(uid).update({
      mustChangePassword: true,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json<ResetPasswordResult>({ tempPassword });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno al resetear la contraseña.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
