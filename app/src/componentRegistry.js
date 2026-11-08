import {COMPONENT_CATALOG as ARIA_CATALOG} from './componentCatalog.js';
import {EXTENDED_COMPONENT_CATALOG} from './extendedCatalog.js';
import {normalizeCatalogEntry,COMPONENT_GROUPS} from './componentTaxonomy.js';

export const COMPONENT_CATALOG=[...ARIA_CATALOG,...EXTENDED_COMPONENT_CATALOG].map(normalizeCatalogEntry);
export const COMPONENT_CATEGORIES=COMPONENT_GROUPS.map(group=>group.name);
