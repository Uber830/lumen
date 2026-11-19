import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { ChatPanel } from "@/components/chat-panel";
import { PageHeader } from "@/components/ui-kit";
import { useMyTeachers } from "@/features/student/use-my-teachers";

export const Route = createFileRoute("/estudiante/chat")({
  head: () => ({
    meta: [
      { title: "Mensajes — Lumen" },
      {
        name: "description",
        content: "Chat del estudiante con sus docentes.",
      },
      { property: "og:title", content: "Mensajes — Lumen" },
      { property: "og:description", content: "Consultá con tus docentes desde la plataforma." },
    ],
  }),
  component: EstudianteChat,
});

function EstudianteChat() {
  const { session } = useRouteContext({ from: "/estudiante/chat" });
  const teachers = useMyTeachers(session.primarySchoolId);

  return (
    <>
      <PageHeader title="Mensajes" subtitle="Consultas con tus docentes" />
      <ChatPanel session={session} teachers={teachers.data ?? []} />
    </>
  );
}
