import { invokeSafe } from "../utils/tauri";
import type { ApiProfile, NewProfile } from "./types";

export async function createProfile(
  profileData: NewProfile,
): Promise<ApiProfile | null> {
  return invokeSafe<ApiProfile>("create_profile", { profileData });
}

export async function getProfile(id: string): Promise<ApiProfile | null> {
  return invokeSafe<ApiProfile | null>("get_profile", { id });
}

export async function getAllProfiles(): Promise<ApiProfile[]> {
  const result = await invokeSafe<ApiProfile[]>("get_all_profiles");
  return result || [];
}

export async function getActiveProfile(): Promise<ApiProfile | null> {
  return invokeSafe<ApiProfile | null>("get_active_profile");
}

export async function setActiveProfile(id: string): Promise<void> {
  await invokeSafe<void>("set_active_profile", { id });
}

export async function updateProfile(
  id: string,
  profileData: NewProfile,
): Promise<ApiProfile | null> {
  return invokeSafe<ApiProfile>("update_profile", { id, profileData });
}

export async function deleteProfile(id: string): Promise<void> {
  await invokeSafe<void>("delete_profile", { id });
}
