import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyzeDocumentText} from '../src/lib/ocr-parser';

test('passport TD3 MRZ (ICAO specimen) → name, number, DOB, sex',()=>{
  const r=analyzeDocumentText('PASSPORT\nP<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C36UTO7408122F1204159ZE184226B<<<<<10');
  assert.equal(r.documentType,'PASSPORT');
  assert.equal(r.name,'ANNA MARIA ERIKSSON');
  assert.equal(r.identifier,'L898902C3');
  assert.equal(r.dateOfBirth,'1974-08-12');
  assert.equal(r.gender,'female');
});

test('Emirates ID: the KYC identifier is the 15-digit 784 number, not the card serial',()=>{
  // TD1 line 1 = I D ARE + card serial (9) + check + optional data holding the EID number
  const mrzOnly=analyzeDocumentText('ILARE1234567890784198712345671\n8703157M2905208ARE<<<<<<<<<<<0\nAL<MANSOORI<<MOHAMMED<AHMED<<<');
  assert.equal(mrzOnly.documentType,'EMIRATES_ID');
  assert.equal(mrzOnly.identifier,'784-1987-1234567-1');
  assert.equal(mrzOnly.name,'MOHAMMED AHMED AL MANSOORI');
  assert.equal(mrzOnly.dateOfBirth,'1987-03-15');
  // When the front of the card is in the same image, its printed number is used
  const withFront=analyzeDocumentText('ID Number 784 1987 1234567 1\nILARE1234567890<<<<<<<<<<<<<<<\n8703157M2905208ARE<<<<<<<<<<<0\nAL<MANSOORI<<MOHAMMED<AHMED<<<');
  assert.equal(withFront.identifier,'784-1987-1234567-1');
});

test('trade license: the trade name stays on its own line',()=>{
  const r=analyzeDocumentText('COMMERCIAL LICENSE\nLicense No: 1234567\nTrade Name: GULF STAR GENERAL TRADING L.L.C\nLegal Type: Limited Liability Company');
  assert.equal(r.entityType,'company');
  assert.equal(r.name,'GULF STAR GENERAL TRADING L.L.C');
  assert.equal(r.identifier,'1234567');
});
