export enum KbPayload {
  listDocs = 'kb_list_docs',
  createFolder = 'kb_cf',
  deleteFolder = 'kb_df',
  moveDoc = 'kb_mv',
  cancelAction = 'kb_cancel',
  confirmPhotoUpload = 'kb_cpu',
  createFolderAndMove = 'kb_cfm',
}

export const KB_DOCS_PAGE_PREFIX = 'kb_docs_page_';
export const KB_FOLDER_PREFIX = 'kb_f_';
export const KB_FOLDER_PAGE_PREFIX = 'kb_fp_';
export const KB_FOLDER_DELETE_PREFIX = 'kb_fd_';
export const KB_FOLDER_DELETE_CONFIRM_PREFIX = 'kb_fdc_';
