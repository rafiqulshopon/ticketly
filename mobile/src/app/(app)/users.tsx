import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { UserListItem } from "@ticketly/shared";
import { ApiError, getUsers } from "@/lib/api";
import { isAdmin, useSession } from "@/lib/auth";
import { Button, TextField } from "@/components/ui";
import { UserRow } from "@/components/users/user-row";
import { UserForm } from "@/components/users/user-form";
import { DeleteUserConfirm } from "@/components/users/delete-user-confirm";
import { Redirect } from "expo-router";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

function toErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return "You don't have permission to view users.";
    if (err.status === 401) return "Your session may have expired — please sign in again.";
  }
  return err instanceof Error ? err.message : "Failed to load users.";
}

/** Users (admin-only) — the staff directory with debounced search, server-side
 *  pagination, and create/edit/delete via modals. Mobile port of the web UsersPage;
 *  the FlatList/pager/loading pattern mirrors the tickets screen. */
export default function UsersScreen() {
  const { data: session } = useSession();

  // `query` is the raw input; `search` is the debounced value used as the query
  // key. Typing updates the input immediately but only requests once the user
  // pauses; any search change resets to the first page.
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserListItem | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["users", search, page],
    queryFn: ({ signal }) => getUsers({ q: search || undefined, page, pageSize: PAGE_SIZE }, { signal }),
    placeholderData: keepPreviousData,
    retry: (failureCount, err) => !(err instanceof ApiError) && failureCount < 2,
  });

  if (!session || !isAdmin(session.user.role)) return <Redirect href="/(app)/tickets" />;

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  if (isError && !data) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text className="text-destructive">{toErrorMessage(error)}</Text>
        <Pressable onPress={() => void refetch()} className="mt-4">
          <Text className="text-primary">Try again</Text>
        </Pressable>
      </View>
    );
  }

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <View className="flex-1 bg-background">
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(u) => u.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListHeaderComponent={
          <View>
            <View className="flex flex-row items-end justify-between gap-3">
              <View className="flex-1">
                <Text className="text-2xl font-semibold text-foreground">Users</Text>
                <Text className="mt-1 text-sm text-muted-foreground">
                  {data ? `${total} ${total === 1 ? "user" : "users"}` : "Admin and agent accounts."}
                </Text>
              </View>
              <Button onPress={() => setCreateOpen(true)}>Create user</Button>
            </View>
            <TextField
              value={query}
              onChangeText={setQuery}
              placeholder="Search name or email…"
              className="mt-3"
            />
          </View>
        }
        ListEmptyComponent={
          <Text className="mt-8 text-center text-muted-foreground">
            {search ? `No users match "${search}".` : "No users yet."}
          </Text>
        }
        ListFooterComponent={
          total === 0 ? null : (
            <View className="mt-2 flex flex-row items-center justify-between">
              <Pressable onPress={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                <Text className={page <= 1 ? "text-muted-foreground" : "text-primary"}>‹ Prev</Text>
              </Pressable>
              <Text className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </Text>
              <Pressable onPress={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                <Text className={page >= totalPages ? "text-muted-foreground" : "text-primary"}>Next ›</Text>
              </Pressable>
            </View>
          )
        }
        renderItem={({ item }) => (
          <UserRow user={item} onEditUser={setEditingUser} onDeleteUser={setDeletingUser} />
        )}
      />

      <UserForm mode="create" open={createOpen} onOpenChange={setCreateOpen} />
      <UserForm
        mode="edit"
        user={editingUser}
        open={!!editingUser}
        onOpenChange={(o) => {
          if (!o) setEditingUser(null);
        }}
      />
      <DeleteUserConfirm
        user={deletingUser}
        open={!!deletingUser}
        onOpenChange={(o) => {
          if (!o) setDeletingUser(null);
        }}
      />
    </View>
  );
}
