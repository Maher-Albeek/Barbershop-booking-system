export type PushProvider = "firebase-cloud-messaging" | "onesignal" | "web-push";

export interface PushSubscriptionAdapter {
  provider: PushProvider;
  subscribe: () => Promise<PushSubscription | null>;
  unsubscribe: () => Promise<void>;
}

export function createPushAdapter(_provider: PushProvider): PushSubscriptionAdapter {
  throw new Error("Push notifications are prepared but no provider is configured yet.");
}
