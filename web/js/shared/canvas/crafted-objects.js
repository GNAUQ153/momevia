import {naturalizeObject,OBJECT_APPEARANCE} from './natural-objects.js';
import {SOFT_INTERACTIONS} from './drive-soft.js';
export const CRAFT_APPEARANCE='object-crafted-v4';
export const NATURAL_OBJECT_STYLES=[OBJECT_APPEARANCE,CRAFT_APPEARANCE];
export function craftObject(model,localize){
 naturalizeObject(model,localize);
 if(model.type==='interaction'&&SOFT_INTERACTIONS.includes(model.props.kind))model.props.appearance=CRAFT_APPEARANCE;
 if(model.type==='interaction'&&model.props.kind==='camera-print')delete model.props.objectAssetId;
 return model;
}
