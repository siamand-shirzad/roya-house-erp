import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Globe, KeyRound, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { ChangePasswordDialog } from "@/components/change-password-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { useTheme, type Theme } from "@/components/theme-provider";
import { ROLE_LABELS, type AuthUser } from "@/types";

// Signed-in user menu in the header (it used to sit in the sidebar footer):
// avatar button, then theme, password, guide and sign-out.

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function UserSummary({ user, detailed = false }: { user: AuthUser; detailed?: boolean }) {
  return (
    <>
      <Avatar className="size-8 rounded-lg">
        <AvatarFallback className="rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
          {initials(user.fullName)}
        </AvatarFallback>
      </Avatar>
      <div className={"grid flex-1 text-right leading-tight " + (!detailed ? "sr-only" : "")}>
        <span className="truncate text-sm font-medium">{user.fullName}</span>
        <span className="truncate text-xs opacity-60">{ROLE_LABELS[user.role]}</span>
        {/* Usernames can be long; show them in full only inside the menu. */}
        {detailed && (
          <span dir="ltr" className="break-all text-right font-mono text-[11px] opacity-60">
            {user.username}
          </span>
        )}
      </div>
    </>
  );
}

export function NavUser() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [passwordOpen, setPasswordOpen] = useState(false);
  if (!user) return null;

  return (
    <>
      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
      {/* Non-modal so the password dialog opened from it doesn't inherit a locked body. */}
      <DropdownMenu dir="rtl" modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8 rounded-lg p-0" aria-label={`حساب ${user.fullName}`}>
            <UserSummary user={user} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-60 rounded-lg" align="end" sideOffset={8}>
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-2 px-1 py-1.5">
              <UserSummary user={user} detailed />
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">پوسته</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as Theme)}>
            <DropdownMenuRadioItem value="light">
              <Sun /> روشن
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">
              <Moon /> تیره
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system">
              <Monitor /> مطابق سیستم
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={() => setPasswordOpen(true)}>
              <KeyRound /> تغییر رمز عبور
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate("/guide")}>
              <BookOpen /> راهنمای کار
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => window.open("/site", "_blank", "noopener")}>
              <Globe /> صفحه‌ی معرفی (سایت)
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={async () => {
              await logout();
              navigate("/login", { replace: true });
            }}
          >
            <LogOut /> خروج از حساب
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
