import Link from "next/link";
import { ArrowRight, Camera, QrCode, Rotate3d, Share2, ShieldCheck, Smartphone } from "lucide-react";
import { DemoTour } from "@/components/marketing/demo-tour";
import { Pricing } from "@/components/marketing/pricing";
import { ThemeToggle } from "@/components/shared/theme";
import { Button } from "@/components/ui/button";
import { SITE } from "@/lib/constants";

const FEATURES = [
  { icon: Smartphone, title: "Утаснаасаа шууд", body: "Байрныхаа зураг, видео, 360° панорамыг утаснаасаа шууд байршуулна." },
  { icon: Rotate3d, title: "360° виртуал тур", body: "Өрөө хооронд шилжих боломжтой, бүтэн дэлгэцийн панорама үзүүлэлт." },
  { icon: Share2, title: "Хуваалцах холбоос", body: "Нэвтрэх шаардлагагүй, хэн ч нээж үзэх боломжтой хувийн холбоос." },
  { icon: QrCode, title: "QR код", body: "Хэвлэмэл материал, самбарт наах QR кодыг автоматаар үүсгэнэ." },
  { icon: Camera, title: "Гоёмсог танилцуулга", body: "Тансаг зэрэглэлийн үл хөдлөхөд зориулсан минимал дизайн." },
  { icon: ShieldCheck, title: "Аюулгүй байдал", body: "Row Level Security — зуучлагч зөвхөн өөрийн зараа удирдана." },
];

const STEPS = [
  { n: "01", title: "Зар үүсгэх", body: "Гарчиг, үнэ, байршил, талбай, өрөөний тоог оруулна." },
  { n: "02", title: "Медиа байршуулах", body: "Зураг, 360° панорама, видеогоо чирж оруулна." },
  { n: "03", title: "Нийтлээд хуваалцах", body: "Холбоос болон QR код бэлэн. Харагдалтын тоог хянана." },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 glass hairline">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="text-[15px] font-semibold tracking-tight">
            {SITE.name}
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition hover:text-foreground">Боломжууд</a>
            <a href="#how" className="transition hover:text-foreground">Хэрхэн ажилладаг</a>
            <a href="#pricing" className="transition hover:text-foreground">Үнэ</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle className="hidden md:flex" />
            <ThemeToggle compact className="md:hidden" />
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Нэвтрэх</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/register">Эхлэх</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container flex flex-col items-center gap-8 py-24 text-center sm:py-32">
        <div className="animate-fade-up rounded-full border border-border px-4 py-1.5 text-xs font-medium text-muted-foreground">
          Монголын үл хөдлөхийн зуучлагчдад зориулав
        </div>
        <h1 className="max-w-3xl animate-fade-up text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.03em] sm:text-6xl lg:text-7xl">
          Байрны зургаа оруул.<br />
          <span className="text-muted-foreground">360° тур автоматаар.</span>
        </h1>
        <p className="max-w-xl animate-fade-up text-balance text-lg text-muted-foreground">
          {SITE.description}
        </p>
        <div className="flex animate-fade-up flex-col gap-3 sm:flex-row">
          <Button size="lg" asChild>
            <Link href="/register">
              1 удаа үнэгүй турших <ArrowRight className="ml-1" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="#pricing">Үнэ харах</Link>
          </Button>
        </div>
        <p className="-mt-3 animate-fade-up text-xs text-muted-foreground">
          Карт шаардахгүй · Эхний зараа үнэгүй нийтэлнэ
        </p>

        {/* Live 360° sample */}
        <div className="mt-12 w-full max-w-5xl animate-fade-up">
          <DemoTour />
          <p className="mt-4 text-sm text-muted-foreground">
            Энэ бол бодит бүтээгдэхүүн — үйлчлүүлэгч тань яг ингэж харна.
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border bg-muted/40 py-24">
        <div className="container">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Зуучлагчид хэрэгтэй бүх зүйл нэг дор
          </h2>
          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-background p-8">
                <Icon className="h-5 w-5" />
                <h3 className="mt-5 font-medium">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-24">
        <div className="container">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Гурван алхам</h2>
          <div className="mt-14 grid gap-10 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n}>
                <span className="text-sm font-medium text-muted-foreground">{s.n}</span>
                <h3 className="mt-3 text-xl font-medium">{s.title}</h3>
                <p className="mt-2 text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Pricing />

      <footer className="border-t border-border py-10">
        <div className="container flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} {SITE.name}</p>
          <div className="flex gap-6">
            <Link href="/login" className="transition hover:text-foreground">Нэвтрэх</Link>
            <Link href="/register" className="transition hover:text-foreground">Бүртгүүлэх</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
