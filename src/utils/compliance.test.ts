import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildComplianceMailtoUrl,
  calculateReadinessScore,
  checkCertificateValidity,
  comparePersonNames,
  getAuditWorkflowStage,
  getSampleAuditCase,
  maskAadhaarNumber,
  matchUploadedFileForDocument,
} from './compliance';
import type { UploadedDocFile } from '../types/audit';

test('buildComplianceMailtoUrl encodes score, scheme, and discrepancies into mailto URL', () => {
  const sample = getSampleAuditCase().auditResult;
  const mailtoUrl = buildComplianceMailtoUrl(sample);
  assert.ok(mailtoUrl.startsWith('mailto:?subject='));
  assert.ok(mailtoUrl.includes('&body='));
  assert.ok(!mailtoUrl.includes('+'));
  const decoded = decodeURIComponent(mailtoUrl);
  assert.ok(decoded.includes('20 / 100'));
  assert.ok(decoded.includes('High Rejection Risk'));
  assert.ok(decoded.includes('UPSC Civil Services Examination (CSE)'));
  assert.ok(decoded.includes('Aarav Kr. Sharma'));
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

test('maskAadhaarNumber masks first 8 digits of 12-digit Aadhaar IDs', () => {
  assert.equal(maskAadhaarNumber('4829 7310 9184', 'Aadhaar Card'), 'XXXX-XXXX-9184');
  assert.equal(maskAadhaarNumber('482973109184', 'Aadhaar Card'), 'XXXX-XXXX-9184');
  assert.equal(maskAadhaarNumber('1245890', 'Class X Marksheet'), '1245890');
  assert.equal(maskAadhaarNumber(null, 'Aadhaar Card'), null);
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

test('checkCertificateValidity flags expired income/OBC-NCL certificates older than 1 year or past valid-till', () => {
  const pastValidTill = checkCertificateValidity(
    'Income Certificate',
    '2025-04-10',
    '2026-04-09',
    '2026-11-15',
  );
  assert.equal(pastValidTill.status, 'EXPIRED');

  const olderThanOneYear = checkCertificateValidity(
    'OBC-NCL Certificate',
    '2025-01-01',
    null,
    '2026-11-15',
  );
  assert.equal(olderThanOneYear.status, 'EXPIRED');

  const validRecent = checkCertificateValidity(
    'Income Certificate',
    '2026-08-01',
    '2027-07-31',
    '2026-11-15',
  );
  assert.equal(validRecent.status, 'VALID');

  const marksheet = checkCertificateValidity(
    'Class X Marksheet',
    '2019-05-06',
    null,
    '2026-11-15',
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
