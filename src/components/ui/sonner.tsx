"use client";

import { Toaster as SonnerToaster } from "sonner";
import { useTheme } from "@/components/shared/theme";

export function Toaster() {
  const { resolved } = useTheme();

  return (
    <SonnerToaster
      position="top-center"
      theme={resolved}
      toastOptions={{
        classNames: {
          toast: "rounded-2xl border border-border bg-background text-foreground shadow-lg",
          description: "text-muted-foreground",
        },
      }}
    />
  );
}
