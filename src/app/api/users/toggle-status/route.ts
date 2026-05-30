import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { requireBackofficeAuth } from "@/lib/require-auth";
import type { ToggleStatusPayload } from "@/types/app-user";

export async function POST(req: Request) {
  const auth = await requireBackofficeAuth(req);
  if (!auth.ok) return auth.response;

  let body: ToggleStatusPayload;

  try {
    body = (await req.json()) as ToggleStatusPayload;
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido." }, { status: 400 });
  }

  const { uid, active } = body;

  if (!uid?.trim()) {
    return NextResponse.json({ error: "El uid es obligatorio." }, { status: 400 });
  }
  if (typeof active !== "boolean") {
    return NextResponse.json({ error: "El campo active debe ser un booleano." }, { status: 400 });
  }

  try {
    // Deshabilitar/habilitar en Firebase Auth y Firestore de forma simultánea
    await Promise.all([
      adminAuth().updateUser(uid, { disabled: !active }),
      adminDb().collection("SystemUsers").doc(uid).update({
        active,
        updatedAt: FieldValue.serverTimestamp(),
      }),
    ]);

    return NextResponse.json({ ok: true });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno al cambiar el estado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
