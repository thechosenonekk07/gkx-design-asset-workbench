import test from 'node:test';
import assert from 'node:assert/strict';
import {parseWorkbenchHash,workbenchHash} from '../src/workbenchRoute.js';

test('delivery links retain exact project and record identities through encoding',()=>{
  const route={layer:'projects',id:'项目/a #1',deliveryId:'交付/b #2'};
  assert.deepEqual(parseWorkbenchHash(workbenchHash(route)),route);
});
test('ordinary routes retain compatibility and do not acquire delivery context',()=>{
  for(const layer of ['tokens','components','patterns','templates','projects']){
    assert.deepEqual(parseWorkbenchHash(workbenchHash({layer,id:'a'})),{layer,id:'a'});
  }
  assert.equal(workbenchHash({layer:'components',id:'~new',deliveryId:'ignored'}),'#components/~new');
  assert.deepEqual(parseWorkbenchHash('#templates/a/delivery/b'),{layer:'templates',id:'a'});
});
test('invalid encodings and empty record links fall back without throwing',()=>{
  assert.deepEqual(parseWorkbenchHash('#projects/%ZZ/delivery/a'),{layer:'projects',id:''});
  assert.deepEqual(parseWorkbenchHash('#projects/a/delivery/%ZZ'),{layer:'projects',id:'a'});
  assert.deepEqual(parseWorkbenchHash('#projects/a/delivery/'),{layer:'projects',id:'a'});
  assert.deepEqual(parseWorkbenchHash(''),{layer:'tokens',id:''});
});
