import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export type AuthedUser = {
  uid:           string;
  backofficeRole: string;
};

type AuthOk  = { ok: true;  user: AuthedUser };
type AuthFail = { ok: false; response: ReturnType<typeof NextResponse.json> };

export type AuthResult = AuthOk | AuthFail;

/**
 * Verifica que la petición venga de un usuario Back Office autenticado.
 * Lee el header `Authorization: Bearer <idToken>` y valida el token con
 * Firebase Admin SDK. Luego comprueba que el uid tenga un documento en
 * SystemUsers con type === "backoffice" y active === true.
 *
 * Uso:
 *   const auth = await requireBackofficeAuth(req);
 *   if (!auth.ok) return auth.response;
 *   // auth.user.uid, auth.user.backofficeRole disponibles
 */
export async function requireBackofficeAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No autenticado." }, { status: 401 }),
    };
  }

  const token = authHeader.slice(7);

  try {
    const decoded = await adminAuth().verifyIdToken(token);
    const snap    = await adminDb().collection("SystemUsers").doc(decoded.uid).get();

    if (!snap.exists) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Cuenta no encontrada." }, { status: 403 }),
      };
    }

    const data = snap.data()!;

    if (data.type !== "backoffice") {
      return {
        ok: false,
        response: NextResponse.json({ error: "Sin acceso al Back Office." }, { status: 403 }),
      };
    }

    if (!data.active) {
      return {
        ok: false,
        response: NextResponse.json({ error: "La cuenta está inactiva." }, { status: 403 }),
      };
    }

    return {
      ok:   true,
      user: { uid: decoded.uid, backofficeRole: (data.backofficeRole as string) ?? "" },
    };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Token inválido o expirado." }, { status: 401 }),
    };
  }
}

/**
 * Igual que requireBackofficeAuth, pero además exige que el usuario
 * tenga backofficeRole === "admin".
 */
export async function requireAdminAuth(req: Request): Promise<AuthResult> {
  const result = await requireBackofficeAuth(req);

  if (!result.ok) return result;

  if (result.user.backofficeRole !== "admin") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Se requieren permisos de administrador." }, { status: 403 }),
    };
  }

  return result;
}
