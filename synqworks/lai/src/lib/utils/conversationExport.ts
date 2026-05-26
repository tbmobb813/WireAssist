import type { ApiMessage, ApiConversation } from "../api/types";

export function exportConversationAsMarkdown(
  conversation: ApiConversation,
  messages: ApiMessage[],
): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${conversation.title || "Untitled Conversation"}`);
  lines.push("");
  lines.push(`**Model:** ${conversation.model}`);
  lines.push(`**Provider:** ${conversation.provider}`);
  lines.push(
    `**Created:** ${new Date(conversation.created_at).toLocaleString()}`,
  );
  lines.push(
    `**Updated:** ${new Date(conversation.updated_at).toLocaleString()}`,
  );

  if (conversation.system_prompt) {
    lines.push("");
    lines.push("**System Prompt:**");
    lines.push(`> ${conversation.system_prompt}`);
  }

  lines.push("");
  lines.push("---");
  lines.push("");

  // Messages
  messages.forEach((msg, index) => {
    const timestamp = new Date(
      (msg as any).timestamp || Date.now(),
    ).toLocaleTimeString();
    const role =
      msg.role === "user"
        ? "👤 User"
        : msg.role === "assistant"
          ? "🤖 Assistant"
          : "⚙️ System";

    lines.push(`## ${role} • ${timestamp}`);
    lines.push("");
    lines.push(msg.content);
    lines.push("");

    // Add token info if available
    if ((msg as any).tokens_used) {
      lines.push(`*Tokens: ${(msg as any).tokens_used}*`);
      lines.push("");
    }

    if (index < messages.length - 1) {
      lines.push("---");
      lines.push("");
    }
  });

  // Footer
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(
    `*Exported from Linux AI Assistant on ${new Date().toLocaleString()}*`,
  );
  lines.push(`*${messages.length} messages in conversation*`);

  return lines.join("\n");
}

export async function copyConversationToClipboard(
  conversation: ApiConversation,
  messages: ApiMessage[],
): Promise<void> {
  const markdown = exportConversationAsMarkdown(conversation, messages);

  try {
    await navigator.clipboard.writeText(markdown);
  } catch {
    // Fallback: Create temporary textarea
    const textarea = document.createElement("textarea");
    textarea.value = markdown;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }
}
