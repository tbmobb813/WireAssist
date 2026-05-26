// src/lib/slashCommands.ts
import { useChatStore } from "./stores/chatStore";
import { database } from "./api/database";
import { invokeSafe, isTauriEnvironment } from "./utils/tauri";
import {
  getAllProfiles,
  getActiveProfile,
  setActiveProfile,
} from "./api/profiles";
import type { SearchResult } from "./api/types";

export interface SlashCommand {
  command: string;
  description: string;
  aliases?: string[];
  parameters?: string[];
  handler: (args: string[], context: SlashCommandContext) => Promise<boolean>;
}

export interface SlashCommandContext {
  conversationId: string | null;
  currentInput: string;
  addToast: (toast: any) => void;
  clearInput: () => void;
}

// Available slash commands
export const slashCommands: SlashCommand[] = [
  {
    command: "clear",
    description: "Clear the current conversation",
    handler: async (_args, context) => {
      if (context.conversationId) {
        try {
          await database.conversations.delete(context.conversationId);
          useChatStore.getState().selectConversation("");
          context.addToast({
            message: "Conversation cleared",
            type: "success",
            ttl: 2000,
          });
          return true;
        } catch {
          context.addToast({
            message: "Failed to clear conversation",
            type: "error",
            ttl: 3000,
          });
          return false;
        }
      }
      return false;
    },
  },
  {
    command: "export",
    description: "Export current conversation",
    parameters: ["format (json|markdown|html|pdf)"],
    handler: async (args, context) => {
      if (!context.conversationId) {
        context.addToast({
          message: "No conversation to export",
          type: "warning",
          ttl: 2000,
        });
        return false;
      }

      try {
        const format = args[0] || "json";
        if (!["json", "markdown", "html", "pdf"].includes(format)) {
          context.addToast({
            message: "Invalid format. Use 'json', 'markdown', 'html', or 'pdf'",
            type: "error",
            ttl: 3000,
          });
          return false;
        }

        if (isTauriEnvironment()) {
          // Get conversation title for filename
          const conversation = await database.conversations.get(
            context.conversationId,
          );
          const title = conversation?.title || "Untitled";

          await invokeSafe("save_single_conversation_export", {
            conversation_id: context.conversationId,
            format: format,
            title: title,
          });
          context.addToast({
            message: `Conversation exported as ${format.toUpperCase()}`,
            type: "success",
            ttl: 3000,
          });
          return true;
        } else {
          context.addToast({
            message: "Export requires desktop app",
            type: "error",
            ttl: 3000,
          });
        }
      } catch {
        context.addToast({
          message: "Failed to export conversation",
          type: "error",
          ttl: 3000,
        });
      }
      return false;
    },
  },
  {
    command: "new",
    description: "Start a new conversation",
    aliases: ["n"],
    handler: async (_args, context) => {
      try {
        useChatStore.getState().selectConversation("");
        context.addToast({
          message: "Started new conversation",
          type: "success",
          ttl: 2000,
        });
        return true;
      } catch {
        context.addToast({
          message: "Failed to start new conversation",
          type: "error",
          ttl: 3000,
        });
        return false;
      }
    },
  },
  {
    command: "help",
    description: "Show available slash commands",
    aliases: ["h", "?"],
    handler: async (_args, context) => {
      const helpMessage = slashCommands
        .map((cmd) => {
          const aliases = cmd.aliases ? ` (${cmd.aliases.join(", ")})` : "";
          const params = cmd.parameters
            ? ` [${cmd.parameters.join(", ")}]`
            : "";
          return `**/${cmd.command}${aliases}${params}** - ${cmd.description}`;
        })
        .join("\n");

      // Add help message to chat
      const conversationId =
        context.conversationId || (await createNewConversation());
      await database.messages.create({
        conversation_id: conversationId,
        role: "assistant",
        content: `## Available Slash Commands\n\n${helpMessage}\n\nExample usage:\n- \`/export json\` - Export conversation as JSON\n- \`/clear\` - Clear current conversation\n- \`/new\` - Start new conversation`,
      });

      // Refresh chat to show the help message
      useChatStore.getState().selectConversation(conversationId);

      context.addToast({
        message: "Help information added to chat",
        type: "success",
        ttl: 2000,
      });
      return true;
    },
  },
  {
    command: "docs",
    description: "Search project documents",
    parameters: ["search query"],
    handler: async (args, context) => {
      const query = args.join(" ");
      if (!query.trim()) {
        context.addToast({
          message: "Please provide a search query: /docs search term",
          type: "warning",
          ttl: 3000,
        });
        return false;
      }

      try {
        if (isTauriEnvironment()) {
          // Use the new document search functionality
          const searchResult = await invokeSafe<SearchResult>(
            "search_project_files",
            {
              query,
              case_sensitive: false,
              max_results: 20,
            },
          );

          if (
            searchResult &&
            searchResult.matches &&
            searchResult.matches.length > 0
          ) {
            const { matches, total_files_searched, search_time_ms } =
              searchResult;

            // Format results for display
            const resultText = matches
              .slice(0, 10) // Show top 10 results
              .map((match: any) => {
                const filePath = match.path.split("/").pop() || match.path;
                if (match.line_number && match.line_content) {
                  return `📄 **${filePath}:${match.line_number}**\n\`\`\`\n${match.line_content.trim()}\n\`\`\``;
                } else {
                  return `📁 **${filePath}** (${match.file_type})`;
                }
              })
              .join("\n\n");

            const summaryText = `Found ${matches.length} matches in ${total_files_searched} files (${search_time_ms}ms)`;
            const fullResponse = `## 🔍 Document Search Results for "${query}"\n\n${summaryText}\n\n${resultText}`;

            const conversationId =
              context.conversationId || (await createNewConversation());
            await database.messages.create({
              conversation_id: conversationId,
              role: "assistant",
              content: fullResponse,
            });

            useChatStore.getState().selectConversation(conversationId);
            context.addToast({
              message: `Found ${matches.length} results for "${query}"`,
              type: "success",
              ttl: 2000,
            });
            return true;
          } else {
            context.addToast({
              message: `No documents found for "${query}"`,
              type: "info",
              ttl: 2000,
            });
            return true;
          }
        }
      } catch (error) {
        console.error("Document search error:", error);
        context.addToast({
          message: "Failed to search documents",
          type: "error",
          ttl: 3000,
        });
      }
      return false;
    },
  },
  {
    command: "run",
    description: "Execute terminal command via CLI",
    parameters: ["command"],
    handler: async (args, context) => {
      const command = args.join(" ");
      if (!command.trim()) {
        context.addToast({
          message: "Please provide a command: /run npm test",
          type: "error",
          ttl: 3000,
        });
        return false;
      }

      try {
        if (isTauriEnvironment()) {
          const conversationId =
            context.conversationId || (await createNewConversation());

          // Create a message explaining how to use the CLI capture command
          const instructions = `## 🖥️ Terminal Command Execution

To execute the command \`${command}\`, use the Linux AI CLI:

\`\`\`bash
# Basic execution with output capture
lai capture "${command}"

# With error analysis
lai capture "${command}" --analyze

# With AI-powered analysis
lai capture "${command}" --ai-analyze

# With custom timeout (default: 30s)
lai capture "${command}" --timeout 60
\`\`\`

**Available Options:**
- \`--analyze\`: Basic error pattern detection
- \`--ai-analyze\`: Send results to AI for detailed analysis
- \`--timeout N\`: Set timeout in seconds
- \`--cwd PATH\`: Set working directory

**Example Output:**
- Command execution details
- Exit code and timing
- Stdout and stderr capture
- Error analysis and suggestions

The CLI \`capture\` command provides safe execution with comprehensive output analysis, perfect for debugging build scripts, testing commands, and analyzing errors.`;

          await database.messages.create({
            conversation_id: conversationId,
            role: "assistant",
            content: instructions,
          });

          useChatStore.getState().selectConversation(conversationId);
          context.addToast({
            message: "CLI capture instructions provided",
            type: "success",
            ttl: 3000,
          });
          return true;
        } else {
          context.addToast({
            message: "Terminal commands require desktop app",
            type: "error",
            ttl: 3000,
          });
          return false;
        }
      } catch (error) {
        console.error("Command instruction error:", error);
        context.addToast({
          message: "Failed to provide command instructions",
          type: "error",
          ttl: 3000,
        });
        return false;
      }
    },
  },
  {
    command: "profile",
    description:
      "Switch between conversation profiles or list available profiles",
    parameters: ["[profile_name]"],
    handler: async (args, context) => {
      try {
        if (args.length === 0) {
          // List all profiles
          const [profiles, activeProfile] = await Promise.all([
            getAllProfiles(),
            getActiveProfile(),
          ]);

          let profileList = "**Available Profiles:**\n\n";
          for (const profile of profiles) {
            const isActive = activeProfile?.id === profile.id ? "✓ " : "  ";
            const description = profile.description
              ? ` - ${profile.description}`
              : "";
            profileList += `${isActive}**${profile.name}**${description}\n`;
            profileList += `   ${profile.default_provider} • ${profile.default_model}\n\n`;
          }

          profileList += "Use `/profile <name>` to switch profiles.";

          // Add message to conversation
          if (context.conversationId) {
            await database.messages.create({
              conversation_id: context.conversationId,
              role: "assistant",
              content: profileList,
            });
          }

          context.addToast({
            message: "Profile list displayed",
            type: "success",
            ttl: 2000,
          });
          return true;
        } else {
          // Switch to specific profile
          const profileName = args.join(" ").toLowerCase();
          const profiles = await getAllProfiles();
          const targetProfile = profiles.find(
            (p) => p.name.toLowerCase() === profileName,
          );

          if (!targetProfile) {
            context.addToast({
              message: `Profile "${args.join(" ")}" not found`,
              type: "error",
              ttl: 3000,
            });
            return false;
          }

          if (targetProfile.is_active) {
            context.addToast({
              message: `Profile "${targetProfile.name}" is already active`,
              type: "info",
              ttl: 2000,
            });
            return true;
          }

          await setActiveProfile(targetProfile.id);

          context.addToast({
            message: `Switched to profile: ${targetProfile.name}`,
            type: "success",
            ttl: 3000,
          });
          return true;
        }
      } catch (error) {
        console.error("Profile command error:", error);
        context.addToast({
          message: "Failed to handle profile command",
          type: "error",
          ttl: 3000,
        });
        return false;
      }
    },
  },
  {
    command: "remember",
    description: "Save information to session memory",
    parameters: ["content"],
    handler: async (args, context) => {
      if (args.length === 0) {
        context.addToast({
          message: "Usage: /remember <what to remember>",
          type: "warning",
          ttl: 3000,
        });
        return false;
      }

      try {
        const { useMemoryStore } = await import("./stores/memoryStore");
        const content = args.join(" ");

        useMemoryStore.getState().addMemory(content, {
          context: "Added via /remember command",
          conversationId: context.conversationId || undefined,
          tags: ["command"],
        });

        context.addToast({
          message: "💾 Saved to session memory!",
          type: "success",
          ttl: 2000,
        });

        // Add confirmation message to conversation
        if (context.conversationId) {
          await database.messages.create({
            conversation_id: context.conversationId,
            role: "assistant",
            content: `✓ Saved to memory: "${content}"`,
          });
        }

        return true;
      } catch (error) {
        console.error("Remember command error:", error);
        context.addToast({
          message: "Failed to save to memory",
          type: "error",
          ttl: 3000,
        });
        return false;
      }
    },
  },
  {
    command: "recall",
    description: "Search and recall from session memory",
    aliases: ["search-memory", "find"],
    parameters: ["query"],
    handler: async (args, context) => {
      if (args.length === 0) {
        context.addToast({
          message: "Usage: /recall <search query>",
          type: "warning",
          ttl: 3000,
        });
        return false;
      }

      try {
        const { useMemoryStore } = await import("./stores/memoryStore");
        const query = args.join(" ");
        const memories = useMemoryStore.getState().recallMemories(query, 10);

        if (memories.length === 0) {
          context.addToast({
            message: "No memories found matching your query",
            type: "info",
            ttl: 2000,
          });

          if (context.conversationId) {
            await database.messages.create({
              conversation_id: context.conversationId,
              role: "assistant",
              content: `No memories found for: "${query}"`,
            });
          }

          return true;
        }

        // Format memories as markdown
        let resultText = `**🧠 Found ${memories.length} memories matching "${query}":**\n\n`;

        for (let i = 0; i < memories.length; i++) {
          const memory = memories[i];
          const date = new Date(memory.createdAt).toLocaleDateString();

          resultText += `${i + 1}. ${memory.content}\n`;
          resultText += `   *${date}${memory.context ? ` • ${memory.context}` : ""}*\n\n`;
        }

        // Add message to conversation
        if (context.conversationId) {
          await database.messages.create({
            conversation_id: context.conversationId,
            role: "assistant",
            content: resultText,
          });
        }

        context.addToast({
          message: `Found ${memories.length} memories`,
          type: "success",
          ttl: 2000,
        });

        return true;
      } catch (error) {
        console.error("Recall command error:", error);
        context.addToast({
          message: "Failed to recall memories",
          type: "error",
          ttl: 3000,
        });
        return false;
      }
    },
  },
];

// Helper function to create new conversation
async function createNewConversation(): Promise<string> {
  const newConv = await database.conversations.create({
    title: "New Conversation",
    model: "gpt-4",
    provider: "openai",
  });
  return newConv.id;
}

// Parse and execute slash commands
export function parseSlashCommand(input: string): {
  isSlashCommand: boolean;
  command?: SlashCommand;
  args?: string[];
  originalInput: string;
} {
  const trimmed = input.trim();

  if (!trimmed.startsWith("/")) {
    return { isSlashCommand: false, originalInput: input };
  }

  const parts = trimmed.slice(1).split(/\s+/);
  const commandName = parts[0].toLowerCase();
  const args = parts.slice(1);

  // Find command by name or alias
  const command = slashCommands.find(
    (cmd) =>
      cmd.command === commandName ||
      (cmd.aliases && cmd.aliases.includes(commandName)),
  );

  return {
    isSlashCommand: true,
    command,
    args,
    originalInput: input,
  };
}

// Execute a slash command
export async function executeSlashCommand(
  command: SlashCommand,
  args: string[],
  context: SlashCommandContext,
): Promise<boolean> {
  try {
    return await command.handler(args, context);
  } catch (error) {
    console.error("Slash command error:", error);
    context.addToast({
      message: "Command execution failed",
      type: "error",
      ttl: 3000,
    });
    return false;
  }
}

// Get command suggestions for autocomplete
export function getSlashCommandSuggestions(input: string): SlashCommand[] {
  const trimmed = input.trim().toLowerCase();

  if (!trimmed.startsWith("/")) {
    return [];
  }

  const commandPart = trimmed.slice(1);

  return slashCommands.filter((cmd) => {
    return (
      cmd.command.startsWith(commandPart) ||
      (cmd.aliases &&
        cmd.aliases.some((alias) => alias.startsWith(commandPart)))
    );
  });
}
