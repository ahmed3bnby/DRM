import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeRiskRating,
  reviewImpact,
  evaluateRiskAssessment,
  getFatfStatus,
  getGoAmlAdvice,
  isCashThresholdSector
} from '../src/lib/risk-rating';

const customer={country:'AE',nationality:'AE',industry:'consulting',delivery_channel:'face_to_face'};
const matches=[
  {recordId:'sanction-dismissed',category:'sanctions'},
  {recordId:'pep-confirmed',category:'pep'},
  {recordId:'crime-needs-info',category:'crime'},
];

test('dismissed hits never affect the customer risk model',()=>{
  const impact=reviewImpact(matches,{ 'sanction-dismissed': {record_id:'sanction-dismissed',decision:'dismissed',reason:'different person',created_at:new Date()} });
  const rating=computeRiskRating(customer,impact.flags,false);
  assert.equal(impact.flags.sanctions,undefined);
  assert.equal(impact.dismissed,1);
  assert.equal(rating.band,'low');
});

test('only confirmed matches become risk-model drivers',()=>{
  const impact=reviewImpact(matches,{
    'sanction-dismissed': {record_id:'sanction-dismissed',decision:'dismissed',reason:'different person',created_at:new Date()},
    'pep-confirmed': {record_id:'pep-confirmed',decision:'confirmed',reason:'identity verified',created_at:new Date()},
    'crime-needs-info': {record_id:'crime-needs-info',decision:'needs_info',reason:'awaiting passport',created_at:new Date()},
  });
  const rating=computeRiskRating(customer,impact.flags,false);
  assert.deepEqual(impact.flags,{pep:true});
  assert.equal(impact.confirmed,1);
  assert.equal(impact.needsInfo,1);
  assert.equal(rating.band,'medium');
  assert.deepEqual(rating.drivers,['pep']);
});

test('evaluateRiskAssessment correctly flags pending review and harmonizes risk label',()=>{
  const summary=evaluateRiskAssessment(customer, matches, {
    'sanction-dismissed': {record_id:'sanction-dismissed',decision:'dismissed',reason:'different person',created_at:new Date()},
    'crime-needs-info': {record_id:'crime-needs-info',decision:'needs_info',reason:'awaiting docs',created_at:new Date()},
  }, true);
  assert.equal(summary.isPending, true);
  assert.equal(summary.unresolvedCount, 2); // 1 unreviewed + 1 needs_info
  assert.equal(summary.statusLabelKey, 'screenReviewPending');
  assert.equal(summary.riskLabelKey, 'riskPendingValue');
});

test('evaluateRiskAssessment marks review complete when all matches decided without needs_info',()=>{
  const summary=evaluateRiskAssessment(customer, matches, {
    'sanction-dismissed': {record_id:'sanction-dismissed',decision:'dismissed',reason:'different person',created_at:new Date()},
    'pep-confirmed': {record_id:'pep-confirmed',decision:'confirmed',reason:'verified PEP',created_at:new Date()},
    'crime-needs-info': {record_id:'crime-needs-info',decision:'dismissed',reason:'false positive',created_at:new Date()},
  }, true);
  assert.equal(summary.isPending, false);
  assert.equal(summary.unresolvedCount, 0);
  assert.equal(summary.statusLabelKey, 'screenReviewComplete');
  assert.equal(summary.rating.band, 'medium');
});

test('FATF Blacklist jurisdiction receives max score 10 and mandates goAML HRC report', () => {
  const iranCustomer = { country: 'IR', nationality: 'IR', industry: 'trading', delivery_channel: 'face_to_face' as const };
  assert.equal(getFatfStatus('IR'), 'blacklist');
  assert.equal(getFatfStatus('KP'), 'blacklist');
  assert.equal(getFatfStatus('MM'), 'blacklist');
  const rating = computeRiskRating(iranCustomer);
  assert.equal(rating.factors[0].score, 10);
  assert.equal(rating.factors[1].score, 10);
  assert.equal(rating.band, 'high');

  const advice = getGoAmlAdvice(iranCustomer);
  assert.equal(advice.requiresImmediateAction, true);
  assert.equal(advice.requiresEdd, true);
  assert.ok(advice.reports.some(r => r.type === 'HRC' && r.severity === 'critical'));
});

test('FATF Blacklist customer is mandatorily elevated to high risk even with minimal or empty fields', () => {
  const minimalIran = { country: 'IR', nationality: '', industry: '', delivery_channel: '' as const };
  const rating = computeRiskRating(minimalIran);
  assert.equal(rating.band, 'high');
  assert.ok(rating.drivers.includes('fatf_blacklist'));
});

test('FATF Greylist jurisdiction receives score 7.5 and triggers goAML HRCA report and EDD', () => {
  const lebanonCustomer = { country: 'LB', nationality: 'LB', industry: 'consulting', delivery_channel: 'face_to_face' as const };
  assert.equal(getFatfStatus('LB'), 'greylist');
  assert.equal(getFatfStatus('VG'), 'greylist');
  assert.equal(getFatfStatus('YE'), 'greylist');
  assert.equal(getFatfStatus('SY'), 'greylist');
  const rating = computeRiskRating(lebanonCustomer);
  assert.equal(rating.factors[0].score, 7.5);
  assert.equal(rating.factors[1].score, 7.5);

  const advice = getGoAmlAdvice(lebanonCustomer);
  assert.equal(advice.requiresEdd, true);
  assert.ok(advice.reports.some(r => r.type === 'HRCA' && r.severity === 'high'));
});

test('Confirmed sanction hit triggers immediate goAML STR and asset freeze advisory', () => {
  const normalCustomer = { country: 'AE', nationality: 'AE', industry: 'trading', delivery_channel: 'face_to_face' as const };
  const advice = getGoAmlAdvice(normalCustomer, { sanctions: true });
  assert.equal(advice.requiresImmediateAction, true);
  const strReport = advice.reports.find(r => r.type === 'STR');
  assert.ok(strReport);
  assert.equal(strReport?.severity, 'critical');
  assert.ok(strReport?.legalBasisAr.includes('74'));
});

test('High-risk DNFBP sector triggers 50,000 AED cash threshold alert and EDD advice', () => {
  const goldCustomer = { country: 'AE', nationality: 'AE', industry: 'تجار المعادن الثمينة والأحجار الكريمة (DPMS)', delivery_channel: 'face_to_face' as const };
  assert.equal(isCashThresholdSector(goldCustomer.industry), true);
  const advice = getGoAmlAdvice(goldCustomer);
  assert.equal(advice.cashThresholdAlert, true);
  assert.ok(advice.reports.some(r => r.type === 'EDD'));
});

