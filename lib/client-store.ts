import { State, stateSchema } from "./model";
import { seed } from "./seed";
import { cloudMode, getSupabase } from "./supabase";
export async function loadWorkspace(): Promise<State> {
  if (cloudMode) {
    const { data, error } = await getSupabase().rpc(
      "load_or_create_workspace",
      { p_seed: seed() },
    );
    if (error) throw Error(error.message);
    return stateSchema.parse(data);
  }
  const response = await fetch("/api/state", { cache: "no-store" });
  if (!response.ok) throw Error("Could not load expedition");
  return stateSchema.parse(await response.json());
}
export async function saveWorkspace(input: State): Promise<State> {
  const state = stateSchema.parse(input);
  if (cloudMode) {
    const { data, error } = await getSupabase().rpc("save_workspace", {
      p_state: state,
      p_expected_revision: state.revision,
    });
    if (error)
      throw Error(
        error.code === "PT409"
          ? "Conflict: reload to get the latest changes"
          : error.message,
      );
    return stateSchema.parse(data);
  }
  const response = await fetch("/api/state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error);
  return stateSchema.parse(data);
}
export async function downloadBackup() {
  const state = await loadWorkspace();
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "adventure-os-backup.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
