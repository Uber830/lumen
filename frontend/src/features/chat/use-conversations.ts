// =============================================================================
// Creating a conversation.
// -----------------------------------------------------------------------------
// A conversation is a thread of messages between two people or a group.
// The creator is a member of it, and so is everyone in `memberIds`.
//
// The API checks that every member belongs to the school, so a
// conversation can never reach outside the tenant.
// =============================================================================

import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import type { ChatConversation } from "@/lib/api/types";

export const conversationKeys = {
  list: (schoolId: string) => ["chat_conversations", schoolId] as const,
};

/** Start a conversation with the given members. */
export function useCreateChatConversation(
  schoolId: string,
): UseMutationResult<
  ChatConversation,
  Error,
  { title?: string | null; kind?: "direct" | "group"; memberIds: string[] }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ title, kind, memberIds }) =>
      api.post<ChatConversation>("/v1/chat/conversations", {
        title: title ?? null,
        kind: kind ?? "direct",
        member_ids: memberIds,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: conversationKeys.list(schoolId) });
    },
  });
}
