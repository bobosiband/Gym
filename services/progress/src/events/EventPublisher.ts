/**
 * Outbound event publisher boundary. The AWS binding lives in
 * {@link EventBridgeEventPublisher}; tests ship a recording fake so
 * assertions can inspect every published event.
 */
export interface EventPublisher {
  publish(detailType: string, detail: Record<string, unknown>): Promise<void>;
}
