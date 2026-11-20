import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type, type Content, type Part } from '@google/genai';
import {
  calculateReadinessScore,
  checkCertificateValidity,
  evaluateIncomeThresholds,
  evaluateSchemeChecklist,
  extractIndianPinCode,
  maskAadhaarNumber,
  maskBankAccountNumber,
  validateIfscCode,
} from './src/utils/compliance.ts';
import type {
  AuditedDocument,
  ChatModelId,
  ComplianceAuditResult,
  ScoreDeduction,
} from './src/types/audit.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isTransientGeminiError(err: unknown): boolean {
  const rawMessage = err instanceof Error ? err.message : String(err);
  return /503|UNAVAILABLE|429|RESOURCE_EXHAUSTED|ECONNRESET|ETIMEDOUT/i.test(rawMessage);
}

async function callWithRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isTransientGeminiError(err) || attempt === maxAttempts) {
        throw err;
      }
      const delayMs = 600 * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const rawMessage = err instanceof Error ? err.message : String(err);
  if (/503|UNAVAILABLE/i.test(rawMessage)) {
    return {
      status: 503,
      message:
        'Gemini model is experiencing a brief high-demand spike. Please retry in a few seconds.',
    };
  }
  if (/403|PERMISSION_DENIED/i.test(rawMessage)) {
    return {
      status: 403,
      message:
        'Gemini API permission denied. Please verify your API key or select a billing-enabled key in Settings > Secrets if using a paid model tier.',
    };
  }
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(rawMessage)) {
    return {
      status: 429,
      message:
        'Gemini API quota reached or paid tier required for this model. Try switching to gemini-4-hydrogen or gemini-3.1-flash-lite, or update your key in Settings > Secrets.',
    };
  }
  if (/400|API_KEY_INVALID/i.test(rawMessage)) {
    return {
      status: 400,
      message:
        'Invalid Gemini API key or request format. Please check GEMINI_API_KEY in Settings > Secrets.',
    };
  }
  if (/404|NOT_FOUND/i.test(rawMessage)) {
    return {
      status: 404,
      message: `Requested Gemini model was not found or is unavailable: ${rawMessage}`,
    };
  }
  return {
    status: 500,
    message: rawMessage || 'Unexpected server error while calling Gemini API.',
  };
}

const AUDIT_SYSTEM_INSTRUCTION = `You are DastavezGuard AI, a strict Indian Government, Financial, and Academic Document Pre-Submission Forensic Compliance Auditor.
You will receive 1 to 6 uploaded documents (images or PDFs) along with a Target Scheme Name and Today's Date.

Your job is to:
1. Auto-detect and classify every uploaded document accurately into one of these supported types:
   - Identity & Citizen IDs: "Aadhaar Card", "PAN Card", "APAAR / ABC ID", "Voter ID (EPIC)", "Driving Licence", "Passport".
   - Academic Records: "Class X Marksheet/Certificate", "Class XII Marksheet/Certificate", "College Semester Marksheet", "Bonafide Student Certificate", "Current Year Fee Receipt", "Transfer/Migration Certificate".
   - Welfare & Category Certificates: "Family Income Certificate", "Caste / Category Certificate (SC/ST/OBC-NCL/EWS)", "Domicile / Residence Certificate", "Disability (UDID) Certificate".
   - Banking & Uploads: "Bank Passbook Front Page / Cancelled Cheque", "Passport-Size Photograph", "Scanned Signature".
   - Fallback: "Unidentified".
2. Extract Core Identity Fields from every document:
   - fullName, parentName (Father's/Mother's Name), dateOfBirth (normalized to YYYY-MM-DD), gender, address (full postal address), pinCode (6-digit Indian PIN code), idOrCertificateNumber (mask first 8 digits of any 12-digit Aadhaar as XXXX-XXXX-last4), issueDate (YYYY-MM-DD), validTillDate (YYYY-MM-DD), and officialStampOrSignaturePresent.
3. Extract Document-Specific Deep Metadata ("deepMetadata"):
   - Marksheets: boardOrUniversityName, rollNumber, passingYear, aggregatePercentageOrCgpa.
   - Income / Caste / Domicile / Disability Certificates: certificateOrApplicationNumber, issuingAuthority (e.g. Tehsildar/SDM), financialYear, annualIncomeAmountInr (numeric INR amount if Income/EWS/NCL cert), incomeThresholdAlert (flag if annual income exceeds ₹2,50,000 scholarship limit or ₹8,00,000 OBC-NCL threshold).
   - Bank Passbook / Cancelled Cheque: accountHolderName, maskedAccountNumber (last 4 digits only, e.g. XXXXXX1234), ifscCode (11-character alphanumeric), ifscValidFormat, bankAndBranchName.
   - Passport-Size Photograph / Scanned Signature: backgroundCheck (plain light background vs cluttered), faceVisibility, signatureInkClarity.
   Leave fields null when not applicable to that document type.
4. Inspect Authenticity & Tamper Signals ("forensicSignals"):
   - officialSealOrStampPresent, authorizedSignaturePresent, qrOrDigitalVerificationPresent (DigiLocker / e-District QR code), tamperOrLayoutAnomalies (font/alignment inconsistencies, pasted overlays, cropped borders, glare/blur), and confidenceScore (0-100).
5. Cross-compare all extracted fields across all uploaded documents (Full Name, Father's/Mother's Name, Date of Birth, Gender, Address/PIN Code, and Bank Account Holder Name) to detect even minor spelling differences (e.g. "Kr." vs "Kumar"), missing middle names, PIN code mismatches, or DOB conflicts.
6. Enforce Date & Indian Financial Year Policy Math against Today's Date:
   - Any Family Income Certificate or OBC-NCL / EWS Certificate issued BEFORE April 1 of the current Financial Year (for 2026-27 schemes, issued before 2026-04-01) or past its Valid-Till date MUST be marked "EXPIRED".
7. Assess visual scan quality (CLEAR, MINOR_GLARE, SLIGHTLY_CROPPED, BLURRY, UNREADABLE). Never guess unreadable text (leave unreadable fields null).
8. Calculate an honest Readiness Score (0-100): start at 100, deduct 30 for each critical blocker (name/DOB mismatch, expired/prior-FY certificate, unreadable scan, missing mandatory scheme document, invalid IFSC), and deduct 10 for minor warnings (missing stamp/QR, address phrasing difference, minor glare/crop, income threshold warning).

Return ONLY valid JSON matching the provided schema.`;

const AUDIT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    targetScheme: { type: Type.STRING },
    auditDate: { type: Type.STRING },
    readinessScore: { type: Type.INTEGER },
    readinessTier: {
      type: Type.STRING,
      enum: ['Ready to Submit', 'Needs Attention', 'High Rejection Risk'],
    },
    executiveVerdict: { type: Type.STRING },
    criticalBlockersCount: { type: Type.INTEGER },
    minorWarningsCount: { type: Type.INTEGER },
    deductions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          reason: { type: Type.STRING },
          points: { type: Type.INTEGER },
          severity: { type: Type.STRING, enum: ['CRITICAL', 'WARNING'] },
        },
        required: ['reason', 'points', 'severity'],
      },
    },
    documents: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          documentIndex: { type: Type.INTEGER },
          fileName: { type: Type.STRING },
          documentType: { type: Type.STRING },
          scanClarity: {
            type: Type.STRING,
            enum: ['CLEAR', 'MINOR_GLARE', 'SLIGHTLY_CROPPED', 'BLURRY', 'UNREADABLE'],
          },
          clarityNotes: { type: Type.STRING },
          validityStatus: {
            type: Type.STRING,
            enum: ['VALID', 'EXPIRING_SOON', 'EXPIRED', 'NOT_APPLICABLE', 'UNKNOWN'],
          },
          validityNotes: { type: Type.STRING },
          extractedFields: {
            type: Type.OBJECT,
            properties: {
              fullName: { type: Type.STRING, nullable: true },
              parentName: { type: Type.STRING, nullable: true },
              dateOfBirth: { type: Type.STRING, nullable: true },
              gender: { type: Type.STRING, nullable: true },
              address: { type: Type.STRING, nullable: true },
              pinCode: { type: Type.STRING, nullable: true },
              idOrCertificateNumber: { type: Type.STRING, nullable: true },
              issueDate: { type: Type.STRING, nullable: true },
              validTillDate: { type: Type.STRING, nullable: true },
              officialStampOrSignaturePresent: { type: Type.BOOLEAN, nullable: true },
            },
            required: [
              'fullName',
              'parentName',
              'dateOfBirth',
              'gender',
              'address',
              'pinCode',
              'idOrCertificateNumber',
              'issueDate',
              'validTillDate',
              'officialStampOrSignaturePresent',
            ],
          },
          deepMetadata: {
            type: Type.OBJECT,
            properties: {
              boardOrUniversityName: { type: Type.STRING, nullable: true },
              rollNumber: { type: Type.STRING, nullable: true },
              passingYear: { type: Type.STRING, nullable: true },
              aggregatePercentageOrCgpa: { type: Type.STRING, nullable: true },
              certificateOrApplicationNumber: { type: Type.STRING, nullable: true },
              issuingAuthority: { type: Type.STRING, nullable: true },
              financialYear: { type: Type.STRING, nullable: true },
              annualIncomeAmountInr: { type: Type.NUMBER, nullable: true },
              incomeThresholdAlert: { type: Type.STRING, nullable: true },
              accountHolderName: { type: Type.STRING, nullable: true },
              maskedAccountNumber: { type: Type.STRING, nullable: true },
              ifscCode: { type: Type.STRING, nullable: true },
              ifscValidFormat: { type: Type.BOOLEAN, nullable: true },
              bankAndBranchName: { type: Type.STRING, nullable: true },
              backgroundCheck: { type: Type.STRING, nullable: true },
              faceVisibility: { type: Type.STRING, nullable: true },
              signatureInkClarity: { type: Type.STRING, nullable: true },
            },
            required: [
              'boardOrUniversityName',
              'rollNumber',
              'passingYear',
              'aggregatePercentageOrCgpa',
              'certificateOrApplicationNumber',
              'issuingAuthority',
              'financialYear',
              'annualIncomeAmountInr',
              'incomeThresholdAlert',
              'accountHolderName',
              'maskedAccountNumber',
              'ifscCode',
              'ifscValidFormat',
              'bankAndBranchName',
              'backgroundCheck',
              'faceVisibility',
              'signatureInkClarity',
            ],
          },
          forensicSignals: {
            type: Type.OBJECT,
            properties: {
              officialSealOrStampPresent: { type: Type.BOOLEAN, nullable: true },
              authorizedSignaturePresent: { type: Type.BOOLEAN, nullable: true },
              qrOrDigitalVerificationPresent: { type: Type.BOOLEAN, nullable: true },
              tamperOrLayoutAnomalies: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              confidenceScore: { type: Type.INTEGER },
            },
            required: [
              'officialSealOrStampPresent',
              'authorizedSignaturePresent',
              'qrOrDigitalVerificationPresent',
              'tamperOrLayoutAnomalies',
              'confidenceScore',
            ],
          },
          documentWarnings: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          documentBlockers: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: [
          'documentIndex',
          'fileName',
          'documentType',
          'scanClarity',
          'clarityNotes',
          'validityStatus',
          'validityNotes',
          'extractedFields',
          'deepMetadata',
          'forensicSignals',
          'documentWarnings',
          'documentBlockers',
        ],
      },
    },
    discrepancies: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          field: { type: Type.STRING },
          severity: { type: Type.STRING, enum: ['CRITICAL', 'WARNING'] },
          summary: { type: Type.STRING },
          documentComparison: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                documentIndex: { type: Type.INTEGER },
                documentType: { type: Type.STRING },
                observedValue: { type: Type.STRING },
              },
              required: ['documentIndex', 'documentType', 'observedValue'],
            },
          },
          remediationStep: { type: Type.STRING },
        },
        required: ['id', 'field', 'severity', 'summary', 'documentComparison', 'remediationStep'],
      },
    },
    recommendedNextActions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: [
    'targetScheme',
    'auditDate',
    'readinessScore',
    'readinessTier',
    'executiveVerdict',
    'criticalBlockersCount',
    'minorWarningsCount',
    'deductions',
    'documents',
    'discrepancies',
    'recommendedNextActions',
  ],
};

interface AuditDocumentPayload {
  name: string;
  mimeType: string;
  base64Data: string;
}

function normalizeAuditOutput(
  parsed: ComplianceAuditResult,
  targetScheme: string,
  todayDate: string,
  uploadedDocs: AuditDocumentPayload[],
): ComplianceAuditResult {
  const normalizedDocs: AuditedDocument[] = (parsed.documents ?? []).map((doc, idx) => {
    const fallbackName = uploadedDocs[idx]?.name ?? `Document ${idx + 1}`;
    const docType = doc.documentType ?? 'Unidentified';
    const isBankDoc = /bank passbook|cancelled cheque|passbook|cheque/i.test(docType);

    const maskedId = isBankDoc
      ? maskBankAccountNumber(doc.extractedFields?.idOrCertificateNumber ?? doc.deepMetadata?.maskedAccountNumber ?? null)
      : maskAadhaarNumber(doc.extractedFields?.idOrCertificateNumber ?? null, docType);

    const pinCode = extractIndianPinCode(
      doc.extractedFields?.address,
      doc.extractedFields?.pinCode,
    );

    const maskedBankAccount = maskBankAccountNumber(
      doc.deepMetadata?.maskedAccountNumber ?? (isBankDoc ? doc.extractedFields?.idOrCertificateNumber : null),
    );
    const ifscCheck = validateIfscCode(doc.deepMetadata?.ifscCode);
    const deterministicIncomeAlert = evaluateIncomeThresholds(
      docType,
      doc.deepMetadata?.annualIncomeAmountInr,
    );

    const deterministicValidity = checkCertificateValidity(
      docType,
      doc.extractedFields?.issueDate ?? null,
      doc.extractedFields?.validTillDate ?? null,
      todayDate,
      targetScheme,
    );

    const validityStatus =
      deterministicValidity.status !== 'UNKNOWN'
        ? deterministicValidity.status
        : doc.validityStatus;

    const validityNotes =
      deterministicValidity.status !== 'UNKNOWN'
        ? deterministicValidity.notes
        : doc.validityNotes;

    const warnings = [...(doc.documentWarnings ?? [])];
    const blockers = [...(doc.documentBlockers ?? [])];

    if (
      deterministicIncomeAlert &&
      !warnings.some((w) => w.includes('2.5L') || w.includes('8.0L'))
    ) {
      warnings.push(deterministicIncomeAlert);
    }

    if (ifscCheck.normalized && ifscCheck.isValid === false) {
      const ifscErr = `IFSC code "${ifscCheck.normalized}" fails 11-character Indian banking format (AAAA0XXXXXX).`;
      if (!blockers.some((b) => b.toLowerCase().includes('ifsc'))) {
        blockers.push(ifscErr);
      }
    }

    if (
      validityStatus === 'EXPIRED' &&
      !blockers.some((b) => /expired|prior fy|april 1|renewal/i.test(b))
    ) {
      blockers.push(validityNotes);
    }

    const rawConfidence = doc.forensicSignals?.confidenceScore;
    const confidenceScore =
      typeof rawConfidence === 'number' && !Number.isNaN(rawConfidence)
        ? Math.max(0, Math.min(100, Math.round(rawConfidence)))
        : doc.scanClarity === 'UNREADABLE'
          ? 25
          : doc.scanClarity === 'CLEAR'
            ? 92
            : 75;

    return {
      ...doc,
      documentIndex: doc.documentIndex || idx + 1,
      fileName: doc.fileName || fallbackName,
      documentType: docType,
      validityStatus,
      validityNotes,
      extractedFields: {
        ...doc.extractedFields,
        pinCode,
        idOrCertificateNumber: maskedId,
      },
      deepMetadata: {
        boardOrUniversityName: doc.deepMetadata?.boardOrUniversityName ?? null,
        rollNumber: doc.deepMetadata?.rollNumber ?? null,
        passingYear: doc.deepMetadata?.passingYear ?? null,
        aggregatePercentageOrCgpa: doc.deepMetadata?.aggregatePercentageOrCgpa ?? null,
        certificateOrApplicationNumber: doc.deepMetadata?.certificateOrApplicationNumber ?? null,
        issuingAuthority: doc.deepMetadata?.issuingAuthority ?? null,
        financialYear: doc.deepMetadata?.financialYear ?? null,
        annualIncomeAmountInr: doc.deepMetadata?.annualIncomeAmountInr ?? null,
        incomeThresholdAlert:
          deterministicIncomeAlert ?? doc.deepMetadata?.incomeThresholdAlert ?? null,
        accountHolderName: doc.deepMetadata?.accountHolderName ?? null,
        maskedAccountNumber: maskedBankAccount,
        ifscCode: ifscCheck.normalized,
        ifscValidFormat: ifscCheck.isValid,
        bankAndBranchName: doc.deepMetadata?.bankAndBranchName ?? null,
        backgroundCheck: doc.deepMetadata?.backgroundCheck ?? null,
        faceVisibility: doc.deepMetadata?.faceVisibility ?? null,
        signatureInkClarity: doc.deepMetadata?.signatureInkClarity ?? null,
      },
      forensicSignals: {
        officialSealOrStampPresent:
          doc.forensicSignals?.officialSealOrStampPresent ??
          doc.extractedFields?.officialStampOrSignaturePresent ??
          null,
        authorizedSignaturePresent:
          doc.forensicSignals?.authorizedSignaturePresent ??
          doc.extractedFields?.officialStampOrSignaturePresent ??
          null,
        qrOrDigitalVerificationPresent:
          doc.forensicSignals?.qrOrDigitalVerificationPresent ?? null,
        tamperOrLayoutAnomalies: Array.isArray(doc.forensicSignals?.tamperOrLayoutAnomalies)
          ? doc.forensicSignals.tamperOrLayoutAnomalies
          : [],
        confidenceScore,
      },
      documentWarnings: warnings,
      documentBlockers: blockers,
    };
  });

  const missingMandatoryDocuments = evaluateSchemeChecklist(targetScheme, normalizedDocs);

  const deductions: ScoreDeduction[] = Array.isArray(parsed.deductions)
    ? parsed.deductions.map((d) => ({
        reason: d.reason,
        severity: d.severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
        points: d.severity === 'CRITICAL' ? 30 : 10,
      }))
    : [];

  for (const missing of missingMandatoryDocuments) {
    const alreadyCovered = deductions.some(
      (d) =>
        d.reason.toLowerCase().includes('missing') &&
        d.reason.toLowerCase().includes(missing.label.split(' ')[0].toLowerCase()),
    );
    if (!alreadyCovered) {
      deductions.unshift({
        reason: `Missing mandatory ${targetScheme} document: ${missing.label}`,
        severity: 'CRITICAL',
        points: 30,
      });
    }
  }

  for (const doc of normalizedDocs) {
    if (
      doc.validityStatus === 'EXPIRED' &&
      !deductions.some(
        (d) =>
          d.severity === 'CRITICAL' &&
          /expired|prior fy|april 1|renewal/i.test(d.reason) &&
          d.reason.toLowerCase().includes(doc.documentType.split(' ')[0].toLowerCase()),
      )
    ) {
      deductions.push({
        reason: `${doc.documentType}: ${doc.validityNotes}`,
        severity: 'CRITICAL',
        points: 30,
      });
    }
  }

  const criticalCount =
    deductions.length > 0
      ? deductions.filter((d) => d.severity === 'CRITICAL').length
      : Math.max(0, parsed.criticalBlockersCount ?? 0);

  const warningCount =
    deductions.length > 0
      ? deductions.filter((d) => d.severity === 'WARNING').length
      : Math.max(0, parsed.minorWarningsCount ?? 0);

  const { score, tier } = calculateReadinessScore(criticalCount, warningCount);

  return {
    ...parsed,
    targetScheme,
    auditDate: todayDate,
    readinessScore: score,
    readinessTier: tier,
    criticalBlockersCount: criticalCount,
    minorWarningsCount: warningCount,
    missingMandatoryDocuments,
    deductions,
    documents: normalizedDocs,
  };
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.post('/api/audit', async (req: Request, res: Response) => {
    try {
      const { documents, targetScheme, todayDate } = req.body as {
        documents?: AuditDocumentPayload[];
        targetScheme?: string;
        todayDate?: string;
      };

      if (!Array.isArray(documents) || documents.length < 1 || documents.length > 6) {
        res.status(400).json({
          error: 'Please upload between 1 and 6 documents (images or PDFs) to run an audit.',
        });
        return;
      }

      if (!targetScheme || !targetScheme.trim()) {
        res.status(400).json({ error: 'Target Scheme Name is required.' });
        return;
      }

      const effectiveDate =
        todayDate && /^\d{4}-\d{2}-\d{2}$/.test(todayDate)
          ? todayDate
          : new Date().toISOString().slice(0, 10);

      const ai = getAiClient();
      const parts: Part[] = [
        {
          text: `Target Scheme Name: ${targetScheme.trim()}\nToday's Date: ${effectiveDate}\nTotal Uploaded Documents: ${documents.length}\nPerform deep forensic document classification, extract all core identity + document-specific deep metadata + forensic authenticity signals, cross-compare all fields across every file, enforce financial-year validity against Today's Date (Income & OBC-NCL/EWS certificates issued before April 1 of the current financial year are EXPIRED/NEEDS RENEWAL), mask Aadhaar first 8 digits & bank account numbers except last 4 digits, validate 11-char IFSC codes, and return ONLY JSON matching the schema.`,
        },
      ];

      documents.forEach((doc, index) => {
        parts.push({
          text: `--- Document #${index + 1}: ${doc.name} (${doc.mimeType}) ---`,
        });
        if (doc.mimeType === 'image/svg+xml') {
          const decodedSvg = Buffer.from(doc.base64Data, 'base64').toString('utf-8');
          parts.push({
            text: `SVG Document Markup for Document #${index + 1}:\n${decodedSvg}`,
          });
        } else {
          parts.push({
            inlineData: {
              mimeType: doc.mimeType,
              data: doc.base64Data,
            },
          });
        }
      });

      const response = await callWithRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: { parts },
          config: {
            systemInstruction: AUDIT_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: AUDIT_RESPONSE_SCHEMA,
            thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          },
        }),
      );

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        throw new Error('Gemini returned an empty audit payload.');
      }

      const parsed = JSON.parse(rawText) as ComplianceAuditResult;
      const normalized = normalizeAuditOutput(parsed, targetScheme.trim(), effectiveDate, documents);
      res.json(normalized);
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/tts', async (req: Request, res: Response) => {
    try {
      const { text, style, voiceName } = req.body as {
        text?: string;
        style?: string;
        voiceName?: string;
      };

      if (!text || !text.trim()) {
        res.status(400).json({ error: 'Text is required for speech synthesis.' });
        return;
      }

      const ai = getAiClient();
      const response = await callWithRetry(() =>
        ai.models.generateContent({
          model: 'gemini-3.8-flash-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: text.trim(),
                  speechMetadata: {
                    style:
                      style ||
                      'Clear, measured, authoritative Indian government compliance officer briefing',
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voiceName || 'Kore',
                },
              },
            },
          },
        }),
      );

      const audioBase64 =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ?? null;

      if (!audioBase64) {
        throw new Error('TTS model did not return audio data.');
      }

      res.json({
        audioBase64,
        mimeType: 'audio/wav',
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/chat', async (req: Request, res: Response) => {
    try {
      const { message, history, model, auditContext } = req.body as {
        message?: string;
        history?: Array<{ role: 'user' | 'model'; text: string }>;
        model?: ChatModelId;
        auditContext?: ComplianceAuditResult | null;
      };

      if (!message || !message.trim()) {
        res.status(400).json({ error: 'Chat message cannot be empty.' });
        return;
      }

      const allowedModels: ChatModelId[] = [
        'gemini-4-hydrogen',
        'gemini-3.1-flash-lite',
        'gemini-4-argon',
        'gemini-4-carbon',
      ];
      const selectedModel: ChatModelId =
        model && allowedModels.includes(model) ? model : 'gemini-4-hydrogen';

      const contextSummary = auditContext
        ? `\n\nActive Compliance Audit Context:\n${JSON.stringify(
            {
              targetScheme: auditContext.targetScheme,
              auditDate: auditContext.auditDate,
              readinessScore: auditContext.readinessScore,
              readinessTier: auditContext.readinessTier,
              executiveVerdict: auditContext.executiveVerdict,
              discrepancies: auditContext.discrepancies,
              documents: auditContext.documents.map((d) => ({
                index: d.documentIndex,
                type: d.documentType,
                clarity: d.scanClarity,
                validity: d.validityStatus,
                validityNotes: d.validityNotes,
                extractedFields: d.extractedFields,
              })),
            },
            null,
            2,
          )}`
        : '\n\nNo active document audit report has been loaded yet.';

      const systemInstruction = `You are the DastavezGuard Compliance Advisor, a specialist in Indian Government & Academic document verification rules (UPSC, JoSAA, SSC, NSP, UIDAI Aadhaar corrections, Tehsildar/e-District Income, Caste, OBC-NCL, and EWS certificates, gazette notifications, and name-mismatch affidavits).
Provide clear, practical, step-by-step remediation guidance grounded in the user's active compliance audit whenever available. Be concise, accurate, and never fabricate certificate numbers or legal clauses.${contextSummary}`;

      const formattedHistory: Content[] = (history ?? [])
        .filter((item) => item.text && item.text.trim())
        .map((item) => ({
          role: item.role,
          parts: [{ text: item.text }],
        }));

      const ai = getAiClient();
      const chat = ai.chats.create({
        model: selectedModel,
        history: formattedHistory,
        config: {
          systemInstruction,
        },
      });

      const response = await callWithRetry(() =>
        chat.sendMessage({
          message: message.trim(),
        }),
      );

      res.json({
        reply: response.text ?? 'I could not generate a response. Please try again.',
        modelUsed: selectedModel,
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DastavezGuard AI server listening on http://localhost:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
