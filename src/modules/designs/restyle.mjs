import { librarySnapshot } from '../../../web/js/shared/canvas/library-state.js';
import { randomUUID } from 'node:crypto';
import { RESTYLE_PAIRS, mapTemplateSlots, semanticSlots, captureSemanticRoles } from '../../../web/js/shared/canvas/template-slots.js';
import { createDocument } from '../../../web/js/shared/canvas/presets.js';
import { validateDocument } from '../../../web/js/shared/canvas/schema.js';
import { serverText } from '../../shared/locale.mjs';
import { hash } from './document-hash.mjs';
import { designView } from './design-views.mjs';
import { canvasError } from './errors.mjs';
import { materializeBuiltinMedia } from './builtin-media.mjs';
import {EVENT_MEDIA} from '../../../web/js/shared/canvas/event-media.js';
const requireValue=(ok,status,code,message)=>{if(!ok)throw canvasError(status,code,message);};
export async function previewRestyle(service,user,id,input,locale='vi'){
 service.requireEdit();
 const current=await service.get(user,id);
 requireValue(current.revision===input.expectedRevision && current.documentHash===input.expectedDocumentHash,409,'REVISION_CONFLICT','Thiết kế đã đổi. Lưu và xem lại trước khi tạo bản mới.');
 requireValue(current.policy.kind==='sender-basic' && !current.provenance.purpose && RESTYLE_PAIRS[current.source.templateId]?.includes(input.targetTemplateId),422,'RESTYLE_INCOMPATIBLE','Chưa có ánh xạ đã kiểm tra cho chiều đổi mẫu này.');
 await service.library?.refresh();
 const source=await service.source(current.source), target=await service.source({kind:'template',templateId:input.targetTemplateId,...(input.targetTemplateVersionId?{templateVersionId:input.targetTemplateVersionId}:{})});
 for(const resolved of [source,target]){
  requireValue(resolved.template.systemOwned===true && !resolved.version,403,'RESTYLE_LOCKED','Mẫu có vùng khóa không thuộc pilot này.');
  requireValue(!resolved.template.price || await service.checkout.hasLicense(user.sub,resolved.template.id),403,'RESTYLE_LICENSE_REQUIRED','Cần quyền dùng mẫu trước khi đổi.');
 }
 const t=(key,params)=>serverText(locale,key,params);
 const sourceDefault=createDocument({template:source.template,localize:t}),targetDefault=createDocument({template:target.template,localize:t});
 await service.assetsFor(user.sub,current.document);
 const sourceAssets=await Promise.all(current.document.assets.map(ref=>service.repository.getAsset(user.sub,ref.assetId))),byHash=new Map();
 for(const [id,spec]of Object.entries(EVENT_MEDIA)){const key='sha256:'+spec.sha256;if(!byHash.has(key))byHash.set(key,[]);byHash.get(key).push(id);}
 const builtinAssetAliases=Object.fromEntries(sourceAssets.filter(a=>byHash.has(a.contentHash)).map(a=>[a.id,byHash.get(a.contentHash)]));
 const mapped=mapTemplateSlots(current.document,sourceDefault,targetDefault,{sourceRoles:current.provenance?.slotMap?.elements,builtinAssetAliases});
 validateDocument(mapped.document);
 const plan={sourceDesignId:id,sourceRevision:current.revision,sourceHash:current.documentHash,sourceVersion:source.source.templateVersionId,targetVersion:target.source.templateVersionId,sourcePrice:source.template.price,targetPrice:target.template.price,libraryRevisions:[current.source.templateId,input.targetTemplateId].map(id=>librarySnapshot()?.items.find(r=>r.kind==='template'&&r.id===id)).filter(Boolean).map(r=>({id:r.id,revision:r.revision})),carried:mapped.carried,missing:mapped.missing,documentHash:hash(mapped.document)};
 return { ...mapped,plan,planHash:hash(plan),slots:{source:semanticSlots(sourceDefault),target:semanticSlots(targetDefault)},targetSource:target.source, targetPrice:target.template.price };
}
export async function createRestyle(service,user,id,input,locale='vi'){
 service.requireEdit();
 requireValue(typeof input.mutationId==='string' && /^[\da-f-]{36}$/i.test(input.mutationId),422,'INVALID_MUTATION','Mã thao tác không hợp lệ.');
 const requestHash=hash({restyleOf:id,...input,locale});
 const previous=await service.repository.findCreate(user.sub,input.mutationId,requestHash);
 if(previous)return {...previous,design:designView(previous.design)};
 const preview=await previewRestyle(service,user,id,input,locale);
 requireValue(preview.planHash===input.planHash,409,'RESTYLE_PLAN_CHANGED','Ánh xạ hoặc phiên bản mẫu đã đổi. Xem lại kết quả.');
 requireValue(!preview.missing.length || input.acceptMissing===true,422,'RESTYLE_MISSING_SLOTS','Giữ bản gốc hoặc xác nhận những phần không có trong mẫu đích.');
 const current=await service.get(user,id),target=await service.source(preview.targetSource),document=preview.document,now=new Date().toISOString(),newId=randomUUID();
 const assets=materializeBuiltinMedia(document,{ownerId:user.sub,designId:newId,mediaRoot:service.mediaRoot,createdAt:now});
 const owned=new Set(assets.map(a=>a.id));for(const ref of document.assets)if(!owned.has(ref.assetId))await service.assetsFor(user.sub,{assets:[ref]});
 const record={id:newId,ownerId:user.sub,title:current.title,source:target.source,provenance:{...target.provenance,startingLocale:locale,restyledFrom:{designId:id,revision:current.revision,templateVersionId:current.source.templateVersionId},slotMap:{templateVersionId:target.source.templateVersionId,elements:captureSemanticRoles(document)},restylePlanHash:preview.planHash,restyleSlots:{sourceVersion:preview.plan.sourceVersion,targetVersion:preview.plan.targetVersion,carried:preview.carried,omitted:preview.missing}},policy:{kind:'sender-basic',lockedElements:{}},revision:1,schemaVersion:document.schemaVersion,document,documentHash:hash(document),createdAt:now,updatedAt:now,archivedAt:null};
 const result=await service.repository.create(user.sub,input.mutationId,requestHash,record,assets,{id,expectedRevision:input.expectedRevision,expectedDocumentHash:input.expectedDocumentHash,templates:[{id:current.source.templateId,price:preview.plan.sourcePrice},{id:input.targetTemplateId,price:preview.plan.targetPrice}],libraryRevisions:preview.plan.libraryRevisions});
 return {...result,design:designView(result.design)};
}
