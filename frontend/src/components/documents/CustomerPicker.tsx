import { useEffect, useState } from "react";
import { ChevronsUpDown, UserSearch } from "lucide-react";

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
import { api } from "@/lib/api";
import { matchesSearch } from "@/lib/search";
import type { Customer } from "@/types";

// Picking a customer copies their details into the buyer fields; the document
// keeps that copy, so a later edit of the customer never changes a printed one.
export function CustomerPicker({
  onSelect,
  disabled,
}: {
  onSelect: (customer: Customer) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  // A failed request is not an empty address book; saying "no customers found"
  // for one would send the user off to re-enter a customer they already have.
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || customers.length) return;
    setLoading(true);
    setFailed(false);
    api.customers
      .list()
      .then(setCustomers)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [open, customers.length]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-label="انتخاب از مشتریان" aria-expanded={open} disabled={disabled} className="justify-between sm:w-72">
          <span className="flex items-center gap-2 text-muted-foreground">
            <UserSearch className="size-4" /> انتخاب از مشتریان...
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(360px,calc(100vw-2rem))] p-0" align="start">
        <Command filter={(value, search) => matchesSearch(value, search) ? 1 : 0}>
          <CommandInput placeholder="جستجوی نام، کد یا تلفن..." />
          <CommandList>
            <CommandEmpty>
              {loading
                ? "در حال بارگذاری..."
                : failed
                  ? "دریافت مشتریان ناموفق بود. دوباره باز کنید."
                  : "مشتری‌ای یافت نشد."}
            </CommandEmpty>
            <CommandGroup>
              {customers.map((customer) => (
                <CommandItem
                  key={customer.id}
                  value={`${customer.name} ${customer.customerCode ?? ""} ${customer.phone ?? ""}`}
                  onSelect={() => {
                    onSelect(customer);
                    setOpen(false);
                  }}
                >
                  <div className="flex flex-col">
                    <span>{customer.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {[customer.customerCode && `کد ${customer.customerCode}`, customer.city, customer.phone]
                        .filter(Boolean)
                        .join(" · ") || "بدون مشخصات تکمیلی"}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
