export type DocumentType =
  | 'Aadhaar Card'
  | 'Class X Marksheet'
  | 'Class XII Marksheet'
  | 'Income Certificate'
  | 'Caste Certificate'
  | 'OBC-NCL Certificate'
  | 'EWS Certificate'
  | 'Domicile Certificate'
  | 'PAN Card'
  | 'Passport Photo'
  | 'Signature'
  | 'Unidentified';

export type ScanClarity =
  | 'CLEAR'
  | 'MINOR_GLARE'
  | 'SLIGHTLY_CROPPED'
  | 'BLURRY'
  | 'UNREADABLE';

export type ValidityStatus =
  | 'VALID'
  | 'EXPIRING_SOON'
  | 'EXPIRED'
  | 'NOT_APPLICABLE'
  | 'UNKNOWN';

export type FindingSeverity = 'CRITICAL' | 'WARNING' | 'PASS';

export interface ExtractedFields {
  fullName: string | null;
  parentName: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  address: string | null;
  idOrCertificateNumber: string | null;
  issueDate: string | null;
  validTillDate: string | null;
  officialStampOrSignaturePresent: boolean | null;
}

export interface AuditedDocument {
  documentIndex: number;
  fileName: string;
  documentType: DocumentType | string;
  scanClarity: ScanClarity;
  clarityNotes: string;
  validityStatus: ValidityStatus;
  validityNotes: string;
  extractedFields: ExtractedFields;
  documentWarnings: string[];
  documentBlockers: string[];
}

export interface DiscrepancyItem {
  id: string;
  field: string;
  severity: 'CRITICAL' | 'WARNING';
  summary: string;
  documentComparison: Array<{
    documentIndex: number;
    documentType: string;
    observedValue: string;
  }>;
  remediationStep: string;
}

export interface ScoreDeduction {
  reason: string;
  points: number;
  severity: 'CRITICAL' | 'WARNING';
}

export interface ComplianceAuditResult {
  targetScheme: string;
  auditDate: string;
  readinessScore: number;
  readinessTier: 'Ready to Submit' | 'Needs Attention' | 'High Rejection Risk';
  executiveVerdict: string;
  criticalBlockersCount: number;
  minorWarningsCount: number;
  deductions: ScoreDeduction[];
  documents: AuditedDocument[];
  discrepancies: DiscrepancyItem[];
  recommendedNextActions: string[];
}

export interface UploadedDocFile {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  base64Data: string;
  previewUrl: string;
}

export type ChatModelId =
  | 'gemini-4-hydrogen'
  | 'gemini-3.1-flash-lite'
  | 'gemini-4-argon'
  | 'gemini-4-carbon';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  modelUsed?: ChatModelId;
  timestamp: string;
  isError?: boolean;
}
