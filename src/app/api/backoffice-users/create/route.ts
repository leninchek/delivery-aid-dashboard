import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { requireAdminAuth } from "@/lib/require-auth";
import type { CreateBackofficeUserPayload, CreateBackofficeUserResult } from "@/types/backoffice-user";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const auth = await requireAdminAuth(req);
  if (!auth.ok) return auth.response;

  let body: CreateBackofficeUserPayload;

  try {
    body = (await req.json()) as CreateBackofficeUserPayload;
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido." }, { status: 400 });
  }

  const { email, password, name, roleId } = body;

  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "El correo no tiene un formato válido." }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 });
  }
  if (!name?.trim()) {
    return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
  }
  if (!roleId?.trim()) {
    return NextResponse.json({ error: "El rol es obligatorio." }, { status: 400 });
  }

  try {
    const authSdk = adminAuth();
    const db      = adminDb();

    // Verify role exists (except admin, which is bootstrapped)
    if (roleId !== "admin") {
      const roleSnap = await db.collection("BackofficeRoles").doc(roleId).get();
      if (!roleSnap.exists) {
        return NextResponse.json({ error: `El rol "${roleId}" no existe.` }, { status: 400 });
      }
    }

    // Check for duplicate email
    try {
      await authSdk.getUserByEmail(email);
      return NextResponse.json({ error: "Ya existe una cuenta con ese correo." }, { status: 409 });
    } catch (lookupErr: unknown) {
      const code = (lookupErr as { code?: string }).code;
      if (code !== "auth/user-not-found") throw lookupErr;
    }

    // Create Firebase Auth user
    const authUser = await authSdk.createUser({ email, password, displayName: name.trim() });
    const uid      = authUser.uid;

    // Write SystemUsers document
    await db.collection("SystemUsers").doc(uid).set({
      email:          email.toLowerCase(),
      name:           name.trim(),
      type:           "backoffice",
      backofficeRole: roleId,
      active:         true,
      createdAt:      FieldValue.serverTimestamp(),
      updatedAt:      FieldValue.serverTimestamp(),
    });

    return NextResponse.json<CreateBackofficeUserResult>({ uid, email }, { status: 201 });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno al crear el usuario.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
