import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { requireBackofficeAuth } from "@/lib/require-auth";
import type { CreateUserPayload, CreateUserResult } from "@/types/app-user";

const PHONE_REGEX = /^\d{10}$/;

function buildTempPassword(phone: string): string {
  return phone.slice(-6);
}

export async function POST(req: Request) {
  const auth = await requireBackofficeAuth(req);
  if (!auth.ok) return auth.response;

  let body: CreateUserPayload;

  try {
    body = (await req.json()) as CreateUserPayload;
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido." }, { status: 400 });
  }

  const { phone, levelId, parentId, cityId, communityId, routeId } = body;

  // ── Validaciones ────────────────────────────────────────────────────────────
  if (!PHONE_REGEX.test(phone)) {
    return NextResponse.json({ error: "El teléfono debe tener exactamente 10 dígitos." }, { status: 400 });
  }
  if (!levelId?.trim()) {
    return NextResponse.json({ error: "El nivel organizacional es obligatorio." }, { status: 400 });
  }

  const email        = `${phone}@deliveryaid.app`;
  const tempPassword = buildTempPassword(phone);

  try {
    const authSdk = adminAuth();
    const db      = adminDb();

    // ── Verificar teléfono único ─────────────────────────────────────────────
    try {
      await authSdk.getUserByEmail(email);
      return NextResponse.json({ error: "Ya existe una cuenta con ese número de teléfono." }, { status: 409 });
    } catch (lookupErr: unknown) {
      const code = (lookupErr as { code?: string }).code;
      if (code !== "auth/user-not-found") throw lookupErr;
    }

    // ── Crear cuenta en Firebase Auth ────────────────────────────────────────
    const authUser = await authSdk.createUser({ email, password: tempPassword, displayName: phone });
    const uid      = authUser.uid;

    // ── Calcular path jerárquico ─────────────────────────────────────────────
    const memberRef = db.collection("OrgMembers").doc();
    let path: string[] = [memberRef.id];

    if (parentId) {
      const parentSnap = await db.collection("OrgMembers").doc(parentId).get();
      const parentPath = (parentSnap.data()?.path as string[] | undefined) ?? [];
      path = [...parentPath, memberRef.id];
    }

    // ── Escritura atómica ────────────────────────────────────────────────────
    const batch = db.batch();

    batch.set(memberRef, {
      name:        "",
      phone,
      curp:        "",
      birthDate:   "",
      levelId,
      parentId:    parentId   ?? null,
      path,
      assignment: {
        cityId:      cityId      ?? null,
        communityId: communityId ?? null,
        routeId:     routeId     ?? null,
      },
      appUserId:  uid,
      active:     true,
      createdAt:  FieldValue.serverTimestamp(),
      updatedAt:  FieldValue.serverTimestamp(),
    });

    batch.set(db.collection("SystemUsers").doc(uid), {
      phone,
      name:               "",
      type:               "app",
      backofficeRole:     null,
      orgMemberId:        memberRef.id,
      active:             true,
      mustChangePassword: true,
      onboardingComplete: false,
      createdAt:          FieldValue.serverTimestamp(),
      updatedAt:          FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return NextResponse.json<CreateUserResult>({ uid, phone, tempPassword }, { status: 201 });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno al crear el usuario.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
