"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Bell,
  CircleHelp,
  LogOut,
  Menu,
  Settings,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { NotificationPanel } from "@/components/layout/notification-panel";
import { useAppData } from "@/components/data/app-data-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/lib/store";
import { initials } from "@/lib/utils";

interface AppHeaderProps {
  onMenuClick: () => void;
}

export function AppHeader({ onMenuClick }: AppHeaderProps) {
  const router = useRouter();
  const data = useAppData();
  const { signOut } = useAuth();
  const carePartner = data.carePartner;
  const unread = data.notifications.length;

  const handleSignOut = () => {
    signOut();
    toast.success("Signed out");
    router.replace("/sign-in");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-md">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
          aria-label="Open navigation"
        >
          <Menu />
        </Button>

        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg leading-none">ElderWise</p>
          <p className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:block">
            Care Partner
          </p>
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <time className="hidden font-mono text-xs text-muted-foreground xl:inline">
            {format(new Date(), "EEE, d MMM")}
          </time>

          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
              >
                <span className="relative">
                  <Bell className="h-4 w-4" />
                  {unread > 0 ? (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-sos px-1 font-mono text-[10px] text-white">
                      {unread}
                    </span>
                  ) : null}
                </span>
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md">
              <SheetHeader className="flex-row items-center justify-between space-y-0 pr-8">
                <SheetTitle>Notifications</SheetTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/notifications">View all</Link>
                </Button>
              </SheetHeader>
              <div className="mt-4">
                <NotificationPanel items={data.notifications} />
              </div>
            </SheetContent>
          </Sheet>

          <Button variant="ghost" size="icon" aria-label="Help and FAQ" asChild>
            <Link href="/faq">
              <CircleHelp />
            </Link>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-10 gap-2 rounded-full px-1.5"
                aria-label="Account menu"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {initials(
                      `${carePartner?.firstName ?? "C"} ${carePartner?.lastName ?? "P"}`,
                    )}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-[120px] truncate text-sm font-semibold md:inline">
                  {carePartner?.firstName ?? "Care Partner"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-semibold">
                    {carePartner?.firstName} {carePartner?.lastName}
                  </p>
                  <p className="text-xs font-normal text-muted-foreground">
                    {carePartner?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings#profile">
                  <UserRound /> Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings /> Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  handleSignOut();
                }}
              >
                <LogOut /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
