import { test } from 'node:test';
import assert from 'node:assert/strict';
import { presentReading } from '../dist/presentation.js';
const reading=(codes,score=.95,verdict='ai_likely')=>({status:'completed',result:{ai_probability:score,verdict},signals:codes.map(code=>({code}))});
test('metadata observations never become numeric model probabilities or verified origin',()=>{
  const view=presentReading(reading(['diffusion_parameters']));assert.doesNotMatch(view.score,/%/);assert.match(view.label,/Source text/);
  assert.match(presentReading(reading(['camera_sensor_exif'],.12,'human_likely')).label,/not authenticated/);
});
test('invalid or unavailable model results stay inconclusive and unscored',()=>{
  for(const score of [NaN,Infinity,-1,2]){const view=presentReading(reading(['pixel_classifier'],score));assert.equal(view.label,'Inconclusive');assert.doesNotMatch(view.score,/%/);}
  assert.equal(presentReading(reading(['pixel_classifier','classifier_unavailable'])).label,'Inconclusive');
  assert.match(presentReading(reading(['pixel_classifier'],.8)).score,/80% model score/);
});
