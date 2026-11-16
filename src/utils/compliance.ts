import type {
  ComplianceAuditResult,
  UploadedDocFile,
  ValidityStatus,
} from '../types/audit';

export const TARGET_SCHEMES = [
  'UPSC Civil Services Examination (CSE)',
  'JEE Main / JoSAA Counselling',
  'SSC CGL / CHSL Recruitment',
  'Central OBC-NCL / EWS Reservation Quota',
  'National Scholarship Portal (NSP)',
  'Passport Seva Fresh Application',
  'PM-KISAN / State Welfare Portal',
  'Custom Scheme',
] as const;

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

  // Check missing middle name: first and last tokens match across all docs
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

export function checkCertificateValidity(
  docType: string,
  issueDate: string | null | undefined,
  validTillDate: string | null | undefined,
  todayDate: string,
  _targetScheme?: string,
): { status: ValidityStatus; notes: string } {
  const permanentTypes = [
    'Aadhaar Card',
    'Class X Marksheet',
    'Class XII Marksheet',
    'PAN Card',
    'Passport Photo',
    'Signature',
  ];

  if (permanentTypes.some((t) => docType.toLowerCase().includes(t.toLowerCase()))) {
    return {
      status: 'NOT_APPLICABLE',
      notes: 'Permanent identity or academic credential without annual renewal requirement.',
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
    return {
      status: 'VALID',
      notes: `Valid until ${validTillDate} (${diffDays} days remaining).`,
    };
  }

  const issued = parseIsoDate(issueDate);
  const annualRenewalRequired = /income|obc-ncl|obc|ews/i.test(docType);
  if (annualRenewalRequired) {
    if (!issued) {
      return {
        status: 'UNKNOWN',
        notes: 'Issue date missing; annual validity (1-year cap) could not be verified.',
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
      notes: `Issued ${ageDays} days ago (${issueDate}); within 1-year validity window.`,
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

export function buildTtsBriefingScript(audit: ComplianceAuditResult): string {
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
    topDiscrepancy,
    firstAction,
  ].join(' ');
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
    <text x="144" y="308" font-family="sans-serif" font-size="11" fill="#64748b">Aadhaar Sample Document for Compliance Demo</text>
  </svg>`;

  const marksheetSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="350" viewBox="0 0 560 350">
    <rect width="560" height="350" fill="#fffbeb" stroke="#d97706" stroke-width="2"/>
    <rect x="12" y="12" width="536" height="326" fill="none" stroke="#b45309" stroke-width="1"/>
    <text x="280" y="50" text-anchor="middle" font-family="serif" font-size="18" font-weight="bold" fill="#78350f">CENTRAL BOARD OF SECONDARY EDUCATION</text>
    <text x="280" y="72" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="bold" fill="#92400e">MARKS STATEMENT · SECONDARY SCHOOL EXAMINATION (CLASS X)</text>
    <text x="32" y="114" font-family="sans-serif" font-size="13" fill="#1e293b">Candidate Name: AARAV KUMAR SHARMA</text>
    <text x="32" y="138" font-family="sans-serif" font-size="13" fill="#1e293b">Father's Name: RAJESH KUMAR SHARMA</text>
    <text x="32" y="162" font-family="sans-serif" font-size="13" fill="#1e293b">Date of Birth: 14/08/2003</text>
    <text x="32" y="186" font-family="sans-serif" font-size="13" fill="#1e293b">Roll No: 1245890 · Issue Date: 2019-05-06</text>
    <rect x="32" y="210" width="496" height="72" fill="#fef3c7" stroke="#f59e0b"/>
    <text x="48" y="236" font-family="monospace" font-size="12" fill="#451a03">ENG: 91 | HIN: 88 | MAT: 95 | SCI: 92 | SOC: 89</text>
    <text x="48" y="262" font-family="sans-serif" font-size="12" font-weight="bold" fill="#451a03">RESULT: PASS · Official Board Seal &amp; Controller Signature Verified</text>
    <circle cx="475" cy="296" r="24" fill="none" stroke="#1d4ed8" stroke-width="1.5"/>
    <text x="475" y="300" text-anchor="middle" font-family="sans-serif" font-size="9" font-weight="bold" fill="#1d4ed8">SEAL</text>
  </svg>`;

  const incomeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="350" viewBox="0 0 560 350">
    <rect width="560" height="350" fill="#f8fafc" stroke="#64748b" stroke-width="2"/>
    <text x="280" y="48" text-anchor="middle" font-family="serif" font-size="17" font-weight="bold" fill="#0f172a">OFFICE OF THE TEHSILDAR · REVENUE DEPARTMENT</text>
    <text x="280" y="70" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="bold" fill="#334155">ANNUAL FAMILY INCOME CERTIFICATE</text>
    <text x="32" y="108" font-family="monospace" font-size="12" fill="#475569">Cert No: DL/INC/2025/0048192</text>
    <text x="32" y="136" font-family="sans-serif" font-size="13" fill="#0f172a">Certified that Aarav Kumar Sharma S/o Rajesh Kr. Sharma</text>
    <text x="32" y="160" font-family="sans-serif" font-size="13" fill="#0f172a">Residing at H.No. 42 Sec-14 Rohini New Delhi 110085</text>
    <text x="32" y="184" font-family="sans-serif" font-size="13" fill="#0f172a">Annual Family Income: INR 4,20,000</text>
    <text x="32" y="218" font-family="monospace" font-size="13" font-weight="bold" fill="#b91c1c">Issue Date: 2025-04-10 · Valid Till: 2026-04-09</text>
    <text x="32" y="264" font-family="sans-serif" font-size="12" fill="#475569">Note: Digital Signature Missing / Unverified Seal Impression</text>
  </svg>`;

  const aadhaarBase64 = svgToBase64(aadhaarSvg);
  const marksheetBase64 = svgToBase64(marksheetSvg);
  const incomeBase64 = svgToBase64(incomeSvg);

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
      name: 'income_certificate_2025.svg',
      mimeType: 'image/svg+xml',
      sizeBytes: incomeSvg.length,
      base64Data: incomeBase64,
      previewUrl: `data:image/svg+xml;base64,${incomeBase64}`,
    },
  ];

  const auditResult: ComplianceAuditResult = {
    targetScheme: 'UPSC Civil Services Examination (CSE)',
    auditDate: '2026-11-15',
    readinessScore: 20,
    readinessTier: 'High Rejection Risk',
    executiveVerdict:
      'Submission carries high automated rejection risk due to an expired Income Certificate (220 days past valid-till date) and a candidate/parent name abbreviation mismatch ("Kr." vs "Kumar") between Aadhaar and Class X Marksheet.',
    criticalBlockersCount: 2,
    minorWarningsCount: 2,
    deductions: [
      {
        reason: 'Income Certificate expired on 2026-04-09 (audit date 2026-11-15)',
        points: 30,
        severity: 'CRITICAL',
      },
      {
        reason: 'Candidate Full Name mismatch ("Aarav Kr. Sharma" on Aadhaar vs "Aarav Kumar Sharma" on Class X Marksheet)',
        points: 30,
        severity: 'CRITICAL',
      },
      {
        reason: 'Missing Tehsildar official stamp / verified digital signature on Income Certificate',
        points: 10,
        severity: 'WARNING',
      },
      {
        reason: 'Address phrasing difference & parent abbreviation ("Rajesh Kr. Sharma" vs "Rajesh Kumar Sharma")',
        points: 10,
        severity: 'WARNING',
      },
    ],
    documents: [
      {
        documentIndex: 1,
        fileName: 'aadhaar_front_specimen.svg',
        documentType: 'Aadhaar Card',
        scanClarity: 'CLEAR',
        clarityNotes: 'Text, photo, and 12-digit UID are sharp with zero glare or edge clipping.',
        validityStatus: 'NOT_APPLICABLE',
        validityNotes: 'Permanent national identity card; no annual expiry.',
        extractedFields: {
          fullName: 'Aarav Kr. Sharma',
          parentName: 'Rajesh Kumar Sharma',
          dateOfBirth: '2003-08-14',
          gender: 'Male',
          address: '42, Sector 14, Rohini, New Delhi - 110085',
          idOrCertificateNumber: 'XXXX-XXXX-9184',
          issueDate: null,
          validTillDate: null,
          officialStampOrSignaturePresent: true,
        },
        documentWarnings: [
          'Name uses abbreviated middle name "Kr." instead of "Kumar" shown on Class X Marksheet.',
        ],
        documentBlockers: [
          'Name abbreviation "Kr." conflicts with Class X Marksheet ("Aarav Kumar Sharma").',
        ],
      },
      {
        documentIndex: 2,
        fileName: 'class_x_cbse_marksheet.svg',
        documentType: 'Class X Marksheet',
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
          idOrCertificateNumber: '1245890',
          issueDate: '2019-05-06',
          validTillDate: null,
          officialStampOrSignaturePresent: true,
        },
        documentWarnings: [],
        documentBlockers: [],
      },
      {
        documentIndex: 3,
        fileName: 'income_certificate_2025.svg',
        documentType: 'Income Certificate',
        scanClarity: 'CLEAR',
        clarityNotes: 'All certificate lines legible, though digital signature block is unverified.',
        validityStatus: 'EXPIRED',
        validityNotes: 'Expired 220 days ago (Valid-Till: 2026-04-09) relative to 2026-11-15.',
        extractedFields: {
          fullName: 'Aarav Kumar Sharma',
          parentName: 'Rajesh Kr. Sharma',
          dateOfBirth: null,
          gender: null,
          address: 'H.No. 42 Sec-14 Rohini New Delhi 110085',
          idOrCertificateNumber: 'DL/INC/2025/0048192',
          issueDate: '2025-04-10',
          validTillDate: '2026-04-09',
          officialStampOrSignaturePresent: false,
        },
        documentWarnings: [
          'Official Revenue Department stamp or digital signature validation block is absent.',
          'Father name uses "Kr." abbreviation and address punctuation differs from Aadhaar.',
        ],
        documentBlockers: [
          'Certificate expired on 2026-04-09 and fails the 1-year validity requirement.',
        ],
      },
    ],
    discrepancies: [
      {
        id: 'disc-expiry-income',
        field: 'Certificate Validity',
        severity: 'CRITICAL',
        summary: 'Income Certificate expired on 2026-04-09 (220 days past expiry)',
        documentComparison: [
          {
            documentIndex: 3,
            documentType: 'Income Certificate',
            observedValue: 'Issued 2025-04-10 · Valid Till 2026-04-09 (EXPIRED)',
          },
        ],
        remediationStep:
          'Obtain a freshly issued Income Certificate for FY 2026–27 from the local Tehsildar/e-District portal bearing a valid QR/digital signature.',
      },
      {
        id: 'disc-name-candidate',
        field: 'Full Name',
        severity: 'CRITICAL',
        summary: 'Candidate name spelling differs: "Aarav Kr. Sharma" vs "Aarav Kumar Sharma"',
        documentComparison: [
          {
            documentIndex: 1,
            documentType: 'Aadhaar Card',
            observedValue: 'Aarav Kr. Sharma',
          },
          {
            documentIndex: 2,
            documentType: 'Class X Marksheet',
            observedValue: 'AARAV KUMAR SHARMA',
          },
          {
            documentIndex: 3,
            documentType: 'Income Certificate',
            observedValue: 'Aarav Kumar Sharma',
          },
        ],
        remediationStep:
          'Update Aadhaar demographic name via UIDAI/Aadhaar Seva Kendra using your Class X Marksheet as Proof of Identity so all records read "Aarav Kumar Sharma".',
      },
      {
        id: 'disc-stamp-income',
        field: 'Official Stamp & Signature',
        severity: 'WARNING',
        summary: 'Income Certificate lacks a verified Revenue Officer stamp or digital signature block',
        documentComparison: [
          {
            documentIndex: 3,
            documentType: 'Income Certificate',
            observedValue: 'Missing / Unverified Signature',
          },
        ],
        remediationStep:
          'Download the digitally signed PDF directly from the state e-District portal rather than scanning an unsigned draft.',
      },
      {
        id: 'disc-parent-address',
        field: 'Parent Name & Address Formatting',
        severity: 'WARNING',
        summary: 'Father name ("Rajesh Kr. Sharma" vs "Rajesh Kumar Sharma") and address punctuation differ',
        documentComparison: [
          {
            documentIndex: 1,
            documentType: 'Aadhaar Card',
            observedValue: 'Rajesh Kumar Sharma · 42, Sector 14, Rohini, New Delhi - 110085',
          },
          {
            documentIndex: 3,
            documentType: 'Income Certificate',
            observedValue: 'Rajesh Kr. Sharma · H.No. 42 Sec-14 Rohini New Delhi 110085',
          },
        ],
        remediationStep:
          'Ensure the new Income Certificate expands "Rajesh Kr. Sharma" to "Rajesh Kumar Sharma" to align with Class X records.',
      },
    ],
    recommendedNextActions: [
      'Apply for a renewed FY 2026–27 Income Certificate via the e-District portal with full parent name "Rajesh Kumar Sharma" and verified digital signature.',
      'Submit a demographic name correction on Aadhaar so "Aarav Kr. Sharma" matches "Aarav Kumar Sharma" on the Class X Marksheet.',
      'Re-run DastavezGuard AI audit once updated documents are uploaded before submitting on the UPSC portal.',
    ],
  };

  return {
    targetScheme: 'UPSC Civil Services Examination (CSE)',
    todayDate: '2026-11-15',
    files,
    auditResult,
  };
}
