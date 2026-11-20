export type DocumentType =
  | 'Aadhaar Card'
  | 'PAN Card'
  | 'APAAR / ABC ID'
  | 'Voter ID (EPIC)'
  | 'Driving Licence'
  | 'Passport'
  | 'Class X Marksheet/Certificate'
  | 'Class XII Marksheet/Certificate'
  | 'College Semester Marksheet'
  | 'Bonafide Student Certificate'
  | 'Current Year Fee Receipt'
  | 'Transfer/Migration Certificate'
  | 'Family Income Certificate'
  | 'Caste / Category Certificate (SC/ST/OBC-NCL/EWS)'
  | 'Domicile / Residence Certificate'
  | 'Disability (UDID) Certificate'
  | 'Bank Passbook Front Page / Cancelled Cheque'
  | 'Passport-Size Photograph'
  | 'Scanned Signature'
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
  pinCode: string | null;
  idOrCertificateNumber: string | null;
  issueDate: string | null;
  validTillDate: string | null;
  officialStampOrSignaturePresent: boolean | null;
}

export interface DeepExtractedMetadata {
  // Academic / Marksheet fields
  boardOrUniversityName: string | null;
  rollNumber: string | null;
  passingYear: string | null;
  aggregatePercentageOrCgpa: string | null;
  // Welfare / Category / Domicile certificate fields
  certificateOrApplicationNumber: string | null;
  issuingAuthority: string | null;
  financialYear: string | null;
  annualIncomeAmountInr: number | null;
  incomeThresholdAlert: string | null;
  // Bank Passbook / Cancelled Cheque fields
  accountHolderName: string | null;
  maskedAccountNumber: string | null;
  ifscCode: string | null;
  ifscValidFormat: boolean | null;
  bankAndBranchName: string | null;
  // Photo / Signature fields
  backgroundCheck: string | null;
  faceVisibility: string | null;
  signatureInkClarity: string | null;
}

export interface ForensicSignals {
  officialSealOrStampPresent: boolean | null;
  authorizedSignaturePresent: boolean | null;
  qrOrDigitalVerificationPresent: boolean | null;
  tamperOrLayoutAnomalies: string[];
  confidenceScore: number;
}

export interface MissingDocumentItem {
  requirementKey: string;
  label: string;
  reason: string;
  acceptedTypes: string[];
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
  deepMetadata: DeepExtractedMetadata;
  forensicSignals: ForensicSignals;
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
  missingMandatoryDocuments: MissingDocumentItem[];
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
