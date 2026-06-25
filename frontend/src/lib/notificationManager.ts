export type NotificationStatus = 'unread' | 'read';

export interface NotificationItem {
  id: string;
  content: string;
  timestamp: Date;
  status: NotificationStatus;
}

export class NotificationManager {
  private notifications: NotificationItem[] = [];

  /**
   * Receives a new notification, defaulting status to 'unread'.
   * Appends to state and returns the newly created item.
   */
  public receiveNotification(content: string): NotificationItem {
    if (!content || !content.trim()) {
      throw new Error('Notification content cannot be empty.');
    }
    const newNotification: NotificationItem = {
      id: crypto.randomUUID(),
      content: content.trim(),
      timestamp: new Date(),
      status: 'unread',
    };
    this.notifications.push(newNotification);
    return newNotification;
  }

  /**
   * Marks a specific notification as read by transitioning its status from unread to read.
   */
  public viewNotification(id: string): NotificationItem | null {
    const item = this.notifications.find((n) => n.id === id);
    if (!item) return null;

    if (item.status === 'unread') {
      item.status = 'read';
    }
    return item;
  }

  /**
   * Marks all notifications as read.
   */
  public viewAllNotifications(): void {
    this.notifications.forEach((n) => {
      if (n.status === 'unread') {
        n.status = 'read';
      }
    });
  }

  /**
   * Retrieves all notifications sorted chronologically (newest first).
   */
  public getAllMessages(): NotificationItem[] {
    return [...this.notifications].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  /**
   * Retrieves only unread notifications sorted chronologically (newest first).
   */
  public getUnreadMessages(): NotificationItem[] {
    return this.notifications
      .filter((n) => n.status === 'unread')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Clears all stored notifications.
   */
  public clearAll(): void {
    this.notifications = [];
  }
}
