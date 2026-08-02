import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { getDemoRooms } from "@/lib/site-settings";
import { DemoRoomsEditor } from "@/components/admin/demo-rooms-editor";

export const metadata: Metadata = { title: "Нүүр хуудас · Админ" };
export const dynamic = "force-dynamic";

export default async function AdminLandingPage() {
  await requireAdmin();
  const rooms = await getDemoRooms();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Нүүр хуудасны жишээ тур</h1>
        <p className="mt-1 text-muted-foreground">
          Зочид эхлээд энэ турыг хардаг. Өөрийн шилдэг байрны панорамаар солиход
          бүртгүүлэх магадлал нэмэгддэг.
        </p>
      </div>

      <DemoRoomsEditor initial={rooms} />
    </div>
  );
}
