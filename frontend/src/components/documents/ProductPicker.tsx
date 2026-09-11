import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { Product } from "@/types";
import { CATEGORY_LABELS } from "@/types";
import { formatToman } from "@/lib/format";

export function ProductPicker({ onSelect }: { onSelect: (product: Product) => void }) {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || products.length) return;
    setLoading(true);
    api.products
      .list({ active: "true" })
      .then(setProducts)
      .finally(() => setLoading(false));
  }, [open, products.length]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Search className="size-4" /> افزودن کالا از فهرست قیمت...
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(420px,calc(100vw-2rem))] p-0" align="start">
        <Command>
          <CommandInput placeholder="جستجوی نام یا کد کالا..." />
          <CommandList>
            <CommandEmpty>{loading ? "در حال بارگذاری..." : "کالایی یافت نشد."}</CommandEmpty>
            <CommandGroup>
              {products.map((product) => (
                <CommandItem
                  key={product.id}
                  value={`${product.name} ${product.code ?? ""}`}
                  onSelect={() => {
                    onSelect(product);
                    setOpen(false);
                  }}
                  className="flex items-center justify-between"
                >
                  <div className="flex flex-col">
                    <span>{product.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {CATEGORY_LABELS[product.category]} · {product.unit}
                      {product.code ? ` · ${product.code}` : ""}
                    </span>
                  </div>
                  <span className="text-xs font-medium shrink-0 pr-2">
                    {formatToman(product.unitPrice)} ت
                  </span>
                  <Check className={cn("mr-1 size-4 opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
