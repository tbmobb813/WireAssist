import { useState, useEffect, useCallback } from "react";
import { useUiStore } from "../lib/stores/uiStore";
import { withErrorHandling } from "../lib/utils/errorHandler";
import { User, Plus, Check, Edit2, Trash2, Settings } from "lucide-react";
import {
  getAllProfiles,
  getActiveProfile,
  createProfile,
  updateProfile,
  deleteProfile,
  setActiveProfile,
} from "../lib/api/profiles";
import type { ApiProfile, NewProfile } from "../lib/api/types";

interface ProfileSettingsProps {
  onClose: () => void;
}

export default function ProfileSettings({ onClose }: ProfileSettingsProps) {
  const addToast = useUiStore((s) => s.addToast);
  const [profiles, setProfiles] = useState<ApiProfile[]>([]);
  const [activeProfile, setActiveProfileState] = useState<ApiProfile | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState<NewProfile>({
    name: "",
    description: "",
    default_model: "gpt-4o-mini",
    default_provider: "openai",
    system_prompt: "",
  });

  const loadProfiles = useCallback(async () => {
    const result = await withErrorHandling(
      async () => {
        const [profilesData, activeData] = await Promise.all([
          getAllProfiles(),
          getActiveProfile(),
        ]);
        setProfiles(profilesData);
        setActiveProfileState(activeData);
      },
      "ProfileSettings.loadProfiles",
      "Failed to load profiles",
    );

    if (result === null) {
      addToast({
        message: "Failed to load profiles",
        type: "error",
        ttl: 3000,
      });
    }
    setLoading(false);
  }, [addToast]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const handleCreateProfile = async () => {
    if (!formData.name.trim()) {
      addToast({
        message: "Profile name is required",
        type: "error",
        ttl: 3000,
      });
      return;
    }

    setCreating(true);
    const result = await withErrorHandling(
      async () => {
        await createProfile(formData);
        await loadProfiles();
        setFormData({
          name: "",
          description: "",
          default_model: "gpt-4o-mini",
          default_provider: "openai",
          system_prompt: "",
        });
        addToast({
          message: "Profile created successfully",
          type: "success",
          ttl: 3000,
        });
      },
      "ProfileSettings.handleCreateProfile",
      "Failed to create profile",
    );

    if (result === null) {
      addToast({
        message: "Failed to create profile",
        type: "error",
        ttl: 3000,
      });
    }
    setCreating(false);
  };

  const handleUpdateProfile = async (id: string) => {
    if (!formData.name.trim()) {
      addToast({
        message: "Profile name is required",
        type: "error",
        ttl: 3000,
      });
      return;
    }

    const result = await withErrorHandling(
      async () => {
        await updateProfile(id, formData);
        await loadProfiles();
        setEditing(null);
        setFormData({
          name: "",
          description: "",
          default_model: "gpt-4o-mini",
          default_provider: "openai",
          system_prompt: "",
        });
        addToast({
          message: "Profile updated successfully",
          type: "success",
          ttl: 3000,
        });
      },
      "ProfileSettings.handleUpdateProfile",
      "Failed to update profile",
    );

    if (result === null) {
      addToast({
        message: "Failed to update profile",
        type: "error",
        ttl: 3000,
      });
    }
  };

  const handleDeleteProfile = async (id: string) => {
    if (profiles.length <= 1) {
      addToast({
        message: "Cannot delete the last profile",
        type: "error",
        ttl: 3000,
      });
      return;
    }

    const result = await withErrorHandling(
      async () => {
        await deleteProfile(id);
        await loadProfiles();
        addToast({
          message: "Profile deleted successfully",
          type: "success",
          ttl: 3000,
        });
      },
      "ProfileSettings.handleDeleteProfile",
      "Failed to delete profile",
    );

    if (result === null) {
      addToast({
        message: "Failed to delete profile",
        type: "error",
        ttl: 3000,
      });
    }
  };

  const handleSetActiveProfile = async (id: string) => {
    const result = await withErrorHandling(
      async () => {
        await setActiveProfile(id);
        await loadProfiles();
        addToast({
          message: "Active profile changed",
          type: "success",
          ttl: 2000,
        });
      },
      "ProfileSettings.handleSetActiveProfile",
      "Failed to change active profile",
    );

    if (result === null) {
      addToast({
        message: "Failed to change active profile",
        type: "error",
        ttl: 3000,
      });
    }
  };

  const startEditing = (profile: ApiProfile) => {
    setEditing(profile.id);
    setFormData({
      name: profile.name,
      description: profile.description || "",
      default_model: profile.default_model,
      default_provider: profile.default_provider,
      system_prompt: profile.system_prompt || "",
    });
  };

  const cancelEditing = () => {
    setEditing(null);
    setFormData({
      name: "",
      description: "",
      default_model: "gpt-4o-mini",
      default_provider: "openai",
      system_prompt: "",
    });
  };

  if (loading) {
    return (
      <div className="w-96 bg-[#1a1b26] border border-[#414868] rounded-lg shadow-2xl p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7aa2f7]"></div>
          <span className="ml-2 text-[#9aa5ce]">Loading profiles...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[480px] max-h-[600px] bg-[#1a1b26] border border-[#414868] rounded-lg shadow-2xl p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-[#7aa2f7]" />
          <h2 className="text-lg font-semibold text-[#c0caf5]">
            Profile Settings
          </h2>
        </div>
        <button
          onClick={onClose}
          className="text-[#9aa5ce] hover:text-[#c0caf5] transition-colors"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* Active Profile Display */}
      {activeProfile && (
        <div className="mb-6 p-4 bg-[#7aa2f7]/10 border border-[#7aa2f7]/30 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Check className="w-4 h-4 text-[#9ece6a]" />
            <span className="text-sm font-medium text-[#c0caf5]">
              Active Profile
            </span>
          </div>
          <div className="text-sm text-[#c0caf5]">
            <div className="font-medium">{activeProfile.name}</div>
            {activeProfile.description && (
              <div className="text-xs text-[#9aa5ce] mt-1">
                {activeProfile.description}
              </div>
            )}
            <div className="text-xs text-[#565f89] mt-1">
              {activeProfile.default_provider} • {activeProfile.default_model}
            </div>
          </div>
        </div>
      )}

      {/* Create New Profile Form */}
      <div className="mb-6 p-4 bg-[#24283b]/50 border border-[#414868]/50 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <Plus className="w-4 h-4 text-[#9aa5ce]" />
          <span className="text-sm font-medium text-[#c0caf5]">
            Create New Profile
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <input
              type="text"
              placeholder="Profile name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-3 py-2 text-sm border border-[#414868] rounded-md bg-[#24283b] text-[#c0caf5] placeholder-[#565f89]"
            />
          </div>

          <div>
            <input
              type="text"
              placeholder="Description (optional)"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-3 py-2 text-sm border border-[#414868] rounded-md bg-[#24283b] text-[#c0caf5] placeholder-[#565f89]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={formData.default_provider}
              onChange={(e) =>
                setFormData({ ...formData, default_provider: e.target.value })
              }
              className="px-3 py-2 text-sm border border-[#414868] rounded-md bg-[#24283b] text-[#c0caf5]"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="gemini">Gemini</option>
              <option value="ollama">Ollama</option>
            </select>

            <input
              type="text"
              placeholder="Model (e.g., gpt-4o-mini)"
              value={formData.default_model}
              onChange={(e) =>
                setFormData({ ...formData, default_model: e.target.value })
              }
              className="px-3 py-2 text-sm border border-[#414868] rounded-md bg-[#24283b] text-[#c0caf5] placeholder-[#565f89]"
            />
          </div>

          <div>
            <textarea
              placeholder="System prompt (optional)"
              value={formData.system_prompt}
              onChange={(e) =>
                setFormData({ ...formData, system_prompt: e.target.value })
              }
              rows={2}
              className="w-full px-3 py-2 text-sm border border-[#414868] rounded-md bg-[#24283b] text-[#c0caf5] placeholder-[#565f89] resize-none"
            />
          </div>

          <button
            onClick={handleCreateProfile}
            disabled={creating || !formData.name.trim()}
            className="w-full px-3 py-2 text-sm bg-[#7aa2f7] hover:bg-[#7aa2f7]/90 disabled:opacity-60 text-[#1a1b26] font-medium rounded-md transition-colors"
          >
            {creating ? "Creating..." : "Create Profile"}
          </button>
        </div>
      </div>

      {/* Profiles List */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-[#c0caf5]">All Profiles</h3>
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className={`p-3 border rounded-lg ${profile.is_active
                ? "border-[#7aa2f7] bg-[#7aa2f7]/10"
                : "border-[#414868] bg-[#24283b]/50"
              }`}
          >
            {editing === profile.id ? (
              // Edit Form
              <div className="space-y-2">
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-2 py-1 text-sm border border-[#414868] rounded bg-[#24283b] text-[#c0caf5]"
                />
                <input
                  type="text"
                  placeholder="Description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-2 py-1 text-sm border border-[#414868] rounded bg-[#24283b] text-[#c0caf5] placeholder-[#565f89]"
                />
                <div className="flex gap-2">
                  <select
                    value={formData.default_provider}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        default_provider: e.target.value,
                      })
                    }
                    className="flex-1 px-2 py-1 text-sm border border-[#414868] rounded bg-[#24283b] text-[#c0caf5]"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="gemini">Gemini</option>
                    <option value="ollama">Ollama</option>
                  </select>
                  <input
                    type="text"
                    value={formData.default_model}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        default_model: e.target.value,
                      })
                    }
                    className="flex-1 px-2 py-1 text-sm border border-[#414868] rounded bg-[#24283b] text-[#c0caf5]"
                  />
                </div>
                <textarea
                  placeholder="System prompt"
                  value={formData.system_prompt}
                  onChange={(e) =>
                    setFormData({ ...formData, system_prompt: e.target.value })
                  }
                  rows={2}
                  className="w-full px-2 py-1 text-sm border border-[#414868] rounded bg-[#24283b] text-[#c0caf5] placeholder-[#565f89] resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdateProfile(profile.id)}
                    className="px-3 py-1 text-xs bg-[#9ece6a] hover:bg-[#9ece6a]/90 text-[#1a1b26] font-medium rounded"
                  >
                    Save
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="px-3 py-1 text-xs bg-[#414868] hover:bg-[#565f89] text-[#c0caf5] rounded"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              // Display Mode
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#c0caf5]">
                        {profile.name}
                      </span>
                      {profile.is_active && (
                        <Check className="w-4 h-4 text-[#9ece6a]" />
                      )}
                    </div>
                    {profile.description && (
                      <div className="text-xs text-[#9aa5ce] mt-1">
                        {profile.description}
                      </div>
                    )}
                    <div className="text-xs text-[#565f89] mt-1">
                      {profile.default_provider} • {profile.default_model}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!profile.is_active && (
                      <button
                        onClick={() => handleSetActiveProfile(profile.id)}
                        className="p-1 text-xs bg-[#7aa2f7] hover:bg-[#7aa2f7]/90 text-[#1a1b26] rounded"
                        title="Set as active"
                      >
                        <Settings className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={() => startEditing(profile)}
                      className="p-1 text-[#9aa5ce] hover:text-[#7aa2f7] transition-colors"
                      title="Edit profile"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    {profiles.length > 1 && (
                      <button
                        onClick={() => handleDeleteProfile(profile.id)}
                        className="p-1 text-[#9aa5ce] hover:text-[#f7768e] transition-colors"
                        title="Delete profile"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-[#414868]">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm bg-[#414868] hover:bg-[#565f89] text-[#c0caf5] rounded-md transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
