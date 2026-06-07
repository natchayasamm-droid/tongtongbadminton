import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AdminProvider } from "@/lib/admin-context";
import { AppHeader } from "@/components/app-header";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">ไม่พบหน้านี้</h2>
        <p className="mt-2 text-sm text-muted-foreground">หน้าที่คุณค้นหาอาจถูกย้ายหรือไม่มีอยู่</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            กลับหน้าหลัก
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">เกิดข้อผิดพลาด</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            ลองอีกครั้ง
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ระบบจัดการ Match Badminton" },
      { name: "description", content: "ระบบจัดการผู้เล่นและแมตช์แบดมินตันคู่ พร้อมสุ่มจับคู่ตามระดับฝีมือ" },
      { property: "og:title", content: "ระบบจัดการ Match Badminton" },
      { name: "twitter:title", content: "ระบบจัดการ Match Badminton" },
      { property: "og:description", content: "ระบบจัดการผู้เล่นและแมตช์แบดมินตันคู่ พร้อมสุ่มจับคู่ตามระดับฝีมือ" },
      { name: "twitter:description", content: "ระบบจัดการผู้เล่นและแมตช์แบดมินตันคู่ พร้อมสุ่มจับคู่ตามระดับฝีมือ" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/72717be5-f4ea-4ba0-b80f-199e5dab095b/id-preview-39f3b688--9cfe2200-fa3c-4944-9d2a-0d9336e766e7.lovable.app-1778421119968.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/72717be5-f4ea-4ba0-b80f-199e5dab095b/id-preview-39f3b688--9cfe2200-fa3c-4944-9d2a-0d9336e766e7.lovable.app-1778421119968.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AdminProvider>
        <div className="min-h-screen bg-background">
          <AppHeader />
          <Outlet />
        </div>
        <Toaster richColors position="top-center" />
      </AdminProvider>
    </QueryClientProvider>
  );
}
