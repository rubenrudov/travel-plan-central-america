import Adventure from "@/components/adventure";
import CloudWorkspace from "@/components/cloud-workspace";
export default function Page() {
  return process.env.NEXT_PUBLIC_STORAGE_MODE === "supabase" ? (
    <CloudWorkspace />
  ) : (
    <Adventure />
  );
}
