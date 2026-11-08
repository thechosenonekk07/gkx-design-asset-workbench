import test from 'node:test';
import assert from 'node:assert/strict';
import {EXTENDED_COMPONENT_CATALOG,EXTENDED_KINDS,normalizeExtendedConfig} from '../src/extendedCatalog.js';

test('new catalog assets expose complete portable configs and distinct runnable scenarios',()=>{
  assert.equal(EXTENDED_COMPONENT_CATALOG.length,16);
  assert.equal(EXTENDED_KINDS.size,16);
  for(const asset of EXTENDED_COMPONENT_CATALOG){
    assert.ok(['semantic','composed'].includes(asset.implementation),asset.kind);
    assert.ok(['基础','布局','导航','输入','展示','反馈'].includes(asset.category),asset.kind);
    assert.equal(asset.addedIn,2);
    assert.equal(asset.spec.schemaRevision,4);
    assert.deepEqual(new Set(asset.capabilities),new Set(Object.keys(asset.config)));
    assert.deepEqual(new Set(asset.spec.api.map(prop=>prop.name)),new Set(asset.capabilities));
    assert.ok(asset.spec.api.every(prop=>prop.type!=='unknown'));
    assert.ok(asset.spec.examples.length>=2);
    const configs=new Set(asset.spec.examples.map(example=>JSON.stringify(example.config)));
    assert.equal(configs.size,asset.spec.examples.length,`${asset.kind} examples must differ`);
    for(const example of asset.spec.examples){
      assert.deepEqual(new Set(Object.keys(example.config)),new Set(asset.capabilities));
      assert.deepEqual(normalizeExtendedConfig(asset.kind,example.config),example.config,`${asset.kind} example ${example.name} should already be valid`);
    }
    for(const field of ['anatomy','states','keyboard','accessibility','acceptance','tokens','sources']) assert.ok(asset.spec[field].length,`${asset.kind} ${field}`);
    assert.deepEqual(JSON.parse(JSON.stringify(asset)),asset);
  }
});

test('pagination constrains config to real boundaries instead of inventing result pages',()=>{
  assert.deepEqual({...normalizeExtendedConfig('pagination',{total:23,pageSize:10,value:99})}.value,3);
  const empty=normalizeExtendedConfig('pagination',{total:-20,pageSize:0,value:-1});
  assert.equal(empty.total,0);assert.equal(empty.pageSize,1);assert.equal(empty.value,1);
  const invalid=normalizeExtendedConfig('pagination',{total:Infinity,pageSize:'bad',value:NaN});
  assert.equal(invalid.total,120);assert.equal(invalid.pageSize,10);assert.equal(invalid.value,1);
});

test('step configuration retains a usable sequence and clamps the current step',()=>{
  const short=normalizeExtendedConfig('steps',{options:['检查','发布'],value:9});
  assert.equal(short.value,2);
  const empty=normalizeExtendedConfig('steps',{options:[],value:0});
  assert.deepEqual(empty.options,['开始']);assert.equal(empty.value,1);
});

test('long text, layout and display limits prevent invalid user-authored previews',()=>{
  const text=normalizeExtendedConfig('textarea',{value:'12345678',maxLength:5,rows:50});
  assert.equal(text.value,'12345');assert.equal(text.rows,12);
  assert.equal(normalizeExtendedConfig('drawer',{width:5000,placement:'bottom'}).width,800);
  assert.equal(normalizeExtendedConfig('drawer',{placement:'bottom'}).placement,'right');
  assert.equal(normalizeExtendedConfig('space',{gap:-30}).gap,0);
  assert.equal(normalizeExtendedConfig('skeleton',{rows:999}).rows,8);
  assert.equal(normalizeExtendedConfig('badge',{value:-1}).value,0);
});
