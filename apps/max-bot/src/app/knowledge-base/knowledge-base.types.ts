export enum KbPayload {
  startUpload = 'kb_start_upload',
  startQuestion = 'kb_start_question',
  listDocs = 'kb_list_docs',
}

export enum UploadStep {
  awaitingFile = 'awaiting_file',
}

export interface UploadFlowData {
  step: UploadStep;
}

export enum QuestionStep {
  awaitingQuestion = 'awaiting_question',
}

export interface QuestionFlowData {
  step: QuestionStep;
}
