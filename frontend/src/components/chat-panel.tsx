import { useRouteContext } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Send } from "lucide-react";

import { getSupabaseClient, getSupabaseToken } from "@/lib/supabase/client";
import { useChatMessages, useChatConversations, useSendChatMessage } from "@/lib/storage/hooks";
import { useCreateChatConversation } from "@/features/chat/use-conversations";
import { cn } from "@/lib/utils";
import type { SessionContext } from "@/lib/auth/functions";
import type { StudentTeacher } from "@/lib/api/types";

export function ChatPanel({
  session: sessionProp,
  teachers,
}: {
  /**
   * The signed-in user. The routes pass it; when it is missing the
   * panel falls back to the closest route context, which is where the
   * role layouts put it.
   */
  session?: SessionContext;
  /**
   * When present, the panel offers to start a direct conversation with
   * one of them. A teacher only sees the conversations they are in.
   */
  teachers?: StudentTeacher[];
}) {
  const routeContext = useRouteContext({ strict: false }) as unknown as
    { session?: SessionContext } | undefined;
  const session = sessionProp ?? routeContext?.session;
  const schoolId = session?.primarySchoolId ?? null;
  const userId = session?.user.id ?? null;

  const conversations = useChatConversations(schoolId);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [teacherId, setTeacherId] = useState<string>("");

  const activeConversation = useMemo(() => {
    if (activeId) return conversations.data?.find((c) => c.id === activeId) ?? null;
    return conversations.data?.[0] ?? null;
  }, [activeId, conversations.data]);

  const messages = useChatMessages(activeConversation?.id ?? null);
  const send = useSendChatMessage(schoolId ?? "");
  const createConversation = useCreateChatConversation(schoolId ?? "");

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  // Subscribe to Realtime inserts on the active conversation so the
  // chat refreshes when the other side sends a message.
  //
  // Realtime stays on Supabase, and its RLS policies call
  // `auth.uid()`. The channel is authenticated with the short-lived
  // token the backend mints.
  useEffect(() => {
    if (!schoolId || !activeConversation) return;
    let cancelled = false;
    let channel: ReturnType<ReturnType<typeof getSupabaseClient>["channel"]> | null = null;

    void (async () => {
      const token = await getSupabaseToken();
      if (cancelled || !token) return;

      const supabase = getSupabaseClient();
      await supabase.realtime.setAuth(token);

      channel = supabase
        .channel(`chat:${activeConversation.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "chat_messages",
            filter: `conversation_id=eq.${activeConversation.id}`,
          },
          () => {
            // The hooks re-fetch on .data change; but with staleTime 0
            // we leave the query cache invalidation to the mutation hook.
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) void channel.unsubscribe();
    };
  }, [activeConversation, schoolId]);

  if (!schoolId) {
    return (
      <div className="surface-card mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold">No hay colegio activo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu cuenta no está asociada a un colegio.
        </p>
      </div>
    );
  }

  async function onSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeConversation || sending) return;
    const trimmed = draft.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      await send.mutateAsync({
        conversationId: activeConversation.id,
        body: trimmed,
      });
      setDraft("");
    } finally {
      setSending(false);
    }
  }

  async function onStartConversation() {
    if (!teacherId || createConversation.isPending) return;
    const teacher = teachers?.find((item) => item.user_id === teacherId);
    const created = await createConversation.mutateAsync({
      title: teacher ? teacher.full_name : null,
      kind: "direct",
      memberIds: [teacherId],
    });
    setActiveId(created.id);
    setStarting(false);
    setTeacherId("");
  }

  const hasTeachers = Boolean(teachers && teachers.length > 0);

  return (
    <div className="surface-card grid overflow-hidden md:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="border-b border-border md:border-b-0 md:border-r">
        {hasTeachers ? (
          <div className="border-b border-border p-3">
            {starting ? (
              <div className="space-y-2">
                <select
                  value={teacherId}
                  onChange={(event) => setTeacherId(event.target.value)}
                  aria-label="Elegir docente"
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Elegí un docente...</option>
                  {teachers?.map((teacher) => (
                    <option key={teacher.user_id} value={teacher.user_id}>
                      {teacher.full_name}
                      {teacher.subjects.length > 0 ? ` · ${teacher.subjects.join(", ")}` : ""}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void onStartConversation()}
                    disabled={!teacherId || createConversation.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {createConversation.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : null}
                    Iniciar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStarting(false);
                      setTeacherId("");
                    }}
                    className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
                  >
                    Cancelar
                  </button>
                </div>
                {createConversation.isError ? (
                  <p role="alert" className="text-xs text-destructive">
                    {createConversation.error.message}
                  </p>
                ) : null}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setStarting(true)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
              >
                <Plus className="size-3.5" /> Nueva conversación
              </button>
            )}
          </div>
        ) : null}

        {conversations.isLoading ? (
          <p className="px-4 py-3.5 text-sm text-muted-foreground">Cargando conversaciones...</p>
        ) : conversations.error ? (
          <p role="alert" className="px-4 py-3.5 text-sm text-destructive">
            {conversations.error.message}
          </p>
        ) : !conversations.data || conversations.data.length === 0 ? (
          <p className="px-4 py-3.5 text-sm text-muted-foreground">
            {hasTeachers
              ? "Todavia no tenes conversaciones. Inicia una con un docente."
              : "Sin conversaciones. La creación de conversaciones llega en una fase posterior."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {conversations.data.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setActiveId(c.id)}
                  className={cn(
                    "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-3.5 text-left transition-colors",
                    activeConversation?.id === c.id ? "bg-primary-soft" : "hover:bg-muted",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{c.title ?? c.id}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {c.kind === "direct" ? "Conversación directa" : "Grupo"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className="flex min-h-[420px] flex-col">
        <header className="border-b border-border px-5 py-3.5">
          <p className="text-sm font-semibold">
            {activeConversation?.title ?? "Selecciona una conversación"}
          </p>
          <p className="text-xs text-muted-foreground">En línea</p>
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto bg-muted/30 p-5">
          {messages.isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando mensajes...</p>
          ) : messages.error ? (
            <p role="alert" className="text-sm text-destructive">
              {messages.error.message}
            </p>
          ) : !messages.data || messages.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aun no hay mensajes. Envia el primero para empezar.
            </p>
          ) : (
            messages.data.map((m) => {
              const mine = m.sender_id === userId;
              return (
                <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <p
                    className={cn(
                      "max-w-[75%] rounded-lg px-4 py-2.5 text-sm",
                      mine
                        ? "rounded-br-md bg-primary text-primary-foreground"
                        : "rounded-bl-md border border-border bg-card",
                    )}
                  >
                    {m.body}
                  </p>
                </div>
              );
            })
          )}
        </div>
        <form onSubmit={onSend} className="flex items-center gap-2 border-t border-border p-3">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Escribi un mensaje..."
            disabled={!activeConversation || sending}
            className="min-w-0 flex-1 rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="submit"
            aria-label="Enviar mensaje"
            disabled={!activeConversation || sending || !draft.trim()}
            className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send className="size-4.5" strokeWidth={1.75} />
          </button>
        </form>
      </section>
    </div>
  );
}
