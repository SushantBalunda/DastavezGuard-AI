import type {
  AuditedDocument,
  ComplianceAuditResult,
  DeepExtractedMetadata,
  ForensicSignals,
  MissingDocumentItem,
  UploadedDocFile,
  ValidityStatus,
} from '../types/audit.ts';

export type AuditStage = 'upload' | 'processing' | 'review';

export function getAuditWorkflowStage(
  isAuditing: boolean,
  hasAuditResult: boolean,
): AuditStage {
  if (isAuditing) return 'processing';
  if (hasAuditResult) return 'review';
  return 'upload';
}

export function matchUploadedFileForDocument(
  files: UploadedDocFile[],
  documentIndex: number,
  fileName: string,
): UploadedDocFile | null {
  if (!files || files.length === 0) return null;
  const byIndex = files[documentIndex - 1];
  if (byIndex && byIndex.name === fileName) {
    return byIndex;
  }
  const byName = files.find((f) => f.name === fileName);
  if (byName) return byName;
  return byIndex ?? null;
}

export const TARGET_SCHEMES = [
  'National Scholarship Portal (NSP)',
  'OBC-NCL / EWS Central Reservation',
  'University / College Admission',
  'Passport / Police KYC Verification',
  'Custom / General Document Cross-Check',
] as const;

export const SUPPORTED_DOCUMENT_GROUPS = [
  {
    group: 'Identity & Citizen IDs',
    types: [
      'Aadhaar Card',
      'PAN Card',
      'APAAR / ABC ID',
      'Voter ID (EPIC)',
      'Driving Licence',
      'Passport',
    ],
  },
  {
    group: 'Academic Records',
    types: [
      'Class X Marksheet/Certificate',
      'Class XII Marksheet/Certificate',
      'College Semester Marksheet',
      'Bonafide Student Certificate',
      'Current Year Fee Receipt',
      'Transfer/Migration Certificate',
    ],
  },
  {
    group: 'Welfare & Category Certificates',
    types: [
      'Family Income Certificate',
      'Caste / Category Certificate (SC/ST/OBC-NCL/EWS)',
      'Domicile / Residence Certificate',
      'Disability (UDID) Certificate',
    ],
  },
  {
    group: 'Banking & Uploads',
    types: [
      'Bank Passbook Front Page / Cancelled Cheque',
      'Passport-Size Photograph',
      'Scanned Signature',
    ],
  },
] as const;

interface SchemeRequirementRule {
  requirementKey: string;
  label: string;
  reason: string;
  acceptedTypes: string[];
  matchKeywords: string[];
}

export const SCHEME_CHECKLISTS: Record<string, SchemeRequirementRule[]> = {
  'National Scholarship Portal (NSP)': [
    {
      requirementKey: 'nsp-aadhaar',
      label: 'Aadhaar Card',
      reason: 'Mandatory for NSP One-Time Registration (OTR) & e-KYC demographic verification.',
      acceptedTypes: ['Aadhaar Card'],
      matchKeywords: ['aadhaar', 'aadhar', 'uidai'],
    },
    {
      requirementKey: 'nsp-marksheet',
      label: 'Class X / XII Marksheet',
      reason: 'Required to verify date of birth and qualifying academic record.',
      acceptedTypes: ['Class X Marksheet/Certificate', 'Class XII Marksheet/Certificate'],
      matchKeywords: ['class x', 'class xii', '10th', '12th', 'marksheet'],
    },
    {
      requirementKey: 'nsp-income',
      label: 'Current Year Family Income Certificate',
      reason: 'Mandatory to confirm family income is below the scheme ceiling for FY 2026-27.',
      acceptedTypes: ['Family Income Certificate'],
      matchKeywords: ['income certificate', 'family income'],
    },
    {
      requirementKey: 'nsp-bonafide-fee',
      label: 'Bonafide Student Certificate or Current Year Fee Receipt',
      reason: 'Confirms active academic enrollment and payable tuition/fee structure.',
      acceptedTypes: ['Bonafide Student Certificate', 'Current Year Fee Receipt'],
      matchKeywords: ['bonafide', 'fee receipt'],
    },
    {
      requirementKey: 'nsp-bank',
      label: 'Bank Passbook Front Page / Cancelled Cheque',
      reason: 'Required for Aadhaar-seeded Direct Benefit Transfer (DBT) scholarship disbursement.',
      acceptedTypes: ['Bank Passbook Front Page / Cancelled Cheque'],
      matchKeywords: ['bank passbook', 'cancelled cheque', 'passbook', 'cheque'],
    },
  ],
  'OBC-NCL / EWS Central Reservation': [
    {
      requirementKey: 'res-aadhaar',
      label: 'Aadhaar Card',
      reason: 'Primary identity proof required for central reservation portal verification.',
      acceptedTypes: ['Aadhaar Card'],
      matchKeywords: ['aadhaar', 'aadhar', 'uidai'],
    },
    {
      requirementKey: 'res-class-x',
      label: 'Class X Marksheet/Certificate',
      reason: 'Authoritative proof of candidate name, parent name, and Date of Birth.',
      acceptedTypes: ['Class X Marksheet/Certificate'],
      matchKeywords: ['class x', '10th marksheet', 'secondary school'],
    },
    {
      requirementKey: 'res-caste-ews',
      label: 'Caste / EWS Certificate (Valid for Current FY)',
      reason: 'Central-format OBC-NCL or EWS certificate required for reservation claim.',
      acceptedTypes: ['Caste / Category Certificate (SC/ST/OBC-NCL/EWS)'],
      matchKeywords: ['caste', 'category certificate', 'obc-ncl', 'obc', 'ews'],
    },
    {
      requirementKey: 'res-income',
      label: 'Family Income Certificate',
      reason: 'Required to substantiate Non-Creamy Layer / EWS annual income threshold.',
      acceptedTypes: ['Family Income Certificate'],
      matchKeywords: ['income certificate', 'family income'],
    },
  ],
  'University / College Admission': [
    {
      requirementKey: 'adm-class-x',
      label: 'Class X Marksheet/Certificate',
      reason: 'Mandatory Date of Birth and secondary school completion proof.',
      acceptedTypes: ['Class X Marksheet/Certificate'],
      matchKeywords: ['class x', '10th marksheet', 'secondary school'],
    },
    {
      requirementKey: 'adm-class-xii',
      label: 'Class XII Marksheet/Certificate',
      reason: 'Mandatory qualifying examination marks and passing-year verification.',
      acceptedTypes: ['Class XII Marksheet/Certificate'],
      matchKeywords: ['class xii', '12th marksheet', 'senior secondary'],
    },
    {
      requirementKey: 'adm-tc',
      label: 'Transfer / Migration Certificate',
      reason: 'Required to confirm prior institution clearance before university enrollment.',
      acceptedTypes: ['Transfer/Migration Certificate'],
      matchKeywords: ['transfer', 'migration'],
    },
    {
      requirementKey: 'adm-id',
      label: 'Aadhaar Card or APAAR / ABC ID',
      reason: 'Mandatory national student / Academic Bank of Credits identity record.',
      acceptedTypes: ['Aadhaar Card', 'APAAR / ABC ID'],
      matchKeywords: ['aadhaar', 'aadhar', 'apaar', 'abc id'],
    },
    {
      requirementKey: 'adm-photo-sig',
      label: 'Passport-Size Photograph / Scanned Signature',
      reason: 'Required for admit card, university ID card, and examination portal profile.',
      acceptedTypes: ['Passport-Size Photograph', 'Scanned Signature'],
      matchKeywords: ['photograph', 'passport photo', 'passport-size', 'signature'],
    },
  ],
  'Passport / Police KYC Verification': [
    {
      requirementKey: 'kyc-aadhaar',
      label: 'Aadhaar Card',
      reason: 'Primary biometric/demographic identity document for Passport Seva KYC.',
      acceptedTypes: ['Aadhaar Card'],
      matchKeywords: ['aadhaar', 'aadhar', 'uidai'],
    },
    {
      requirementKey: 'kyc-pan-voter',
      label: 'PAN Card or Voter ID (EPIC)',
      reason: 'Secondary government photo identity verification for KYC compliance.',
      acceptedTypes: ['PAN Card', 'Voter ID (EPIC)'],
      matchKeywords: ['pan card', 'voter id', 'epic'],
    },
    {
      requirementKey: 'kyc-class-x',
      label: 'Class X Marksheet/Certificate (Non-ECR Birth Proof)',
      reason: 'Establishes Non-ECR eligibility and verified Date of Birth.',
      acceptedTypes: ['Class X Marksheet/Certificate'],
      matchKeywords: ['class x', '10th marksheet', 'secondary school'],
    },
    {
      requirementKey: 'kyc-address',
      label: 'Address Proof (Aadhaar / Domicile / Voter ID / Bank Passbook)',
      reason: 'Required by Police Verification to confirm current residential address & PIN.',
      acceptedTypes: [
        'Aadhaar Card',
        'Domicile / Residence Certificate',
        'Voter ID (EPIC)',
        'Bank Passbook Front Page / Cancelled Cheque',
        'Driving Licence',
        'Passport',
      ],
      matchKeywords: [
        'aadhaar',
        'aadhar',
        'domicile',
        'residence',
        'voter id',
        'epic',
        'bank passbook',
        'passbook',
        'driving licence',
        'passport',
      ],
    },
  ],
  'Custom / General Document Cross-Check': [],
};

export function evaluateSchemeChecklist(
  targetScheme: string,
  documents: Array<{ documentType: string }>,
): MissingDocumentItem[] {
  const normalizedScheme = targetScheme.trim().toLowerCase();
  const matchedEntry = Object.entries(SCHEME_CHECKLISTS).find(
    ([schemeName]) => schemeName.toLowerCase() === normalizedScheme,
  );

  if (!matchedEntry) {
    return [];
  }

  const rules = matchedEntry[1];
  if (rules.length === 0) return [];

  const detectedTypes = documents.map((d) => (d.documentType || '').toLowerCase());

  return rules
    .filter((rule) => {
      const satisfied = detectedTypes.some((dt) =>
        rule.matchKeywords.some((kw) => dt.includes(kw)),
      );
      return !satisfied;
    })
    .map((rule) => ({
      requirementKey: rule.requirementKey,
      label: rule.label,
      reason: rule.reason,
      acceptedTypes: rule.acceptedTypes,
    }));
}

export function maskAadhaarNumber(
  idNumber: string | null | undefined,
  docType: string,
): string | null {
  if (!idNumber) return null;
  const trimmed = idNumber.trim();
  const isAadhaarDoc = /aadhaar|aadhar|uidai/i.test(docType);
  const digitsOnly = trimmed.replace(/[\s-]/g, '');

  if (isAadhaarDoc || /^\d{12}$/.test(digitsOnly)) {
    if (digitsOnly.length >= 4) {
      const last4 = digitsOnly.slice(-4);
      return `XXXX-XXXX-${last4}`;
    }
    return 'XXXX-XXXX-XXXX';
  }

  return trimmed;
}

export function maskBankAccountNumber(accountNumber: string | null | undefined): string | null {
  if (!accountNumber) return null;
  const trimmed = accountNumber.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[\s-]/g, '');
  if (cleaned.length <= 4) return cleaned;
  const last4 = cleaned.slice(-4);
  const maskedPrefix = 'X'.repeat(Math.max(4, Math.min(10, cleaned.length - 4)));
  return `${maskedPrefix}${last4}`;
}

export function validateIfscCode(ifsc: string | null | undefined): {
  normalized: string | null;
  isValid: boolean | null;
} {
  if (!ifsc || !ifsc.trim()) {
    return { normalized: null, isValid: null };
  }
  const normalized = ifsc.trim().toUpperCase().replace(/\s+/g, '');
  return {
    normalized,
    isValid: /^[A-Z]{4}0[A-Z0-9]{6}$/.test(normalized),
  };
}

export function extractIndianPinCode(
  address: string | null | undefined,
  explicitPin?: string | null,
): string | null {
  if (explicitPin && /^[1-9]\d{5}$/.test(explicitPin.trim())) {
    return explicitPin.trim();
  }
  if (!address) return null;
  const match = /\b([1-9]\d{5})\b/.exec(address);
  return match ? match[1] : null;
}

export function evaluateIncomeThresholds(
  docType: string,
  annualIncomeAmountInr: number | null | undefined,
): string | null {
  if (
    annualIncomeAmountInr === null ||
    annualIncomeAmountInr === undefined ||
    Number.isNaN(annualIncomeAmountInr)
  ) {
    return null;
  }
  const isIncomeRelated = /income|obc|ews|caste|category/i.test(docType);
  if (!isIncomeRelated) return null;

  if (annualIncomeAmountInr > 800000) {
    return `Declared income ₹${annualIncomeAmountInr.toLocaleString('en-IN')} exceeds both ₹2.5L scholarship limit and ₹8.0L OBC-NCL / EWS creamy-layer threshold.`;
  }
  if (annualIncomeAmountInr > 250000) {
    return `Declared income ₹${annualIncomeAmountInr.toLocaleString('en-IN')} exceeds ₹2.5L scholarship / fee-waiver ceiling (within ₹8.0L OBC-NCL limit).`;
  }
  return null;
}

export type NameComparisonResult = {
  status: 'MATCH' | 'MINOR_DIFFERENCE' | 'MISMATCH' | 'INSUFFICIENT_DATA';
  details: string;
};

export function normalizeNameTokens(rawName: string): string[] {
  return rawName
    .toLowerCase()
    .replace(/\./g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

const ABBREVIATION_MAP: Record<string, string> = {
  kr: 'kumar',
  km: 'kumari',
  md: 'mohammad',
  mohd: 'mohammad',
  sh: 'shri',
  smt: 'shrimati',
  dr: 'doctor',
  pd: 'prasad',
  sd: 'singh',
};

export function expandAbbreviationToken(token: string): string {
  return ABBREVIATION_MAP[token] ?? token;
}

export function comparePersonNames(names: Array<string | null | undefined>): NameComparisonResult {
  const valid = names.map((n) => (n ?? '').trim()).filter(Boolean);
  if (valid.length < 2) {
    return {
      status: 'INSUFFICIENT_DATA',
      details: 'Fewer than two documents contain an extracted name.',
    };
  }

  const exactSet = new Set(valid.map((n) => n.toLowerCase().replace(/\s+/g, ' ')));
  if (exactSet.size === 1) {
    return {
      status: 'MATCH',
      details: 'All documents have identical name spelling.',
    };
  }

  const tokenized = valid.map(normalizeNameTokens);
  const expanded = tokenized.map((tokens) => tokens.map(expandAbbreviationToken));
  const expandedJoined = new Set(expanded.map((t) => t.join(' ')));

  if (expandedJoined.size === 1) {
    return {
      status: 'MINOR_DIFFERENCE',
      details: 'Abbreviation or punctuation variation detected (e.g., "Kr." vs "Kumar").',
    };
  }

  const firstTokens = new Set(expanded.map((t) => t[0] ?? ''));
  const lastTokens = new Set(expanded.map((t) => t[t.length - 1] ?? ''));
  if (firstTokens.size === 1 && lastTokens.size === 1) {
    return {
      status: 'MINOR_DIFFERENCE',
      details: 'First and surname match, but middle name or initial differs across documents.',
    };
  }

  return {
    status: 'MISMATCH',
    details: 'Distinct name discrepancy detected across documents.',
  };
}

function parseIsoDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const d = new Date(Date.UTC(year, month, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return d;
}

function getIndianFinancialYearStart(today: Date): {
  fyStart: Date;
  fyStartIso: string;
  fyLabel: string;
} {
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth(); // 0-indexed, April is 3
  const fyStartYear = month >= 3 ? year : year - 1;
  const fyStart = new Date(Date.UTC(fyStartYear, 3, 1));
  const nextYearShort = String((fyStartYear + 1) % 100).padStart(2, '0');
  return {
    fyStart,
    fyStartIso: `${fyStartYear}-04-01`,
    fyLabel: `${fyStartYear}-${nextYearShort}`,
  };
}

export function checkCertificateValidity(
  docType: string,
  issueDate: string | null | undefined,
  validTillDate: string | null | undefined,
  todayDate: string,
  _targetScheme?: string,
): { status: ValidityStatus; notes: string } {
  const permanentTypes = [
    'Aadhaar Card',
    'PAN Card',
    'APAAR / ABC ID',
    'Voter ID (EPIC)',
    'Driving Licence',
    'Passport',
    'Class X Marksheet',
    'Class XII Marksheet',
    'Transfer/Migration Certificate',
    'Passport-Size Photograph',
    'Passport Photo',
    'Scanned Signature',
    'Signature',
    'Bank Passbook Front Page / Cancelled Cheque',
  ];

  // Passport and Driving Licence may carry an explicit validTillDate; check expiry if present
  const hasExplicitExpiryDoc = /passport$|driving licence/i.test(docType.trim());
  if (
    !hasExplicitExpiryDoc &&
    permanentTypes.some((t) => docType.toLowerCase().includes(t.toLowerCase()))
  ) {
    return {
      status: 'NOT_APPLICABLE',
      notes: 'Permanent identity, academic, or banking record without annual FY renewal requirement.',
    };
  }

  const today = parseIsoDate(todayDate);
  if (!today) {
    return {
      status: 'UNKNOWN',
      notes: 'Invalid audit reference date.',
    };
  }

  const validTill = parseIsoDate(validTillDate);
  if (validTill) {
    const diffDays = Math.floor((validTill.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      return {
        status: 'EXPIRED',
        notes: `Expired ${Math.abs(diffDays)} days ago (Valid-Till: ${validTillDate}).`,
      };
    }
    if (diffDays <= 30) {
      return {
        status: 'EXPIRING_SOON',
        notes: `Expires in ${diffDays} days (Valid-Till: ${validTillDate}).`,
      };
    }
  }

  const issued = parseIsoDate(issueDate);
  const annualFyRenewalRequired = /income|obc-ncl|obc|ews/i.test(docType);
  if (annualFyRenewalRequired) {
    if (!issued) {
      return validTill
        ? {
            status: 'VALID',
            notes: `Valid until ${validTillDate}.`,
          }
        : {
            status: 'UNKNOWN',
            notes: 'Issue date missing; financial-year validity could not be verified.',
          };
    }

    const { fyStart, fyStartIso, fyLabel } = getIndianFinancialYearStart(today);
    if (issued.getTime() < fyStart.getTime()) {
      return {
        status: 'EXPIRED',
        notes: `Issued on ${issueDate} (before ${fyStartIso} / prior financial year); EXPIRED / NEEDS RENEWAL for ${fyLabel} schemes.`,
      };
    }

    const ageDays = Math.floor((today.getTime() - issued.getTime()) / (1000 * 60 * 60 * 24));
    if (ageDays > 365) {
      return {
        status: 'EXPIRED',
        notes: `Issued ${ageDays} days ago (${issueDate}); exceeds the 1-year validity limit for ${docType}.`,
      };
    }
    if (ageDays >= 335) {
      return {
        status: 'EXPIRING_SOON',
        notes: `Issued ${ageDays} days ago (${issueDate}); approaching 1-year expiry.`,
      };
    }
    return {
      status: 'VALID',
      notes: `Issued ${issueDate} within active FY ${fyLabel} (${ageDays} days old).`,
    };
  }

  if (validTill) {
    const diffDays = Math.floor((validTill.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return {
      status: 'VALID',
      notes: `Valid until ${validTillDate} (${diffDays} days remaining).`,
    };
  }

  return {
    status: issued ? 'VALID' : 'UNKNOWN',
    notes: issued
      ? `Issued on ${issueDate}; no explicit expiry restriction detected.`
      : 'No issue or expiry date extracted.',
  };
}

export function calculateReadinessScore(
  criticalBlockersCount: number,
  minorWarningsCount: number,
): {
  score: number;
  tier: 'Ready to Submit' | 'Needs Attention' | 'High Rejection Risk';
} {
  const safeCritical = Math.max(0, Math.floor(criticalBlockersCount));
  const safeWarnings = Math.max(0, Math.floor(minorWarningsCount));
  const rawScore = 100 - safeCritical * 30 - safeWarnings * 10;
  const score = Math.max(0, Math.min(100, rawScore));

  let tier: 'Ready to Submit' | 'Needs Attention' | 'High Rejection Risk' = 'High Rejection Risk';
  if (score >= 85 && safeCritical === 0) {
    tier = 'Ready to Submit';
  } else if (score >= 55) {
    tier = 'Needs Attention';
  }

  return { score, tier };
}

export interface DiffSegment {
  text: string;
  kind: 'same' | 'diff';
}

export interface FieldComparisonCell {
  documentIndex: number;
  value: string | null;
  status: 'EMPTY' | 'MATCH' | 'WARNING' | 'CRITICAL';
  segments: DiffSegment[];
}

export interface FieldComparisonRowResult {
  key: string;
  label: string;
  referenceValue: string | null;
  rowStatus: 'MATCH' | 'WARNING' | 'CRITICAL' | 'EMPTY';
  cells: FieldComparisonCell[];
}

function lcsDiffStrings(observed: string, reference: string): DiffSegment[] {
  if (observed === reference) {
    return [{ text: observed, kind: 'same' }];
  }

  const a = Array.from(observed);
  const b = Array.from(reference);
  const m = a.length;
  const n = b.length;

  // Guard against unexpectedly huge strings
  if (m * n > 40000) {
    return [{ text: observed, kind: 'diff' }];
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      if (a[i].toLowerCase() === b[j].toLowerCase()) {
        dp[i][j] = 1 + dp[i + 1][j + 1];
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const rawSegments: DiffSegment[] = [];
  let i = 0;
  let j = 0;

  while (i < m && j < n) {
    if (a[i].toLowerCase() === b[j].toLowerCase()) {
      rawSegments.push({ text: a[i], kind: 'same' });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rawSegments.push({ text: a[i], kind: 'diff' });
      i += 1;
    } else {
      j += 1;
    }
  }

  while (i < m) {
    rawSegments.push({ text: a[i], kind: 'diff' });
    i += 1;
  }

  const merged: DiffSegment[] = [];
  for (const seg of rawSegments) {
    const prev = merged[merged.length - 1];
    if (prev && prev.kind === seg.kind) {
      prev.text += seg.text;
    } else {
      merged.push({ ...seg });
    }
  }
  return merged;
}

function formatAddressWithPin(doc: AuditedDocument): string | null {
  const addr = doc.extractedFields.address?.trim() || null;
  const pin = extractIndianPinCode(addr, doc.extractedFields.pinCode);
  if (!addr && !pin) return null;
  if (addr && pin && !addr.includes(pin)) {
    return `${addr}, PIN ${pin}`;
  }
  return addr || `PIN ${pin}`;
}

export function getComparableFieldValue(doc: AuditedDocument, fieldKey: string): string | null {
  switch (fieldKey) {
    case 'fullName':
      return doc.extractedFields.fullName?.trim() || null;
    case 'parentName':
      return doc.extractedFields.parentName?.trim() || null;
    case 'dateOfBirth':
      return doc.extractedFields.dateOfBirth?.trim() || null;
    case 'gender':
      return doc.extractedFields.gender?.trim() || null;
    case 'addressAndPin':
      return formatAddressWithPin(doc);
    case 'accountHolderName':
      return doc.deepMetadata?.accountHolderName?.trim() || null;
    case 'idOrCertificateNumber':
      return doc.extractedFields.idOrCertificateNumber?.trim() || null;
    default:
      return null;
  }
}

function classifyPairDifference(
  fieldKey: string,
  observed: string,
  reference: string,
): 'MATCH' | 'WARNING' | 'CRITICAL' {
  const normObs = observed.toLowerCase().replace(/\s+/g, ' ').trim();
  const normRef = reference.toLowerCase().replace(/\s+/g, ' ').trim();
  if (normObs === normRef) {
    return 'MATCH';
  }

  if (fieldKey === 'fullName' || fieldKey === 'parentName' || fieldKey === 'accountHolderName') {
    const cmp = comparePersonNames([reference, observed]);
    if (cmp.status === 'MATCH') return 'MATCH';
    if (cmp.status === 'MINOR_DIFFERENCE') return 'WARNING';
    return 'CRITICAL';
  }

  if (fieldKey === 'addressAndPin') {
    const pinObs = extractIndianPinCode(observed);
    const pinRef = extractIndianPinCode(reference);
    if (pinObs && pinRef && pinObs !== pinRef) {
      return 'CRITICAL';
    }
    return 'WARNING';
  }

  return 'CRITICAL';
}

export function buildFieldComparisonRows(documents: AuditedDocument[]): FieldComparisonRowResult[] {
  const fields: Array<{ key: string; label: string }> = [
    { key: 'fullName', label: 'Full Name' },
    { key: 'parentName', label: "Father's / Mother's Name" },
    { key: 'dateOfBirth', label: 'Date of Birth' },
    { key: 'gender', label: 'Gender' },
    { key: 'addressAndPin', label: 'Address & PIN Code' },
    { key: 'accountHolderName', label: 'Bank Account Holder Name' },
  ];

  // For Bank Account Holder Name cross-check, compare against canonical Full Name when only 1 bank passbook exists
  const canonicalFullName =
    documents.find((d) => d.documentType.toLowerCase().includes('class x'))?.extractedFields
      .fullName?.trim() ||
    documents.find((d) => d.extractedFields.fullName?.trim())?.extractedFields.fullName?.trim() ||
    null;

  return fields.map((field) => {
    const rawValues = documents.map((doc) => ({
      documentIndex: doc.documentIndex,
      value: getComparableFieldValue(doc, field.key),
    }));

    const nonEmpty = rawValues.map((v) => v.value).filter((v): v is string => Boolean(v));
    if (nonEmpty.length === 0) {
      return {
        key: field.key,
        label: field.label,
        referenceValue: null,
        rowStatus: 'EMPTY',
        cells: rawValues.map((v) => ({
          documentIndex: v.documentIndex,
          value: null,
          status: 'EMPTY',
          segments: [],
        })),
      };
    }

    // Pick majority / canonical reference value (prefer Class X Marksheet for name/DOB if present)
    let referenceValue = nonEmpty[0];
    if (field.key === 'accountHolderName' && canonicalFullName) {
      referenceValue = canonicalFullName;
    } else if (field.key === 'fullName' || field.key === 'parentName' || field.key === 'dateOfBirth') {
      const counts = new Map<string, number>();
      for (const val of nonEmpty) {
        const key = val.toLowerCase().replace(/\s+/g, ' ');
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      const classXDoc = documents.find((d) =>
        d.documentType.toLowerCase().includes('class x'),
      );
      const classXVal = classXDoc ? getComparableFieldValue(classXDoc, field.key) : null;
      if (classXVal) {
        referenceValue = classXVal;
      } else {
        let bestCount = -1;
        for (const val of nonEmpty) {
          const c = counts.get(val.toLowerCase().replace(/\s+/g, ' ')) ?? 0;
          if (c > bestCount) {
            bestCount = c;
            referenceValue = val;
          }
        }
      }
    }

    let worst: 'MATCH' | 'WARNING' | 'CRITICAL' = 'MATCH';
    const cells: FieldComparisonCell[] = rawValues.map((v) => {
      if (!v.value) {
        return {
          documentIndex: v.documentIndex,
          value: null,
          status: 'EMPTY',
          segments: [],
        };
      }
      const cellStatus = classifyPairDifference(field.key, v.value, referenceValue);
      if (cellStatus === 'CRITICAL') {
        worst = 'CRITICAL';
      } else if (cellStatus === 'WARNING' && worst === 'MATCH') {
        worst = 'WARNING';
      }

      const segments =
        cellStatus === 'MATCH'
          ? [{ text: v.value, kind: 'same' as const }]
          : lcsDiffStrings(v.value, referenceValue);

      return {
        documentIndex: v.documentIndex,
        value: v.value,
        status: cellStatus,
        segments,
      };
    });

    return {
      key: field.key,
      label: field.label,
      referenceValue,
      rowStatus: worst,
      cells,
    };
  });
}

export function buildTtsBriefingScript(audit: ComplianceAuditResult): string {
  const missingCount = audit.missingMandatoryDocuments?.length ?? 0;
  const missingSentence =
    missingCount > 0
      ? `${missingCount} mandatory document${missingCount > 1 ? 's are' : ' is'} missing for ${audit.targetScheme}, including ${audit.missingMandatoryDocuments[0].label}.`
      : '';

  const topDiscrepancy =
    audit.discrepancies.length > 0
      ? `Top issue flagged: ${audit.discrepancies[0].summary}.`
      : 'No cross-document field mismatches were detected.';

  const firstAction =
    audit.recommendedNextActions.length > 0
      ? `Recommended first step: ${audit.recommendedNextActions[0]}`
      : 'All checked records are consistent for portal submission.';

  return [
    `DastavezGuard AI Compliance Briefing for ${audit.targetScheme}.`,
    `Your pre-submission readiness score is ${audit.readinessScore} out of 100, classified as ${audit.readinessTier}.`,
    `Across ${audit.documents.length} audited documents, there are ${audit.criticalBlockersCount} critical blockers and ${audit.minorWarningsCount} minor warnings.`,
    missingSentence,
    topDiscrepancy,
    firstAction,
  ]
    .filter(Boolean)
    .join(' ');
}

export function buildComplianceMailtoUrl(audit: ComplianceAuditResult): string {
  const subject = `DastavezGuard AI Audit: ${audit.targetScheme} (${audit.readinessScore}/100 - ${audit.readinessTier})`;

  const missingLines =
    (audit.missingMandatoryDocuments?.length ?? 0) === 0
      ? []
      : [
          '',
          'Missing Mandatory Documents:',
          ...audit.missingMandatoryDocuments.map(
            (m, index) => `${index + 1}. [MISSING] ${m.label} — ${m.reason}`,
          ),
        ];

  const discrepancyLines =
    audit.discrepancies.length === 0
      ? ['- None detected. All checked fields are consistent.']
      : audit.discrepancies.map(
          (item, index) =>
            `${index + 1}. [${item.severity}] ${item.field}: ${item.summary}\n   Remediation: ${item.remediationStep}`,
        );

  const actionLines =
    audit.recommendedNextActions.length === 0
      ? []
      : [
          '',
          'Recommended Next Actions:',
          ...audit.recommendedNextActions.map((step, index) => `${index + 1}. ${step}`),
        ];

  const rawBody = [
    `DastavezGuard AI Pre-Submission Compliance Summary`,
    `Target Scheme: ${audit.targetScheme}`,
    `Audit Date: ${audit.auditDate}`,
    `Overall Readiness Score: ${audit.readinessScore} / 100 (${audit.readinessTier})`,
    `Critical Blockers: ${audit.criticalBlockersCount} | Minor Warnings: ${audit.minorWarningsCount}`,
    '',
    `Auditor Verdict:`,
    audit.executiveVerdict,
    ...missingLines,
    '',
    `Compliance Discrepancies:`,
    ...discrepancyLines,
    ...actionLines,
  ].join('\n');

  const safeBody =
    rawBody.length > 1600
      ? `${rawBody.slice(0, 1580).trimEnd()}\n... (truncated for email length)`
      : rawBody;

  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(safeBody)}`;
}

export function buildAuditReportExportText(audit: ComplianceAuditResult): string {
  const lines: string[] = [
    '====================================================================',
    'DASTAVEZGUARD AI — PRE-SUBMISSION FORENSIC COMPLIANCE AUDIT REPORT',
    '====================================================================',
    `Target Scheme        : ${audit.targetScheme}`,
    `Audit Reference Date : ${audit.auditDate}`,
    `Readiness Score      : ${audit.readinessScore} / 100 (${audit.readinessTier})`,
    `Critical Blockers    : ${audit.criticalBlockersCount}`,
    `Minor Warnings       : ${audit.minorWarningsCount}`,
    `Documents Audited    : ${audit.documents.length}`,
    '',
    'EXECUTIVE VERDICT',
    '-----------------',
    audit.executiveVerdict,
    '',
  ];

  lines.push('SCHEME MANDATORY DOCUMENT CHECKLIST');
  lines.push('-----------------------------------');
  if (!audit.missingMandatoryDocuments || audit.missingMandatoryDocuments.length === 0) {
    lines.push('All mandatory documents for this scheme checklist are present.');
  } else {
    audit.missingMandatoryDocuments.forEach((m, i) => {
      lines.push(`${i + 1}. [MISSING] ${m.label}`);
      lines.push(`   Requirement: ${m.reason}`);
    });
  }
  lines.push('');

  lines.push('SCORE DEDUCTION LEDGER');
  lines.push('----------------------');
  if (audit.deductions.length === 0) {
    lines.push('No deductions applied (100/100 retained).');
  } else {
    audit.deductions.forEach((d, i) => {
      lines.push(`${i + 1}. [${d.severity}] -${d.points} pts — ${d.reason}`);
    });
  }
  lines.push('');

  lines.push('CROSS-DOCUMENT DISCREPANCIES & REMEDIATION');
  lines.push('------------------------------------------');
  if (audit.discrepancies.length === 0) {
    lines.push('No cross-document mismatches detected.');
  } else {
    audit.discrepancies.forEach((d, i) => {
      lines.push(`${i + 1}. [${d.severity}] ${d.field}: ${d.summary}`);
      d.documentComparison.forEach((c) => {
        lines.push(`   - Doc 0${c.documentIndex} (${c.documentType}): ${c.observedValue}`);
      });
      lines.push(`   Remediation: ${d.remediationStep}`);
    });
  }
  lines.push('');

  lines.push('SIDE-BY-SIDE FIELD COMPARISON MATRIX');
  lines.push('------------------------------------');
  const comparisonRows = buildFieldComparisonRows(audit.documents);
  comparisonRows.forEach((row) => {
    lines.push(`${row.label} [Status: ${row.rowStatus}]`);
    row.cells.forEach((cell) => {
      const doc = audit.documents.find((d) => d.documentIndex === cell.documentIndex);
      lines.push(
        `  - Doc 0${cell.documentIndex} (${doc?.documentType ?? 'Document'}): ${cell.value ?? '—'} [${cell.status}]`,
      );
    });
  });
  lines.push('');

  lines.push('PER-DOCUMENT DEEP EXTRACTED METADATA & FORENSICS');
  lines.push('------------------------------------------------');
  audit.documents.forEach((doc) => {
    const f = doc.extractedFields;
    const dm: Partial<DeepExtractedMetadata> = doc.deepMetadata ?? {};
    const fs: Partial<ForensicSignals> = doc.forensicSignals ?? {};
    lines.push(`Doc 0${doc.documentIndex}: ${doc.documentType} (${doc.fileName})`);
    lines.push(
      `  Clarity: ${doc.scanClarity} | Validity: ${doc.validityStatus} | Confidence: ${fs.confidenceScore ?? 'N/A'}/100`,
    );
    lines.push(`  Core Identity:`);
    lines.push(`    - Full Name       : ${f.fullName ?? 'Not Extracted'}`);
    lines.push(`    - Parent Name     : ${f.parentName ?? 'Not Extracted'}`);
    lines.push(`    - Date of Birth   : ${f.dateOfBirth ?? 'Not Extracted'}`);
    lines.push(`    - Gender          : ${f.gender ?? 'Not Extracted'}`);
    lines.push(`    - ID / Cert No.   : ${f.idOrCertificateNumber ?? 'Not Extracted'}`);
    lines.push(`    - Issue / Valid   : ${f.issueDate ?? '—'} / ${f.validTillDate ?? '—'}`);
    lines.push(`    - Address & PIN   : ${f.address ?? 'Not Extracted'} (PIN: ${f.pinCode ?? '—'})`);

    if (dm.boardOrUniversityName || dm.rollNumber || dm.passingYear || dm.aggregatePercentageOrCgpa) {
      lines.push(`  Academic Metadata:`);
      lines.push(`    - Board/Univ      : ${dm.boardOrUniversityName ?? '—'}`);
      lines.push(`    - Roll Number     : ${dm.rollNumber ?? '—'}`);
      lines.push(`    - Passing Year    : ${dm.passingYear ?? '—'}`);
      lines.push(`    - Score / CGPA    : ${dm.aggregatePercentageOrCgpa ?? '—'}`);
    }

    if (
      dm.certificateOrApplicationNumber ||
      dm.issuingAuthority ||
      dm.financialYear ||
      dm.annualIncomeAmountInr !== null && dm.annualIncomeAmountInr !== undefined
    ) {
      lines.push(`  Certificate Metadata:`);
      lines.push(`    - Cert/App No.    : ${dm.certificateOrApplicationNumber ?? '—'}`);
      lines.push(`    - Issuing Auth    : ${dm.issuingAuthority ?? '—'}`);
      lines.push(`    - Financial Year  : ${dm.financialYear ?? '—'}`);
      lines.push(
        `    - Annual Income   : ${
          dm.annualIncomeAmountInr !== null && dm.annualIncomeAmountInr !== undefined
            ? `INR ${dm.annualIncomeAmountInr.toLocaleString('en-IN')}`
            : '—'
        }`,
      );
      if (dm.incomeThresholdAlert) {
        lines.push(`    - Income Flag     : ${dm.incomeThresholdAlert}`);
      }
    }

    if (dm.accountHolderName || dm.maskedAccountNumber || dm.ifscCode || dm.bankAndBranchName) {
      lines.push(`  Banking Metadata:`);
      lines.push(`    - Account Holder  : ${dm.accountHolderName ?? '—'}`);
      lines.push(`    - Masked Acc No.  : ${dm.maskedAccountNumber ?? '—'}`);
      lines.push(
        `    - IFSC Code       : ${dm.ifscCode ?? '—'} (${
          dm.ifscValidFormat === true
            ? 'Valid 11-char format'
            : dm.ifscValidFormat === false
              ? 'INVALID IFSC FORMAT'
              : 'Unverified'
        })`,
      );
      lines.push(`    - Bank & Branch   : ${dm.bankAndBranchName ?? '—'}`);
    }

    if (dm.backgroundCheck || dm.faceVisibility || dm.signatureInkClarity) {
      lines.push(`  Media & Signature Quality:`);
      if (dm.backgroundCheck) lines.push(`    - Background      : ${dm.backgroundCheck}`);
      if (dm.faceVisibility) lines.push(`    - Face Visibility : ${dm.faceVisibility}`);
      if (dm.signatureInkClarity) lines.push(`    - Ink Clarity     : ${dm.signatureInkClarity}`);
    }

    lines.push(`  Authenticity & Tamper Signals:`);
    lines.push(`    - Seal / Stamp    : ${String(fs.officialSealOrStampPresent ?? f.officialStampOrSignaturePresent ?? 'Unknown')}`);
    lines.push(`    - Auth Signature  : ${String(fs.authorizedSignaturePresent ?? f.officialStampOrSignaturePresent ?? 'Unknown')}`);
    lines.push(`    - QR / DigiLocker : ${String(fs.qrOrDigitalVerificationPresent ?? 'Unknown')}`);
    if (fs.tamperOrLayoutAnomalies && fs.tamperOrLayoutAnomalies.length > 0) {
      lines.push(`    - Anomalies       : ${fs.tamperOrLayoutAnomalies.join('; ')}`);
    }
    if (doc.documentBlockers.length > 0) {
      lines.push(`  Blockers            : ${doc.documentBlockers.join(' | ')}`);
    }
    if (doc.documentWarnings.length > 0) {
      lines.push(`  Warnings            : ${doc.documentWarnings.join(' | ')}`);
    }
    lines.push('');
  });

  if (audit.recommendedNextActions.length > 0) {
    lines.push('RECOMMENDED NEXT ACTIONS');
    lines.push('------------------------');
    audit.recommendedNextActions.forEach((step, idx) => {
      lines.push(`${idx + 1}. ${step}`);
    });
  }

  return lines.join('\n');
}

function svgToBase64(svg: string): string {
  if (typeof btoa === 'function') {
    const bytes = new TextEncoder().encode(svg);
    let binary = '';
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }
  return Buffer.from(svg, 'utf-8').toString('base64');
}

export function getSampleAuditCase(): {
  targetScheme: string;
  todayDate: string;
  files: UploadedDocFile[];
  auditResult: ComplianceAuditResult;
} {
  const aadhaarSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="350" viewBox="0 0 560 350">
    <rect width="560" height="350" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
    <rect width="560" height="14" fill="#ea580c"/>
    <rect y="14" width="560" height="14" fill="#ffffff"/>
    <rect y="28" width="560" height="14" fill="#16a34a"/>
    <text x="28" y="70" font-family="sans-serif" font-size="18" font-weight="bold" fill="#0f172a">UNIQUE IDENTIFICATION AUTHORITY OF INDIA</text>
    <text x="28" y="92" font-family="sans-serif" font-size="12" fill="#475569">Government of India · Demo Specimen</text>
    <rect x="28" y="116" width="96" height="118" fill="#e2e8f0" stroke="#94a3b8"/>
    <circle cx="76" cy="158" r="22" fill="#94a3b8"/>
    <path d="M44 218 C44 190 108 190 108 218" fill="#94a3b8"/>
    <text x="144" y="138" font-family="sans-serif" font-size="15" font-weight="bold" fill="#0f172a">Name: Aarav Kr. Sharma</text>
    <text x="144" y="164" font-family="sans-serif" font-size="13" fill="#334155">S/O: Rajesh Kumar Sharma</text>
    <text x="144" y="188" font-family="sans-serif" font-size="13" fill="#334155">DOB: 14/08/2003 · Gender: Male</text>
    <text x="144" y="212" font-family="sans-serif" font-size="12" fill="#475569">42, Sector 14, Rohini, New Delhi - 110085</text>
    <text x="144" y="286" font-family="monospace" font-size="22" font-weight="bold" fill="#0f172a">4829 7310 9184</text>
    <rect x="462" y="246" width="66" height="66" fill="#0f172a" opacity="0.12" stroke="#475569"/>
    <text x="495" y="283" text-anchor="middle" font-family="monospace" font-size="10" fill="#0f172a">UID QR</text>
  </svg>`;

  const marksheetSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="350" viewBox="0 0 560 350">
    <rect width="560" height="350" fill="#fffbeb" stroke="#d97706" stroke-width="2"/>
    <rect x="12" y="12" width="536" height="326" fill="none" stroke="#b45309" stroke-width="1"/>
    <text x="280" y="50" text-anchor="middle" font-family="serif" font-size="18" font-weight="bold" fill="#78350f">CENTRAL BOARD OF SECONDARY EDUCATION</text>
    <text x="280" y="72" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="bold" fill="#92400e">MARKS STATEMENT · SECONDARY SCHOOL EXAMINATION (CLASS X)</text>
    <text x="32" y="114" font-family="sans-serif" font-size="13" fill="#1e293b">Candidate Name: AARAV KUMAR SHARMA</text>
    <text x="32" y="138" font-family="sans-serif" font-size="13" fill="#1e293b">Father's Name: RAJESH KUMAR SHARMA</text>
    <text x="32" y="162" font-family="sans-serif" font-size="13" fill="#1e293b">Date of Birth: 14/08/2003 · Passing Year: 2019</text>
    <text x="32" y="186" font-family="sans-serif" font-size="13" fill="#1e293b">Roll No: 1245890 · Issue Date: 2019-05-06</text>
    <rect x="32" y="210" width="496" height="72" fill="#fef3c7" stroke="#f59e0b"/>
    <text x="48" y="236" font-family="monospace" font-size="12" fill="#451a03">ENG: 91 | HIN: 88 | MAT: 95 | SCI: 92 | SOC: 89 · AGG: 91.0%</text>
    <text x="48" y="262" font-family="sans-serif" font-size="12" font-weight="bold" fill="#451a03">RESULT: PASS · Official Board Seal &amp; DigiLocker QR Verified</text>
    <circle cx="475" cy="296" r="24" fill="none" stroke="#1d4ed8" stroke-width="1.5"/>
    <text x="475" y="300" text-anchor="middle" font-family="sans-serif" font-size="9" font-weight="bold" fill="#1d4ed8">SEAL</text>
  </svg>`;

  const incomeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="350" viewBox="0 0 560 350">
    <rect width="560" height="350" fill="#f8fafc" stroke="#64748b" stroke-width="2"/>
    <text x="280" y="48" text-anchor="middle" font-family="serif" font-size="17" font-weight="bold" fill="#0f172a">OFFICE OF THE TEHSILDAR · REVENUE DEPARTMENT</text>
    <text x="280" y="70" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="bold" fill="#334155">ANNUAL FAMILY INCOME CERTIFICATE (FY 2025-26)</text>
    <text x="32" y="108" font-family="monospace" font-size="12" fill="#475569">Cert No: DL/INC/2026/0048192 · Rohini Sub-Division</text>
    <text x="32" y="136" font-family="sans-serif" font-size="13" fill="#0f172a">Certified that Aarav Kumar Sharma S/o Rajesh Kr. Sharma</text>
    <text x="32" y="160" font-family="sans-serif" font-size="13" fill="#0f172a">Residing at H.No. 42 Sec-14 Rohini New Delhi 110085</text>
    <text x="32" y="184" font-family="sans-serif" font-size="13" fill="#0f172a">Annual Family Income: INR 2,85,000</text>
    <text x="32" y="218" font-family="monospace" font-size="13" font-weight="bold" fill="#b91c1c">Issue Date: 2026-02-14 · Prior FY (Before Apr 1, 2026)</text>
    <text x="32" y="264" font-family="sans-serif" font-size="12" fill="#475569">Note: Digital Signature Missing / Unverified Seal &amp; QR Absent</text>
  </svg>`;

  const bankSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="350" viewBox="0 0 560 350">
    <rect width="560" height="350" fill="#eff6ff" stroke="#1d4ed8" stroke-width="2"/>
    <rect width="560" height="44" fill="#1e3a8a"/>
    <text x="28" y="28" font-family="sans-serif" font-size="16" font-weight="bold" fill="#ffffff">STATE BANK OF INDIA · SAVINGS PASSBOOK</text>
    <text x="28" y="80" font-family="sans-serif" font-size="13" font-weight="bold" fill="#0f172a">Branch: Rohini Sector-14, New Delhi (110085)</text>
    <text x="28" y="114" font-family="sans-serif" font-size="14" font-weight="bold" fill="#0f172a">Account Holder: Aarav K. Sharma</text>
    <text x="28" y="142" font-family="monospace" font-size="13" fill="#334155">Account No: 309184777392 · Mode: Single</text>
    <text x="28" y="168" font-family="monospace" font-size="13" font-weight="bold" fill="#1d4ed8">IFSC Code: SBIN0004821</text>
    <text x="28" y="198" font-family="sans-serif" font-size="12" fill="#475569">Address: 42, Sector 14, Rohini, New Delhi - 110085</text>
    <circle cx="470" cy="260" r="32" fill="none" stroke="#1d4ed8" stroke-width="1.5"/>
    <text x="470" y="264" text-anchor="middle" font-family="sans-serif" font-size="10" font-weight="bold" fill="#1d4ed8">BANK STAMP</text>
  </svg>`;

  const aadhaarBase64 = svgToBase64(aadhaarSvg);
  const marksheetBase64 = svgToBase64(marksheetSvg);
  const incomeBase64 = svgToBase64(incomeSvg);
  const bankBase64 = svgToBase64(bankSvg);

  const files: UploadedDocFile[] = [
    {
      id: 'sample-aadhaar',
      name: 'aadhaar_front_specimen.svg',
      mimeType: 'image/svg+xml',
      sizeBytes: aadhaarSvg.length,
      base64Data: aadhaarBase64,
      previewUrl: `data:image/svg+xml;base64,${aadhaarBase64}`,
    },
    {
      id: 'sample-marksheet',
      name: 'class_x_cbse_marksheet.svg',
      mimeType: 'image/svg+xml',
      sizeBytes: marksheetSvg.length,
      base64Data: marksheetBase64,
      previewUrl: `data:image/svg+xml;base64,${marksheetBase64}`,
    },
    {
      id: 'sample-income',
      name: 'income_certificate_fy25_26.svg',
      mimeType: 'image/svg+xml',
      sizeBytes: incomeSvg.length,
      base64Data: incomeBase64,
      previewUrl: `data:image/svg+xml;base64,${incomeBase64}`,
    },
    {
      id: 'sample-bank',
      name: 'sbi_bank_passbook_front.svg',
      mimeType: 'image/svg+xml',
      sizeBytes: bankSvg.length,
      base64Data: bankBase64,
      previewUrl: `data:image/svg+xml;base64,${bankBase64}`,
    },
  ];

  const documents: AuditedDocument[] = [
    {
      documentIndex: 1,
      fileName: 'aadhaar_front_specimen.svg',
      documentType: 'Aadhaar Card',
      scanClarity: 'CLEAR',
      clarityNotes: 'Text, photo, QR code, and 12-digit UID are crisp with zero edge clipping.',
      validityStatus: 'NOT_APPLICABLE',
      validityNotes: 'Permanent national identity card; no annual FY renewal required.',
      extractedFields: {
        fullName: 'Aarav Kr. Sharma',
        parentName: 'Rajesh Kumar Sharma',
        dateOfBirth: '2003-08-14',
        gender: 'Male',
        address: '42, Sector 14, Rohini, New Delhi - 110085',
        pinCode: '110085',
        idOrCertificateNumber: 'XXXX-XXXX-9184',
        issueDate: null,
        validTillDate: null,
        officialStampOrSignaturePresent: true,
      },
      deepMetadata: {
        boardOrUniversityName: null,
        rollNumber: null,
        passingYear: null,
        aggregatePercentageOrCgpa: null,
        certificateOrApplicationNumber: null,
        issuingAuthority: 'UIDAI (Government of India)',
        financialYear: null,
        annualIncomeAmountInr: null,
        incomeThresholdAlert: null,
        accountHolderName: null,
        maskedAccountNumber: null,
        ifscCode: null,
        ifscValidFormat: null,
        bankAndBranchName: null,
        backgroundCheck: null,
        faceVisibility: 'Clear frontal portrait on card',
        signatureInkClarity: null,
      },
      forensicSignals: {
        officialSealOrStampPresent: true,
        authorizedSignaturePresent: true,
        qrOrDigitalVerificationPresent: true,
        tamperOrLayoutAnomalies: [],
        confidenceScore: 97,
      },
      documentWarnings: [
        'Name uses abbreviated middle name "Kr." instead of "Kumar" shown on Class X Marksheet.',
      ],
      documentBlockers: [
        'Name abbreviation "Kr." conflicts with Class X Marksheet ("AARAV KUMAR SHARMA").',
      ],
    },
    {
      documentIndex: 2,
      fileName: 'class_x_cbse_marksheet.svg',
      documentType: 'Class X Marksheet/Certificate',
      scanClarity: 'CLEAR',
      clarityNotes: 'High-contrast scan with complete board border and legible marks table.',
      validityStatus: 'NOT_APPLICABLE',
      validityNotes: 'Permanent academic qualification record.',
      extractedFields: {
        fullName: 'AARAV KUMAR SHARMA',
        parentName: 'RAJESH KUMAR SHARMA',
        dateOfBirth: '2003-08-14',
        gender: null,
        address: null,
        pinCode: null,
        idOrCertificateNumber: '1245890',
        issueDate: '2019-05-06',
        validTillDate: null,
        officialStampOrSignaturePresent: true,
      },
      deepMetadata: {
        boardOrUniversityName: 'Central Board of Secondary Education (CBSE)',
        rollNumber: '1245890',
        passingYear: '2019',
        aggregatePercentageOrCgpa: '91.0%',
        certificateOrApplicationNumber: null,
        issuingAuthority: 'CBSE Controller of Examinations',
        financialYear: null,
        annualIncomeAmountInr: null,
        incomeThresholdAlert: null,
        accountHolderName: null,
        maskedAccountNumber: null,
        ifscCode: null,
        ifscValidFormat: null,
        bankAndBranchName: null,
        backgroundCheck: null,
        faceVisibility: null,
        signatureInkClarity: null,
      },
      forensicSignals: {
        officialSealOrStampPresent: true,
        authorizedSignaturePresent: true,
        qrOrDigitalVerificationPresent: true,
        tamperOrLayoutAnomalies: [],
        confidenceScore: 98,
      },
      documentWarnings: [],
      documentBlockers: [],
    },
    {
      documentIndex: 3,
      fileName: 'income_certificate_fy25_26.svg',
      documentType: 'Family Income Certificate',
      scanClarity: 'CLEAR',
      clarityNotes: 'Certificate text is sharp, but official Revenue seal, digital signature, and QR code are absent.',
      validityStatus: 'EXPIRED',
      validityNotes:
        'Issued on 2026-02-14 (before 2026-04-01 / prior financial year); EXPIRED / NEEDS RENEWAL for 2026-27 schemes.',
      extractedFields: {
        fullName: 'Aarav Kumar Sharma',
        parentName: 'Rajesh Kr. Sharma',
        dateOfBirth: null,
        gender: null,
        address: 'H.No. 42 Sec-14 Rohini New Delhi 110085',
        pinCode: '110085',
        idOrCertificateNumber: 'DL/INC/2026/0048192',
        issueDate: '2026-02-14',
        validTillDate: null,
        officialStampOrSignaturePresent: false,
      },
      deepMetadata: {
        boardOrUniversityName: null,
        rollNumber: null,
        passingYear: null,
        aggregatePercentageOrCgpa: null,
        certificateOrApplicationNumber: 'DL/INC/2026/0048192',
        issuingAuthority: 'Office of the Tehsildar, Rohini Sub-Division',
        financialYear: '2025-26',
        annualIncomeAmountInr: 285000,
        incomeThresholdAlert:
          'Declared income ₹2,85,000 exceeds ₹2.5L scholarship / fee-waiver ceiling (within ₹8.0L OBC-NCL limit).',
        accountHolderName: null,
        maskedAccountNumber: null,
        ifscCode: null,
        ifscValidFormat: null,
        bankAndBranchName: null,
        backgroundCheck: null,
        faceVisibility: null,
        signatureInkClarity: null,
      },
      forensicSignals: {
        officialSealOrStampPresent: false,
        authorizedSignaturePresent: false,
        qrOrDigitalVerificationPresent: false,
        tamperOrLayoutAnomalies: [
          'Missing e-District QR verification block and Tehsildar digital signature panel.',
        ],
        confidenceScore: 81,
      },
      documentWarnings: [
        'Official Revenue Department stamp, digital signature, and e-District QR block are absent.',
        'Declared annual family income of INR 2,85,000 exceeds standard ₹2.5L NSP/fee-waiver income ceiling.',
        'Father name uses "Kr." abbreviation and address punctuation differs from Aadhaar.',
      ],
      documentBlockers: [
        'Issued on 2026-02-14 (prior FY 2025-26, before April 1, 2026) — expired for 2026-27 NSP cycle.',
      ],
    },
    {
      documentIndex: 4,
      fileName: 'sbi_bank_passbook_front.svg',
      documentType: 'Bank Passbook Front Page / Cancelled Cheque',
      scanClarity: 'CLEAR',
      clarityNotes: 'Account number, IFSC code, and branch stamp are fully legible.',
      validityStatus: 'NOT_APPLICABLE',
      validityNotes: 'Active banking credential for DBT verification.',
      extractedFields: {
        fullName: 'Aarav K. Sharma',
        parentName: null,
        dateOfBirth: null,
        gender: null,
        address: '42, Sector 14, Rohini, New Delhi - 110085',
        pinCode: '110085',
        idOrCertificateNumber: 'XXXXXX7392',
        issueDate: null,
        validTillDate: null,
        officialStampOrSignaturePresent: true,
      },
      deepMetadata: {
        boardOrUniversityName: null,
        rollNumber: null,
        passingYear: null,
        aggregatePercentageOrCgpa: null,
        certificateOrApplicationNumber: null,
        issuingAuthority: null,
        financialYear: null,
        annualIncomeAmountInr: null,
        incomeThresholdAlert: null,
        accountHolderName: 'Aarav K. Sharma',
        maskedAccountNumber: 'XXXXXX7392',
        ifscCode: 'SBIN0004821',
        ifscValidFormat: true,
        bankAndBranchName: 'State Bank of India — Rohini Sector-14, New Delhi',
        backgroundCheck: null,
        faceVisibility: null,
        signatureInkClarity: null,
      },
      forensicSignals: {
        officialSealOrStampPresent: true,
        authorizedSignaturePresent: true,
        qrOrDigitalVerificationPresent: false,
        tamperOrLayoutAnomalies: [],
        confidenceScore: 95,
      },
      documentWarnings: [
        'Account holder middle initial "K." differs from full middle name "Kumar" on Class X Marksheet.',
      ],
      documentBlockers: [],
    },
  ];

  const missingMandatoryDocuments = evaluateSchemeChecklist(
    'National Scholarship Portal (NSP)',
    documents,
  );

  const deductions = [
    {
      reason:
        'Missing mandatory NSP document: Bonafide Student Certificate or Current Year Fee Receipt',
      points: 30,
      severity: 'CRITICAL' as const,
    },
    {
      reason:
        'Family Income Certificate issued 2026-02-14 (before April 1, 2026 / prior FY 2025-26) requires FY 2026-27 renewal',
      points: 30,
      severity: 'CRITICAL' as const,
    },
    {
      reason:
        'Candidate Full Name mismatch ("Aarav Kr. Sharma" on Aadhaar vs "AARAV KUMAR SHARMA" on Class X Marksheet)',
      points: 30,
      severity: 'CRITICAL' as const,
    },
    {
      reason:
        'Missing Tehsildar official seal, authorized signature, and e-District QR block on Income Certificate',
      points: 10,
      severity: 'WARNING' as const,
    },
    {
      reason:
        'Bank Account Holder Name ("Aarav K. Sharma") and Parent Name ("Rajesh Kr. Sharma") use middle-name abbreviations',
      points: 10,
      severity: 'WARNING' as const,
    },
  ];

  const { score, tier } = calculateReadinessScore(3, 2);

  const auditResult: ComplianceAuditResult = {
    targetScheme: 'National Scholarship Portal (NSP)',
    auditDate: '2026-11-18',
    readinessScore: score,
    readinessTier: tier,
    executiveVerdict:
      'High rejection risk for FY 2026-27 NSP submission: a mandatory Bonafide/Fee Receipt is missing, the Income Certificate was issued before April 1, 2026 (prior FY 2025-26) and exceeds ₹2.5L at ₹2,85,000, and candidate/bank holder names vary across Aadhaar ("Kr."), Passbook ("K."), and Class X Marksheet ("Kumar").',
    criticalBlockersCount: 3,
    minorWarningsCount: 2,
    missingMandatoryDocuments,
    deductions,
    documents,
    discrepancies: [
      {
        id: 'disc-expiry-income-fy',
        field: 'Financial Year Validity & Income Threshold',
        severity: 'CRITICAL',
        summary:
          'Income Certificate issued 2026-02-14 (prior FY 2025-26) is expired for 2026-27 and declares ₹2,85,000 (> ₹2.5L limit)',
        documentComparison: [
          {
            documentIndex: 3,
            documentType: 'Family Income Certificate',
            observedValue: 'Issued 2026-02-14 (FY 2025-26) · INR 2,85,000',
          },
        ],
        remediationStep:
          'Obtain a freshly issued FY 2026-27 Family Income Certificate (issued on or after April 1, 2026) with e-District QR verification and confirm scheme income eligibility ceiling.',
      },
      {
        id: 'disc-name-candidate',
        field: 'Full Name & Bank Account Holder Name',
        severity: 'CRITICAL',
        summary:
          'Candidate name varies across records: "Aarav Kr. Sharma" (Aadhaar), "AARAV KUMAR SHARMA" (Class X), and "Aarav K. Sharma" (Bank Passbook)',
        documentComparison: [
          {
            documentIndex: 1,
            documentType: 'Aadhaar Card',
            observedValue: 'Aarav Kr. Sharma',
          },
          {
            documentIndex: 2,
            documentType: 'Class X Marksheet/Certificate',
            observedValue: 'AARAV KUMAR SHARMA',
          },
          {
            documentIndex: 4,
            documentType: 'Bank Passbook Front Page / Cancelled Cheque',
            observedValue: 'Aarav K. Sharma (Account Holder)',
          },
        ],
        remediationStep:
          'Align Aadhaar and Bank Passbook account holder name to "Aarav Kumar Sharma" matching Class X Marksheet to prevent PFMS/DBT name-match rejection.',
      },
      {
        id: 'disc-stamp-income',
        field: 'Official Seal, Signature & QR Verification',
        severity: 'WARNING',
        summary: 'Income Certificate lacks Revenue Officer seal, authorized signature, and e-District QR block',
        documentComparison: [
          {
            documentIndex: 3,
            documentType: 'Family Income Certificate',
            observedValue: 'Seal: Absent · Signature: Absent · QR: Absent',
          },
        ],
        remediationStep:
          'Download the digitally signed e-District PDF bearing the QR code and verified Tehsildar signature.',
      },
      {
        id: 'disc-parent-address',
        field: "Father's Name & Address Punctuation",
        severity: 'WARNING',
        summary: 'Father name ("Rajesh Kr. Sharma" vs "Rajesh Kumar Sharma") and address formatting differ',
        documentComparison: [
          {
            documentIndex: 1,
            documentType: 'Aadhaar Card',
            observedValue: 'Rajesh Kumar Sharma · 42, Sector 14, Rohini, New Delhi - 110085',
          },
          {
            documentIndex: 3,
            documentType: 'Family Income Certificate',
            observedValue: 'Rajesh Kr. Sharma · H.No. 42 Sec-14 Rohini New Delhi 110085',
          },
        ],
        remediationStep:
          'Request full parent name spelling "Rajesh Kumar Sharma" when renewing the FY 2026-27 Income Certificate.',
      },
    ],
    recommendedNextActions: [
      'Upload your institutional Bonafide Student Certificate or Current Year Fee Receipt to satisfy mandatory NSP enrollment proof.',
      'Renew your Family Income Certificate for FY 2026-27 (issued on or after April 1, 2026) via the e-District portal with verified QR & Tehsildar signature.',
      'Update Aadhaar ("Aarav Kr. Sharma") and SBI Passbook ("Aarav K. Sharma") to "Aarav Kumar Sharma" to pass PFMS DBT name matching.',
    ],
  };

  return {
    targetScheme: 'National Scholarship Portal (NSP)',
    todayDate: '2026-11-18',
    files,
    auditResult,
  };
}
