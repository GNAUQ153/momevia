const definitions={
 'motion-heart':{duration:1800,keyframes:[{transform:'scale(1)'},{transform:'scale(1.055)',offset:.18},{transform:'scale(1)',offset:.32},{transform:'scale(1.04)',offset:.48},{transform:'scale(1)',offset:.65},{transform:'scale(1)'}]},
 'motion-star':{duration:3200,keyframes:[{transform:'translateY(0px) rotate(-5deg)'},{transform:'translateY(-3px) rotate(5deg)',offset:.5},{transform:'translateY(0px) rotate(-5deg)'}]},
 'motion-gift':{duration:2400,keyframes:[{transform:'translateY(0px) scale(1)'},{transform:'translateY(-8px) scale(1.025)',offset:.5},{transform:'translateY(0px) scale(1)'}]},
 'motion-leaf':{duration:3800,keyframes:[{transform:'rotate(-2deg)'},{transform:'rotate(2deg)',offset:.5},{transform:'rotate(-2deg)'}]},
 'motion-ribbon':{duration:3600,keyframes:[{transform:'translateY(0px) rotate(-1.5deg)'},{transform:'translateY(-2px) rotate(1.5deg)',offset:.5},{transform:'translateY(0px) rotate(-1.5deg)'}]},
 'motion-paper':{duration:4200,keyframes:[{transform:'perspective(1000px) rotateY(-8deg)'},{transform:'perspective(1000px) rotateY(8deg)',offset:.5},{transform:'perspective(1000px) rotateY(-8deg)'}]},
};
export function naturalMotion(id,vi,en){
 if(!Object.hasOwn(definitions,id))throw new Error('Unknown natural motion');
 return {id:'natural-'+id+'-loop-v1',speed:'normal',definition:{id:'natural-'+id+'-loop-v1',revision:1,family:'emphasis',title:{vi,en},targets:{types:['image']},animation:{engine:'keyframes',easing:'ease-in-out',iterations:'infinite',composite:'add',...structuredClone(definitions[id])}}};
}
