"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  type QueryDocumentSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";

type WithId = { id: string };

interface UseCatalogCrudOptions<TItem extends WithId, TForm> {
  collectionName: string;
  orderByField?: string;
  defaultForm: TForm;
  mapDocToItem: (doc: QueryDocumentSnapshot) => TItem;
  mapFormToFirestore: (form: TForm) => Record<string, unknown>;
  mapItemToForm: (item: TItem) => TForm;
  validate?: (form: TForm, editingId: string | null, items: TItem[]) => string | null;
  onSuccess?: (action: "create" | "update" | "delete") => void;
}

export function useCatalogCrud<TItem extends WithId, TForm>({
  collectionName,
  orderByField = "name",
  defaultForm,
  mapDocToItem,
  mapFormToFirestore,
  mapItemToForm,
  validate,
  onSuccess,
}: UseCatalogCrudOptions<TItem, TForm>) {
  const [items, setItems] = useState<TItem[]>([]);
  const [form, setForm] = useState<TForm>(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const db = getFirestoreDb();
    if (!db) return;

    const q = query(collection(db, collectionName), orderBy(orderByField, "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => setItems(snap.docs.map(mapDocToItem)),
      (err) => setError(err.message),
    );
    return () => unsub();
  // mapDocToItem is defined inline per call site — intentionally omitted from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, orderByField]);

  function resetForm() {
    setForm(defaultForm);
    setEditingId(null);
    setError(null);
  }

  function startEdit(item: TItem) {
    setForm(mapItemToForm(item));
    setEditingId(item.id);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const db = getFirestoreDb();
    if (!db) return;

    if (validate) {
      const validationError = validate(form, editingId, items);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setIsSaving(true);
    setError(null);
    const action = editingId ? "update" : "create";
    try {
      const data = mapFormToFirestore(form);
      if (editingId) {
        await updateDoc(doc(db, collectionName, editingId), {
          ...data,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, collectionName), {
          ...data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      resetForm();
      onSuccess?.(action);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const db = getFirestoreDb();
    if (!db) return;

    setIsDeletingId(id);
    setError(null);
    try {
      await deleteDoc(doc(db, collectionName, id));
      if (editingId === id) resetForm();
      onSuccess?.("delete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar.");
    } finally {
      setIsDeletingId(null);
    }
  }

  async function handleToggleActive(item: TItem & { active: boolean }) {
    const db = getFirestoreDb();
    if (!db) return;

    setError(null);
    try {
      await updateDoc(doc(db, collectionName, item.id), {
        active: !item.active,
        updatedAt: serverTimestamp(),
      });
      onSuccess?.("update");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cambiar estado.");
    }
  }

  return {
    items,
    form,
    setForm,
    editingId,
    isSaving,
    isDeletingId,
    error,
    setError,
    search,
    setSearch,
    resetForm,
    startEdit,
    handleSubmit,
    handleDelete,
    handleToggleActive,
  };
}
