export enum UserFlow {
  menu = 'menu',
  createFolder = 'create_folder',
  moveDocFilename = 'move_doc_filename',
  moveDocFolder = 'move_doc_folder',
  collectingFiles = 'collecting_files',
}

export interface UserSessionState {
  userId: number;
  flow: UserFlow;
  lastActivityAt?: number;
  messageIds?: string[];
  currentFolderId?: number | null;
  createFolderParentId?: number | null;
  moveDocIds?: number[];
  moveDocNames?: string[];
  pendingAttachments?: Array<{ filename: string; mimeType: string; fileUrl: string }>;
  pendingMoveFolder?: string;
  batchFiles?: Array<{ filename: string; mimeType: string; fileUrl: string }>;
  batchUserMessageIds?: string[];
}

export const PAYLOAD_STATE_SEPARATOR = '__&';
