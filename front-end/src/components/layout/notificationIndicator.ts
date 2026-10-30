export function getNotificationIndicator(unreadCount: number) {
  return {
    hasUnread: unreadCount > 0,
    label: `Notificações${unreadCount > 0 ? `, ${unreadCount} não lidas` : ''}`,
  }
}
