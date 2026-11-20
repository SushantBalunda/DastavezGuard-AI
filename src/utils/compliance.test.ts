import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAuditReportExportText,
  buildComplianceMailtoUrl,
  buildFieldComparisonRows,
  calculateReadinessScore,
  checkCertificateValidity,
  comparePersonNames,
  evaluateIncomeThresholds,
  evaluateSchemeChecklist,
  getAuditWorkflowStage,
  getSampleAuditCase,
  maskAadhaarNumber,
  maskBankAccountNumber,
  matchUploadedFileForDocument,
  validateIfscCode,
} from './compliance';
import type { UploadedDocFile } from '../types/audit';

test('buildComplianceMailtoUrl encodes score, scheme, and discrepancies into mailto URL', () => {
  const sample = getSampleAuditCase().auditResult;
  const mailtoUrl = buildComplianceMailtoUrl(sample);
  assert.ok(mailtoUrl.startsWith('mailto:?subject='));
  assert.ok(mailtoUrl.includes('&body='));
  assert.ok(!mailtoUrl.includes('+'));
  const decoded = decodeURIComponent(mailtoUrl);
  assert.ok(decoded.includes('0 / 100'));
  assert.ok(decoded.includes('High Rejection Risk'));
  assert.ok(decoded.includes('National Scholarship Portal (NSP)'));
  assert.ok(decoded.includes('Bonafide Student Certificate'));
});

test('matchUploadedFileForDocument correlates uploaded files by index and filename', () => {
  const files: UploadedDocFile[] = [
    {
      id: '1',
      name: 'aadhaar.png',
      mimeType: 'image/png',
      sizeBytes: 100,
      base64Data: 'abc',
      previewUrl: 'data:image/png;base64,abc',
    },
    {
      id: '2',
      name: 'income.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 200,
      base64Data: 'def',
      previewUrl: 'data:application/pdf;base64,def',
    },
  ];
  assert.equal(matchUploadedFileForDocument(files, 1, 'aadhaar.png')?.id, '1');
  assert.equal(matchUploadedFileForDocument(files, 1, 'income.pdf')?.id, '2');
  assert.equal(matchUploadedFileForDocument(files, 2, 'renamed.pdf')?.id, '2');
  assert.equal(matchUploadedFileForDocument([], 1, 'aadhaar.png'), null);
});

test('getAuditWorkflowStage transitions through upload, processing, and review', () => {
  assert.equal(getAuditWorkflowStage(false, false), 'upload');
  assert.equal(getAuditWorkflowStage(true, false), 'processing');
  assert.equal(getAuditWorkflowStage(true, true), 'processing');
  assert.equal(getAuditWorkflowStage(false, true), 'review');
});

test('maskAadhaarNumber and maskBankAccountNumber mask sensitive leading digits', () => {
  assert.equal(maskAadhaarNumber('4829 7310 9184', 'Aadhaar Card'), 'XXXX-XXXX-9184');
  assert.equal(maskAadhaarNumber('482973109184', 'Aadhaar Card'), 'XXXX-XXXX-9184');
  assert.equal(maskAadhaarNumber('1245890', 'Class X Marksheet/Certificate'), '1245890');
  assert.equal(maskAadhaarNumber(null, 'Aadhaar Card'), null);

  assert.equal(maskBankAccountNumber('309184777392'), 'XXXXXXXX7392');
  assert.equal(maskBankAccountNumber('1234'), '1234');
  assert.equal(maskBankAccountNumber(null), null);
});

test('validateIfscCode validates 11-character Indian IFSC format', () => {
  assert.deepEqual(validateIfscCode('sbin0004821'), {
    normalized: 'SBIN0004821',
    isValid: true,
  });
  assert.deepEqual(validateIfscCode('HDFC1234567'), {
    normalized: 'HDFC1234567',
    isValid: false,
  });
  assert.deepEqual(validateIfscCode('SBIN0048'), {
    normalized: 'SBIN0048',
    isValid: false,
  });
  assert.deepEqual(validateIfscCode(null), {
    normalized: null,
    isValid: null,
  });
});

test('evaluateIncomeThresholds flags ₹2.5L and ₹8L ceilings', () => {
  assert.equal(evaluateIncomeThresholds('Family Income Certificate', 240000), null);
  assert.ok(
    evaluateIncomeThresholds('Family Income Certificate', 285000)?.includes('₹2.5L'),
  );
  assert.ok(
    evaluateIncomeThresholds('Family Income Certificate', 850000)?.includes('₹8.0L'),
  );
  assert.equal(evaluateIncomeThresholds('Class X Marksheet/Certificate', 900000), null);
});

test('evaluateSchemeChecklist detects missing mandatory documents per scheme', () => {
  const nspMissing = evaluateSchemeChecklist('National Scholarship Portal (NSP)', [
    { documentType: 'Aadhaar Card' },
    { documentType: 'Class X Marksheet/Certificate' },
  ]);
  assert.equal(nspMissing.length, 3);
  assert.ok(nspMissing.some((m) => m.requirementKey === 'nsp-income'));
  assert.ok(nspMissing.some((m) => m.requirementKey === 'nsp-bonafide-fee'));
  assert.ok(nspMissing.some((m) => m.requirementKey === 'nsp-bank'));

  const nspComplete = evaluateSchemeChecklist('National Scholarship Portal (NSP)', [
    { documentType: 'Aadhaar Card' },
    { documentType: 'Class XII Marksheet/Certificate' },
    { documentType: 'Family Income Certificate' },
    { documentType: 'Current Year Fee Receipt' },
    { documentType: 'Bank Passbook Front Page / Cancelled Cheque' },
  ]);
  assert.equal(nspComplete.length, 0);

  const customMissing = evaluateSchemeChecklist('Custom / General Document Cross-Check', [
    { documentType: 'PAN Card' },
  ]);
  assert.equal(customMissing.length, 0);
});

test('comparePersonNames catches Kr. vs Kumar and missing middle name differences', () => {
  const abbrResult = comparePersonNames(['Aarav Kr. Sharma', 'AARAV KUMAR SHARMA']);
  assert.equal(abbrResult.status, 'MINOR_DIFFERENCE');

  const middleNameResult = comparePersonNames(['Priya Devi Verma', 'Priya Verma']);
  assert.equal(middleNameResult.status, 'MINOR_DIFFERENCE');

  const exactResult = comparePersonNames(['Rohan Verma', 'rohan  verma']);
  assert.equal(exactResult.status, 'MATCH');

  const mismatchResult = comparePersonNames(['Rohan Verma', 'Sohan Verma']);
  assert.equal(mismatchResult.status, 'MISMATCH');
});

test('checkCertificateValidity flags pre-April 1 2026 FY certificates and expired dates', () => {
  const preAprilFy = checkCertificateValidity(
    'Family Income Certificate',
    '2026-02-14',
    null,
    '2026-11-18',
  );
  assert.equal(preAprilFy.status, 'EXPIRED');
  assert.ok(preAprilFy.notes.includes('2026-04-01'));

  const pastValidTill = checkCertificateValidity(
    'Family Income Certificate',
    '2025-04-10',
    '2026-04-09',
    '2026-11-18',
  );
  assert.equal(pastValidTill.status, 'EXPIRED');

  const obcOld = checkCertificateValidity(
    'OBC-NCL Certificate',
    '2026-03-31',
    null,
    '2026-11-18',
  );
  assert.equal(obcOld.status, 'EXPIRED');

  const validCurrentFy = checkCertificateValidity(
    'Family Income Certificate',
    '2026-08-01',
    '2027-07-31',
    '2026-11-18',
  );
  assert.equal(validCurrentFy.status, 'VALID');

  const marksheet = checkCertificateValidity(
    'Class X Marksheet/Certificate',
    '2019-05-06',
    null,
    '2026-11-18',
  );
  assert.equal(marksheet.status, 'NOT_APPLICABLE');
});

test('calculateReadinessScore deducts 30 per critical blocker and 10 per minor warning, clamped 0-100', () => {
  assert.deepEqual(calculateReadinessScore(0, 0), {
    score: 100,
    tier: 'Ready to Submit',
  });
  assert.deepEqual(calculateReadinessScore(0, 2), {
    score: 80,
    tier: 'Needs Attention',
  });
  assert.deepEqual(calculateReadinessScore(2, 2), {
    score: 20,
    tier: 'High Rejection Risk',
  });
  assert.deepEqual(calculateReadinessScore(5, 2), {
    score: 0,
    tier: 'High Rejection Risk',
  });
});

test('buildFieldComparisonRows highlights character-level spelling diffs and buildAuditReportExportText exports full breakdown', () => {
  const sample = getSampleAuditCase().auditResult;
  const rows = buildFieldComparisonRows(sample.documents);
  const fullNameRow = rows.find((r) => r.key === 'fullName');
  assert.ok(fullNameRow);
  assert.equal(fullNameRow.rowStatus, 'WARNING');
  const aadhaarCell = fullNameRow.cells.find((c) => c.documentIndex === 1);
  assert.ok(aadhaarCell);
  assert.ok(aadhaarCell.segments.some((s) => s.kind === 'diff'));

  const bankHolderRow = rows.find((r) => r.key === 'accountHolderName');
  assert.ok(bankHolderRow);
  assert.equal(bankHolderRow.rowStatus, 'WARNING');

  const exported = buildAuditReportExportText(sample);
  assert.ok(exported.includes('SCHEME MANDATORY DOCUMENT CHECKLIST'));
  assert.ok(exported.includes('SBIN0004821'));
  assert.ok(exported.includes('XXXXXX7392'));
  assert.ok(exported.includes('Office of the Tehsildar'));
  assert.ok(exported.includes('Central Board of Secondary Education'));
});
