import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateReadinessScore,
  checkCertificateValidity,
  comparePersonNames,
  maskAadhaarNumber,
} from './compliance';

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
