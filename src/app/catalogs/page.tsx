import { ModulePlaceholder } from "@/components/module-placeholder";

export default function CatalogsPage() {
  return (
    <ModulePlaceholder
      title="Catálogos"
      summary="Centro de acceso para los catálogos base del sistema."
      nextSteps={[
        "Agregar tabla y filtros para cada catálogo.",
        "Crear formularios de alta y edición.",
        "Conectar lectura inicial a Firestore.",
      ]}
    />
  );
}
