import { readState } from "@/lib/store";
export const dynamic = "force-dynamic";
export function GET() {
  return new Response(JSON.stringify(readState(), null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="adventure-os-backup.json"',
      "Cache-Control": "no-store",
    },
  });
}
