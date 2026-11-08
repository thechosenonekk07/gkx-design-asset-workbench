const layers = new Set(['tokens', 'components', 'patterns', 'templates', 'projects']);
const decode = value => { try { return decodeURIComponent(value || ''); } catch { return ''; } };

export function parseWorkbenchHash(hash = '') {
  const [layer, encodedId, section, encodedDeliveryId] = hash.replace(/^#/, '').split('/');
  const id = decode(encodedId);
  return { layer:layers.has(layer) ? layer : 'tokens', id,
    ...(layer === 'projects' && id && section === 'delivery' && decode(encodedDeliveryId) ? { deliveryId:decode(encodedDeliveryId) } : {}) };
}

export function workbenchHash({layer,id = '',deliveryId}) {
  if (!layers.has(layer)) return '#tokens';
  return `#${layer}${id ? `/${encodeURIComponent(id)}` : ''}${layer === 'projects' && id && deliveryId ? `/delivery/${encodeURIComponent(deliveryId)}` : ''}`;
}
