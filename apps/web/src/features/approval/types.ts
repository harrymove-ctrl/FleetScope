/** HITL Approval Card — beui-inspired, FleetScope-native (no React). */

export type ApprovalCardStatus =
  'pending' | 'approved' | 'submitting' | 'rejected' | 'changes-requested' | 'answered';

export interface ApprovalCardOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

export interface ApprovalCardQuestion {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly options?: readonly ApprovalCardOption[];
  readonly multiple?: boolean;
  readonly allowCustom?: boolean;
  readonly customPlaceholder?: string;
}

export interface ApprovalCardAnswer {
  readonly selected: readonly string[];
  readonly custom?: string;
}

export type ApprovalCardAnswers = Readonly<Record<string, ApprovalCardAnswer>>;

export function statusLabel(status: ApprovalCardStatus): string {
  switch (status) {
    case 'submitting':
      return 'Submitting';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    case 'changes-requested':
      return 'Changes requested';
    case 'answered':
      return 'Response submitted';
    default:
      return 'Input required';
  }
}
