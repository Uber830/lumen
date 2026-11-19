import { createFileRoute } from "@tanstack/react-router";
import { ChatPanel } from "@/components/chat-panel";
import { PageHeader } from "@/components/ui-kit";

export const Route = createFileRoute("/docente/chat")({
  head: () => ({
    meta: [
      { title: "Mensajes — Lumen" },
      {
        name: "description",
        content: "Chat interno del docente con administración y estudiantes.",
      },
      { property: "og:title", content: "Mensajes — Lumen" },
      { property: "og:description", content: "Comunicación interna del colegio, en un solo hilo." },
    ],
  }),
  component: () => (
    <>
      <PageHeader title="Mensajes" subtitle="Administración y estudiantes" />
      <ChatPanel />
    </>
  ),
});
