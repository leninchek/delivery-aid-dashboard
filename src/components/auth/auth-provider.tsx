"use client";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { doc, getDoc } from "firebase/firestore";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getFirebaseAuth,
  getFirestoreDb,
  getMissingFirebaseEnvVars,
  hasFirebaseConfig,
} from "@/lib";

type BackofficeRole = "admin" | "supervisor" | "data_entry";

type SessionUser = {
  uid: string;
  email: string | null;
  name: string;
  backofficeRole: BackofficeRole;
};

type AuthContextValue = {
  isLoading: boolean;
  isConfigured: boolean;
  missingEnvVars: string[];
  sessionUser: SessionUser | null;
  authError: string | null;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signOutCurrentUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function mapAuthError(error: unknown): string {
  if (!(error instanceof FirebaseError)) {
    return "No fue posible iniciar sesion.";
  }

  switch (error.code) {
    case "auth/invalid-email":
      return "El formato del email no es valido.";
    case "auth/invalid-credential":
      return "Email o password incorrectos.";
    case "auth/user-disabled":
      return "La cuenta esta deshabilitada en Authentication.";
    case "auth/too-many-requests":
      return "Demasiados intentos. Espera un momento e intenta de nuevo.";
    case "auth/network-request-failed":
      return "No hay conexion. Verifica tu red e intenta de nuevo.";
    default:
      return "No fue posible iniciar sesion.";
  }
}

async function resolveSessionUser(user: User): Promise<SessionUser> {
  const firestoreDb = getFirestoreDb();

  if (!firestoreDb) {
    throw new Error("Firestore no esta configurado.");
  }

  const snapshot = await getDoc(doc(firestoreDb, "SystemUsers", user.uid));

  if (!snapshot.exists()) {
    throw new Error("La cuenta no existe en SystemUsers.");
  }

  const data = snapshot.data();

  if (data.type !== "backoffice") {
    throw new Error("La cuenta no tiene acceso a Back Office.");
  }

  if (!data.active) {
    throw new Error("La cuenta de Back Office esta inactiva.");
  }

  if (!data.backofficeRole) {
    throw new Error("La cuenta no tiene un rol Back Office valido.");
  }

  return {
    uid: user.uid,
    email: user.email,
    name: data.name || user.email || "Back Office User",
    backofficeRole: data.backofficeRole as BackofficeRole,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const isConfigured = hasFirebaseConfig();
  const missingEnvVars = getMissingFirebaseEnvVars();

  useEffect(() => {
    if (!isConfigured) {
      setIsLoading(false);
      return;
    }

    const auth = getFirebaseAuth();

    if (!auth) {
      setIsLoading(false);
      return;
    }

    // Failsafe: evita que la UI quede atrapada en "Validando sesion..." si Auth no responde.
    const loadingTimeout = window.setTimeout(() => {
      setIsLoading(false);
    }, 8000);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      window.clearTimeout(loadingTimeout);

      if (!user) {
        setSessionUser(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setAuthError(null);

      try {
        const resolvedUser = await resolveSessionUser(user);
        setSessionUser(resolvedUser);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "No fue posible validar la sesion.";
        setSessionUser(null);
        setAuthError(message);
        await signOut(auth);
      } finally {
        setIsLoading(false);
      }
    });

    return () => {
      window.clearTimeout(loadingTimeout);
      unsubscribe();
    };
  }, [isConfigured]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      isConfigured,
      missingEnvVars,
      sessionUser,
      authError,
      signInWithEmail: async (email: string, password: string) => {
        const auth = getFirebaseAuth();

        if (!auth) {
          throw new Error("Firebase Auth no esta configurado.");
        }

        setAuthError(null);
        try {
          await signInWithEmailAndPassword(auth, email.trim(), password);
        } catch (error) {
          const message = mapAuthError(error);
          setAuthError(message);
          throw new Error(message);
        }
      },
      signOutCurrentUser: async () => {
        const auth = getFirebaseAuth();

        if (!auth) {
          return;
        }

        setAuthError(null);
        await signOut(auth);
      },
    }),
    [authError, isConfigured, isLoading, missingEnvVars, sessionUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
