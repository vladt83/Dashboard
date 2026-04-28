import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Check, CheckCheck, DollarSign, Gift, MinusCircle, MessageSquare } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface NotificationBellProps {
  memberId: number;
}

export function NotificationBell({ memberId }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  
  const { data: notifications, refetch } = trpc.notifications.getAll.useQuery(
    { memberId, limit: 20 },
    { enabled: !!memberId }
  );
  
  const { data: unreadCount } = trpc.notifications.getUnreadCount.useQuery(
    { memberId },
    { enabled: !!memberId, refetchInterval: 30000 }
  );
  
  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => refetch(),
  });
  
  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => refetch(),
  });
  
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "payment_received":
        return <DollarSign className="h-4 w-4 text-green-400" />;
      case "bonus_added":
        return <Gift className="h-4 w-4 text-[#c7ab77]" />;
      case "deduction_added":
        return <MinusCircle className="h-4 w-4 text-red-400" />;
      case "notes_updated":
        return <MessageSquare className="h-4 w-4 text-blue-400" />;
      default:
        return <Bell className="h-4 w-4 text-zinc-400" />;
    }
  };
  
  const handleNotificationClick = (notification: any) => {
    if (!notification.isRead) {
      markReadMutation.mutate({ id: notification.id });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-lg hover:bg-zinc-800"
        >
          <Bell className="h-5 w-5 text-zinc-400" />
          {(unreadCount || 0) > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#c7ab77] text-xs font-bold text-black">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0 bg-zinc-900 border-zinc-800"
        align="end"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h4 className="font-semibold text-white">Notifications</h4>
          {(unreadCount || 0) > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllReadMutation.mutate({ memberId })}
              className="text-xs text-[#c7ab77] hover:text-[#b89a66]"
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-[300px]">
          {!notifications || notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
              <Bell className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full text-left px-4 py-3 hover:bg-zinc-800/50 transition-colors ${
                    !notification.isRead ? "bg-zinc-800/30" : ""
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium ${!notification.isRead ? "text-white" : "text-zinc-300"}`}>
                          {notification.title}
                        </p>
                        {!notification.isRead && (
                          <span className="h-2 w-2 rounded-full bg-[#c7ab77] shrink-0 mt-1.5" />
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
