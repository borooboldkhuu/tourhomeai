"use client";

import { useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { deleteProperty } from "@/app/actions/properties";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger, DialogClose,
} from "@/components/ui/dialog";

export function DeletePropertyButton({ propertyId, title }: { propertyId: string; title: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10">
          <Trash2 /> Устгах
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Зар устгах уу?</DialogTitle>
          <DialogDescription>
            «{title}» зар, түүний бүх зураг, 360° панорама, хүсэлтүүд бүрмөсөн устана.
            Энэ үйлдлийг буцаах боломжгүй.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Болих</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={isPending}
            onClick={() => startTransition(() => deleteProperty(propertyId))}
          >
            {isPending && <Loader2 className="animate-spin" />} Устгах
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
