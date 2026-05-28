export async function invoke(cmd: string, args?: any) {
  if (cmd === "get_all_conversations") return [];
  if (cmd === "get_conversation") return null;
  if (cmd === "create_conversation")
    return {
      id: "mock-c",
      title: args?.title || "mock",
      model: args?.model || "gpt",
      provider: args?.provider || "local",
      created_at: Date.now(),
      updated_at: Date.now(),
    };
  if (cmd === "get_conversation_messages") return [];
  return null;
}
