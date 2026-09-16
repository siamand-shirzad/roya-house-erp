import { Link } from "react-router-dom";
import { Undo2 } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Placeholder: sales returns are planned but not built yet. The page says what
// will happen and what to do meanwhile, so the menu entry isn't a dead end.
const PLAN = [
  "برگشت از فروش به‌صورت یک سند جدا از روی فاکتور صادرشده ساخته می‌شود (مثل «برگشت از فروش» سپیدار) و فقط کالاها و تعدادِ برگشتی را می‌گیرد.",
  "با صدور آن، کالاها به موجودی انبار برمی‌گردند و مبلغش از مانده حساب مشتری کم می‌شود.",
  "شماره‌گذاری مستقل دارد و در گزارش فروش از فروش همان دوره کسر می‌شود.",
  "در خروجی سپیدار، فایل «برگشت از فروش» با شماره فاکتور مرجع اضافه می‌شود.",
];

export function ReturnsPage() {
  return (
    <AppShell title="برگشت از فروش">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Undo2 className="size-5 text-primary" /> برگشت از فروش
              <Badge variant="outline">به‌زودی</Badge>
            </CardTitle>
            <CardDescription>این بخش در مرحله‌ی بعد ساخته می‌شود. طرح آن:</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <ol className="list-inside list-decimal space-y-2">
              {PLAN.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
            <div className="rounded-lg border bg-muted/40 p-3 text-muted-foreground">
              <b className="text-foreground">تا آن زمان:</b> اگر همه‌ی کالاها برگشته، فاکتور و حواله را باطل کنید (کالاها خودکار به
              انبار برمی‌گردند). اگر بخشی برگشته، با «اصلاح موجودی» کالا را به انبار برگردانید و مبلغ را در سپیدار ثبت کنید.
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link to="/documents/invoice">فاکتورهای فروش</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/inventory">موجودی و گردش</Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link to="/guide#fixes">راهنمای ابطال و اصلاح</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
