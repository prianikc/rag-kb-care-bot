export enum EstimatePayload {
  startEstimate = 'est_start',
  generateEstimate = 'est_generate',
  exportEstimate = 'est_export',
  listEstimates = 'est_list',
  editWorkTypes = 'est_edit_work_types',
  editParameters = 'est_edit_parameters',
}

export enum EstimateStep {
  awaitingWorkTypes = 'awaiting_work_types',
  awaitingParameters = 'awaiting_parameters',
  confirming = 'confirming',
}

export interface EstimateFlowData {
  step: EstimateStep;
  workTypes?: string[];
  parameters?: EstimateParameters;
  estimateId?: number;
}

export interface EstimateParameters {
  roomArea?: number;
  roomHeight?: number;
  roomCount?: number;
  additionalNotes?: string;
}
