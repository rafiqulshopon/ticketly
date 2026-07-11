import { Pressable, Text, View } from "react-native";
import { Pencil, Trash2 } from "lucide-react-native";
import type { UserListItem } from "@ticketly/shared";
import { Avatar, AvatarFallback, Badge } from "@/components/ui";
import { cx } from "@/lib/cx";
import { initials } from "@/lib/format";
import { useIconColor } from "@/lib/colors";

interface UserRowProps {
  user: UserListItem;
  onEditUser: (user: UserListItem) => void;
  onDeleteUser: (user: UserListItem) => void;
}

/** A directory row (not navigable) — the mobile analog of the web's UserRow,
 *  stacked vertically. Edit/delete are the only actions; delete is disabled for
 *  admins (enforced server-side too) so the row stays aligned and the intent clear. */
export function UserRow({ user, onEditUser, onDeleteUser }: UserRowProps) {
  const muted = useIconColor("muted");
  const destructive = useIconColor("destructive");
  const isAdminUser = user.role === "admin";

  return (
    <View className="rounded-lg border border-border bg-card p-4">
      <View className="flex flex-row items-center gap-2.5">
        <Avatar className="size-7">
          <AvatarFallback className="bg-secondary">
            <Text className="text-[10px] font-medium text-secondary-foreground">{initials(user.name)}</Text>
          </AvatarFallback>
        </Avatar>
        <Text className="flex-1 font-semibold text-foreground" numberOfLines={1}>
          {user.name}
        </Text>
        <Pressable hitSlop={8} accessibilityLabel={`Edit ${user.name}`} onPress={() => onEditUser(user)}>
          <Pencil size={16} color={muted} />
        </Pressable>
        <Pressable
          testID="delete-user"
          hitSlop={8}
          accessibilityLabel={`Delete ${user.name}`}
          accessibilityState={{ disabled: isAdminUser }}
          disabled={isAdminUser}
          className={cx(isAdminUser && "opacity-40")}
          onPress={() => onDeleteUser(user)}
        >
          <Trash2 size={16} color={destructive} />
        </Pressable>
      </View>

      <Text className="mt-1 text-muted-foreground" numberOfLines={1}>
        {user.email}
      </Text>

      <View className="mt-2 flex flex-row items-center gap-2">
        {isAdminUser ? <Badge>Admin</Badge> : <Badge variant="secondary">Agent</Badge>}
        {user.banned ? <Badge variant="danger">Banned</Badge> : <Badge variant="success">Active</Badge>}
        <Text className="ml-auto text-xs text-muted-foreground">{new Date(user.createdAt).toLocaleDateString()}</Text>
      </View>
    </View>
  );
}
