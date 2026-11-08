import {DEFAULT_BINDINGS,validateDoc} from './model.js';

export const CATALOG_RELEASE = 2;

/** Add new release assets once; never replace edited records or project baselines. */
export function upgradeComponentLibrary(doc, catalog) {
  if ((doc.catalogRelease || 1) >= CATALOG_RELEASE) return doc;
  const next=JSON.parse(JSON.stringify(doc));
  const added=[];
  for(const entry of catalog.filter(c=>c.addedIn===CATALOG_RELEASE)) {
    const id=`c-${entry.kind}`;
    if(next.components.some(c=>c.id===id || (!c.custom && c.kind===entry.kind))) continue;
    const bindings={...DEFAULT_BINDINGS,...entry.bindings};
    // A library may have intentionally removed unused tokens. Reuse an existing
    // compatible binding instead of inventing or overwriting a foundation.
    for(const [key,value] of Object.entries(bindings)) {
      if(next.tokens.some(t=>t.id===value)) continue;
      const replacement=next.components.map(c=>c.bindings?.[key]).find(id=>next.tokens.some(t=>t.id===id));
      if(replacement) bindings[key]=replacement;
    }
    next.components.push({...JSON.parse(JSON.stringify(entry)),id,custom:false,bindings});
    added.push(id);
  }
  next.catalogRelease=CATALOG_RELEASE;
  if(added.length) {
    next.revision+=1;
    next.history.push({id:`catalog-release-${CATALOG_RELEASE}`,revision:next.revision,action:'补充通用组件目录',layer:'components',assetId:'catalog',name:`${added.length} 类通用组件`,ids:added});
  }
  validateDoc(next);
  return next;
}
