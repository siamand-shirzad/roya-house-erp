import { useState } from "react";
import { LoaderCircle, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { renderElementToPdf } from "@/lib/exportPdf";

// Sends the document PDF through the device's share sheet (WhatsApp,
// Telegram, email...) where the browser supports sharing files — phones and
// most laptops. Elsewhere it saves the PDF and opens WhatsApp with a short
// message, so the file can be attached by hand.
export function SharePdfButton({
  elementId,
  fileName,
  message,
  phone,
}: {
  elementId: string;
  fileName: string;
  message: string;
  /** The buyer's phone, used for the WhatsApp fallback link. */
  phone?: string | null;
}) {
  const [busy, setBusy] = useState(false);

  async function share() {
    setBusy(true);
    try {
      const node = document.getElementById(elementId);
      if (!node) throw new Error("Printable element not found");
      const pdf = await renderElementToPdf(node);
      const file = new File([pdf.output("blob")], fileName, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: fileName, text: message });
        return;
      }
      pdf.save(fileName);
      // Iranian mobile numbers: 09xx... -> 989xx... for wa.me.
      const digits = (phone ?? "").replace(/\D/g, "");
      const intl = digits.startsWith("09") ? `98${digits.slice(1)}` : digits.startsWith("98") ? digits : "";
      const url = `https://wa.me/${intl}?text=${encodeURIComponent(message)}`;
      window.open(url, "_blank", "noopener");
      toast.info("فایل PDF ذخیره شد؛ آن را در واتساپ پیوست کنید.");
    } catch (err) {
      // The user closing the share sheet is not an error.
      if ((err as Error).name !== "AbortError") {
        toast.error("اشتراک‌گذاری ناموفق بود.", { description: (err as Error).message });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button onClick={share} disabled={busy} size="sm" variant="outline">
      {busy ? <LoaderCircle className="animate-spin" /> : <Share2 />}
      ارسال
    </Button>
  );
}
