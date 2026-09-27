export interface PushNotification {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export interface PushDeliverySummary {
  sent: number;
  failed: number;
  removed: number;
}

export interface PushTransportSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}
