// The editor stores authored sizes. Both preview and shared links use the same
// fluid reading scale; captions need not grow to the same size as body copy.
export function responsiveTextSize(model,scale){
  const authored=model.props.fontSize||24;
  const minimum=model.accessibility?.role==='heading' ? 1.25 : authored<=16 ? .8125 : authored>=28 ? 1 : .9375;
  const preferred=Math.round(authored*Math.max(.01,scale)*1000)/1000;
  return `clamp(${minimum}rem, ${preferred}px, ${Math.max(authored*2,minimum*16)}px)`;
}
export const responsiveControlSize=scale=>`clamp(.875rem, ${Math.round(16*scale*1000)/1000}px, 1.5rem)`;
