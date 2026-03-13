export enum UserFlow {
  menu = 'menu',
  upload = 'upload',
  question = 'question',
  docManagement = 'docManagement',
  estimate = 'estimate',
}

export interface UserSessionState<T = unknown> {
  userId: number;
  flow: UserFlow;
  flowData?: T;
  lastActivityAt?: number;
  messageIds?: string[];
}

export const PAYLOAD_STATE_SEPARATOR = '__&';
