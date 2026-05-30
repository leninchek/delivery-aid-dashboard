import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdminAuth } from "@/lib/require-auth";
import type { UpdateBackofficeUserPayload } from "@/types/backoffice-user";

export async function PATCH(req: Request) {
  const auth = await requireAdminAuth(req);
  if (!auth.ok) return auth.response;

  let body: UpdateBackofficeUserPayload;

  try {
    body = (await req.json()) as UpdateBackofficeUserPayload;
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido." }, { status: 400 });
  }

  const { uid, name, roleId, active } = body;

  if (!uid?.trim()) {
    return NextResponse.json({ error: "El UID es obligatorio." }, { status: 400 });
  }

  try {
    const db = adminDb();

    const userSnap = await db.collection("SystemUsers").doc(uid).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "El usuario no existe." }, { status: 404 });
    }
    if (userSnap.data()?.type !== "backoffice") {
      return NextResponse.json({ error: "Este endpoint solo actualiza usuarios Back Office." }, { status: 400 });
    }
    // Protect admin account from role changes
    if (userSnap.data()?.backofficeRole === "admin" && roleId && roleId !== "admin") {
      return NextResponse.json({ error: "No se puede cambiar el rol del administrador." }, { status: 403 });
    }

    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };

    if (name !== undefined) updates.name = name.trim();

    if (roleId !== undefined) {
      if (roleId !== "admin") {
        const roleSnap = await db.collection("BackofficeRoles").doc(roleId).get();
        if (!roleSnap.exists) {
          return NextResponse.json({ error: `El rol "${roleId}" no existe.` }, { status: 400 });
        }
      }
      updates.backofficeRole = roleId;
    }

    if (active !== undefined) updates.active = active;

    await db.collection("SystemUsers").doc(uid).update(updates);

    return NextResponse.json({ ok: true });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno al actualizar el usuario.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
