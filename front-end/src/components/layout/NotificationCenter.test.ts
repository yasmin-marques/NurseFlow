import { describe, expect, it } from 'vitest'
import { getNotificationIndicator } from './notificationIndicator'

describe('notification indicator', () => {
  it('omits the dot and unread count when there are no unread notifications', () => {
    expect(getNotificationIndicator(0)).toEqual({ hasUnread: false, label: 'Notificações' })
  })

  it('shows the dot and announces the unread count accessibly', () => {
    expect(getNotificationIndicator(2)).toEqual({ hasUnread: true, label: 'Notificações, 2 não lidas' })
  })
})
