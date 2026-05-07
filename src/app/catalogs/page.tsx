import { ModulePlaceholder } from "@/components/module-placeholder";

export default function CatalogsPage() {
  return (
    <ModulePlaceholder
      title="Catalogos"
      summary="Centro de acceso para los catalogos base del sistema."
      nextSteps={[
        "Agregar tabla y filtros para cada catalogo.",
        "Crear formularios de alta y edicion.",
        "Conectar lectura inicial a Firestore.",
      ]}
    />
  );
}
