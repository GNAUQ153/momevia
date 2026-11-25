// Momevia original vector artwork and numeric choreography, authored 2026-11-24.
// All parts use the same local 100×100 artboard, including their resting poses.
import {createElement} from './registry.js';
import {motionRow} from './motion-stack.js';
import {revisePriorityMotion,reviseOtherMotion,refineMotion} from './motion-revision-20261125.js';
const rose='#CB7799',pink='#EFC2D6',purple='#8C71AA',ink='#7B6C86',paper='#FFF4DE',gold='#D9AC62',green='#527E68',leaf='#9FBDA0',blue='#9DBFD2',white='#FFFDF8';
const path=(d,fill='none',stroke=ink,strokeWidth=1.5)=>({d,fill,stroke,strokeWidth});
const rect=(x,y,w,h,fill=paper)=>path(`M${x} ${y}h${w}v${h}h${-w}Z`,fill);
const ellipse=(x,y,rx,ry,fill)=>path(`M${x-rx} ${y}a${rx} ${ry} 0 1 0 ${2*rx} 0a${rx} ${ry} 0 1 0 ${-2*rx} 0Z`,fill);
const heart=(x,y,s=1,fill=rose)=>path(`M${x} ${y+12*s}C${x-24*s} ${y-3*s} ${x-15*s} ${y-24*s} ${x} ${y-10*s}C${x+15*s} ${y-24*s} ${x+24*s} ${y-3*s} ${x} ${y+12*s}Z`,fill);
const star=(x,y,s=1,fill=gold)=>path(`M${x} ${y-10*s}l${3*s} ${7*s} ${8*s} ${1*s} ${-6*s} ${5*s} ${2*s} ${8*s} ${-7*s} ${-4*s} ${-7*s} ${4*s} ${2*s} ${-8*s} ${-6*s} ${-5*s} ${8*s} ${-1*s}Z`,fill);
const stem=(x1,y1,x2,y2)=>path(`M${x1} ${y1}Q${x1-5} ${(y1+y2)/2} ${x2} ${y2}`,'none',green,2);
const petal=(x,y,dx,dy,fill=pink)=>path(`M${x} ${y}Q${x+dx-12} ${y+dy} ${x+dx} ${y+dy}Q${x+dx+12} ${y+dy} ${x} ${y}Z`,fill,fill===leaf?green:rose,1);
const part=(id,title,...paths)=>({id,title,anchor:{x:.5,y:.5},vector:{paths}});
const track=(target,frames,x=.5,y=.5,delayMs=0)=>({target,anchor:{x,y},delayMs,frames:frames.map(([at,v])=>({at,...v}))});
const swing=(target,angle=5,x=.5,y=.5,delay=0)=>track(target,[[0,{rotation:0}],[.2,{rotation:-angle}],[.55,{rotation:angle}],[.8,{rotation:0}],[1,{rotation:0}]],x,y,delay);
const bob=(target,amount=4,delay=0)=>track(target,[[0,{y:0}],[.45,{y:-amount}],[.8,{y:0}],[1,{y:0}]],.5,.5,delay);
const shine=target=>track(target,[[0,{opacity:.15,x:-3}],[.35,{opacity:.8,x:0}],[.65,{opacity:.15,x:3}],[1,{opacity:.15,x:-3}]]);
const draw=target=>track(target,[[0,{draw:0}],[.8,{draw:1}],[1,{draw:1}]]);
const open=(target,angle,x=.5,y=.5,delay=0)=>track(target,[[0,{rotation:angle,scaleX:.25}],[.8,{rotation:0,scaleX:1}],[1,{rotation:0,scaleX:1}]],x,y,delay);
const row=(kind,title,tracks,periodMs=4800,iterations='infinite',delayMs=0)=>({...motionRow(kind),title,tracks,periodMs,iterations,delayMs});
const entries=[];
function add(number,slug,vi,en,parts,a,b,rest){
 const group=Math.floor((number-1)/10);a.id='primary';b.id='secondary';
 for(const t of [...a.tracks,...b.tracks]){const p=parts.find(p=>p.id===t.target);if(p)p.anchor={...t.anchor};}
 entries.push({number,id:'motion-'+slug,vi,en,group,parts,rows:[a,b],rest});
}
// 01–10 · Tình yêu và gắn kết
add(1,'meeting-hearts','Đôi tim gặp nhau','Meeting hearts',[
 part('left','Tim bên trái',heart(40,50,.85,rose)),part('right','Tim bên phải',heart(60,52,.85,pink))],
 row('orbit','Hai nửa quỹ đạo elip',[track('left',[[0,{x:-10,y:0}],[.25,{x:0,y:-6}],[.5,{x:10,y:0}],[.75,{x:0,y:6}],[1,{x:-10,y:0}]]),track('right',[[0,{x:10,y:0}],[.25,{x:0,y:6}],[.5,{x:-10,y:0}],[.75,{x:0,y:-6}],[1,{x:10,y:0}]])],6000),
 row('pulse','Nảy nhẹ khi gặp',[track('left',[[0,{scaleX:1,scaleY:1}],[.24,{scaleX:1,scaleY:1}],[.3,{scaleX:1.08,scaleY:1.08}],[.38,{scaleX:1,scaleY:1}],[1,{scaleX:1,scaleY:1}]],.4,.5),track('right',[[0,{scaleX:1,scaleY:1}],[.7,{scaleX:1,scaleY:1}],[.78,{scaleX:1.08,scaleY:1.08}],[.88,{scaleX:1,scaleY:1}],[1,{scaleX:1,scaleY:1}]],.6,.52)],6000),'Hai tim chéo nhau');
add(2,'shining-ring','Nhẫn bắt sáng','Shining ring',[
 part('ring','Đai và viên đá',ellipse(50,60,21,25,gold),ellipse(50,60,16,20,paper),path('M34 32 43 22H57L66 32 50 44Z',blue),path('M34 32H66M43 22 50 44 57 22','none',white)),
 part('glint','Vệt sáng trên đá',path('M46 24 52 24 57 37 53 39Z',white,'none'))],
 row('sway','Nghiêng đai nhẫn',[swing('whole',6)],6000),row('glow','Phản sáng mặt đá',[shine('glint')],7000),'Nhẫn nghiêng nhẹ');
add(3,'red-thread-knot','Dây chỉ se duyên','Red thread knot',[
 part('knot','Nút chỉ đỏ',path('M25 58C10 31 51 26 56 51S83 78 78 48 42 32 44 54 19 78 25 58Z','none',rose,3)),
 part('ends','Hai đầu chỉ',path('M27 59Q18 71 13 76M74 56Q80 70 88 74','none',rose,2.5))],
 row('draw','Nét chỉ thành nút',[draw('knot')],3000,1),row('sway','Đầu chỉ rung khi căng',[swing('ends',4,.5,.52)],1500,1,2400),'Nút chỉ đã thắt');
add(4,'lock-and-key','Khóa và chìa nhỏ','Little lock and key',[
 part('body','Thân khóa',rect(23,48,37,30,gold),heart(41,63,.35,rose)),
 part('shackle','Quai khóa hé',path('M28 49V36C28 17 55 16 55 33','none',ink,5)),
 part('key','Chìa nhỏ',ellipse(75,49,7,7,gold),path('M69 55 53 71M57 67l5 5M61 63l5 5','none',gold,4))],
 row('orbit','Chìa vào ổ và xoay',[track('key',[[0,{x:12,y:-15,rotation:-40}],[.45,{x:0,y:0,rotation:0}],[.8,{x:0,y:0,rotation:90}],[1,{x:0,y:0,rotation:90}]],.6,.66)],2600,1),
 row('hinge','Quai khóa bật mở',[track('shackle',[[0,{y:8}],[.65,{y:8}],[.9,{y:0}],[1,{y:0}]])],3000,1),'Khóa hé mở');
add(5,'photo-locket','Mặt dây chuyền ảnh','Photo locket',[
 part('chain','Dây đeo',path('M21 13Q23 38 50 47Q76 38 79 13','none',gold,2)),
 part('inside','Tim trong mặt dây',ellipse(50,64,16,22,gold),ellipse(50,64,12,18,paper),heart(50,65,.5,rose)),
 part('lid','Nắp bản lề',path('M33 44C9 37 9 77 33 85Z',gold))],
 row('hinge','Nắp mặt dây mở',[open('lid',35,.33,.64)],2800,1),row('sway','Dây đeo đu đưa',[swing('whole',3,.5,.13)],6800),'Mặt dây mở, thấy tim');
add(6,'touching-cups','Hai tách chạm nhau','Touching teacups',[
 part('left','Tách bên trái',path('M18 49H44L42 70Q31 80 20 70Z',pink),path('M20 53C5 46 7 70 21 65','none',ink,2)),
 part('right','Tách bên phải',path('M56 49H82L80 70Q69 80 58 70Z',purple),path('M81 53C96 46 93 70 80 65','none',ink,2)),
 part('steam-a','Làn hơi thứ nhất',path('M31 42C17 31 42 30 31 19','none',rose,2)),part('steam-b','Làn hơi thứ hai',path('M69 42C54 30 80 29 69 18','none',purple,2))],
 row('sway','Hai tách nghiêng chạm',[swing('left',-8,.31,.7),swing('right',8,.69,.7)],4800),row('float','Hai làn hơi lệch nhịp',[bob('steam-a',4),bob('steam-b',5,650)],5800),'Hai tách kề nhau');
add(7,'heartbeat-paper','Nhịp tim trên giấy','Heartbeat on paper',[
 part('paper','Mảnh giấy',path('M12 26 87 23 90 76 15 79Z',paper)),part('ink','Nét mực nhịp tim',path('M20 52H29L34 40 41 65 48 34 55 61 61 48H73','none',rose,2)),part('heart','Chấm tim cuối nét',heart(78,51,.28,rose))],
 row('draw','Vẽ ba đỉnh nhịp',[draw('ink')],3000,1),row('pulse','Tim nở cuối nét',[track('heart',[[0,{scaleX:1,scaleY:1}],[.7,{scaleX:1,scaleY:1}],[.83,{scaleX:1.3,scaleY:1.3}],[1,{scaleX:1,scaleY:1}]],.78,.51)],3600,1),'Nét nhịp hoàn chỉnh và tim');
add(8,'dove-olive','Bồ câu trao nhành lá','Dove with olive branch',[
 part('body','Thân chim đậu',path('M22 63Q34 64 39 44Q45 27 60 39L66 44 76 47 65 52Q60 73 40 71L23 77Z',white),ellipse(59,43,1,1,ink),path('M40 72v7M48 72v7','none',gold,2)),
 part('wing','Cánh chim khép',path('M40 48Q22 29 23 52Q26 64 42 65Z',blue)),part('branch','Nhành lá',stem(68,49,84,61),petal(76,55,0,-7,leaf),petal(81,58,7,-2,leaf))],
 row('hinge','Cánh vỗ lúc đáp',[track('wing',[[0,{rotation:0}],[.18,{rotation:30}],[.35,{rotation:0}],[.55,{rotation:25}],[.7,{rotation:0}],[1,{rotation:0}]],.4,.5)],2600,1),row('sway','Nhành lá nảy lại',[swing('branch',8,.68,.49)],3200,1),'Chim đậu, cánh khép');
add(9,'wishing-jar','Lọ ước nguyện','Wishing jar',[
 part('jar','Lọ thủy tinh',path('M34 24H66V35Q79 44 77 78Q50 88 23 78Q21 44 34 35Z',blue),rect(32,19,36,9,gold)),part('star','Ngôi sao trong lọ',star(50,59,1.4,paper)),part('glass','Vệt sáng trên kính',path('M31 43Q25 54 29 71','none',white,3))],
 row('float','Sao nâng hạ',[bob('star',6)],6200),row('glow','Ánh sáng qua kính',[shine('glass')],7800),'Sao nằm trong lọ');
add(10,'paired-puzzle','Mảnh ghép thành đôi','Paired puzzle',[
 part('left','Mảnh ghép trái',path('M16 33H45V46C60 37 60 65 45 56V72H16Z',rose)),part('right','Mảnh ghép phải',path('M45 33H83V72H45V56C60 65 60 37 45 46Z',pink)),part('seam','Mép khớp sáng',path('M45 34V46C60 37 60 65 45 56V71','none',gold,2))],
 row('settle','Hai mảnh vào khớp',[track('left',[[0,{x:-10,rotation:-12}],[.8,{x:0,rotation:0}],[1,{x:0,rotation:0}]]),track('right',[[0,{x:10,rotation:10}],[.8,{x:0,rotation:0}],[1,{x:0,rotation:0}]])],2800,1),row('glow','Mép ghép bắt sáng',[shine('seam')],2000,1,2000),'Hai mảnh đã ghép');
// 11–20 · Sinh nhật và chúc mừng
add(11,'bow-balloon','Bóng bay buộc nơ','Balloon with bow',[
 part('balloon','Thân bóng',ellipse(50,32,20,25,pink),path('M46 57 50 51 54 57Z',rose),path('M39 21Q34 28 36 36','none',white,3)),part('ribbon','Nơ và dây',path('M50 58C48 68 57 75 49 88','none',purple,1.6),path('M50 60Q30 48 38 66Z M50 60Q69 49 63 66Z',rose))],
 row('float','Bóng nâng hạ chậm',[bob('balloon',4)],6000),row('sway','Nơ và dây trễ nhịp',[swing('ribbon',5,.5,.58,450)],6000),'Bóng thẳng dây, nơ mở');
add(12,'cake-candle','Nến bánh kem','Birthday candle',[
 part('cake','Bánh và nến',path('M20 64Q50 56 80 64V82Q50 91 20 82Z',pink),ellipse(50,64,30,7,paper),rect(46,37,8,25,purple),path('M47 45h6M47 53h6','none',pink,1.5)),part('halo','Quầng sáng',ellipse(50,28,15,17,paper)),part('flame','Lửa nến',path('M50 36C36 30 48 19 51 12C53 22 63 29 50 36Z',gold))],
 row('sway','Lửa nghiêng bất đối xứng',[track('flame',[[0,{rotation:-4,scaleX:1}],[.25,{rotation:7,scaleX:.9}],[.65,{rotation:-2,scaleX:1.1}],[1,{rotation:-4,scaleX:1}]],.5,.36)],2800),row('glow','Quầng sáng thở chậm',[track('halo',[[0,{opacity:.4,scaleX:1,scaleY:1}],[.5,{opacity:.85,scaleX:1.12,scaleY:1.12}],[1,{opacity:.4,scaleX:1,scaleY:1}]],.5,.28)],6200),'Nến có lửa tĩnh');
const confettiParts=Array.from({length:6},(_,i)=>part('paper-'+i,'Mẩu giấy '+(i+1),rect(28+i*8,24+(i%3)*8,4,6,[rose,gold,purple][i%3])));
add(13,'mini-confetti','Ống pháo giấy mini','Mini confetti popper',[
 part('tube','Ống pháo',path('M24 76 37 44 57 64Z',purple),path('M29 64 43 51M27 72 50 58','none',pink,3)),...confettiParts],
 row('settle','Ống giật lùi',[track('tube',[[0,{x:0,y:0}],[.15,{x:-4,y:4}],[.35,{x:0,y:0}],[1,{x:0,y:0}]])],1800,1),
 row('burst','Sáu mẩu giấy theo cung',confettiParts.map((p,i)=>track(p.id,[[0,{x:(3-i)*4,y:18,opacity:.2,rotation:0}],[.3,{x:(i-2.5)*2,y:-9,opacity:1,rotation:i*15}],[.85,{x:(i-2.5)*3,y:15,opacity:1,rotation:i*25}],[1,{x:0,y:0,opacity:1,rotation:0}]],.5,.5,i*45)),3200,1),'Ống pháo và sáu dải giấy');
add(14,'cheering-glasses','Hai ly nâng mừng','Cheers glasses',[
 part('left','Ly bên trái',path('M23 25H44L41 49Q34 60 26 49Z',blue),path('M34 55v23M25 80h18','none',ink,2)),part('right','Ly bên phải',path('M56 25H77L74 49Q67 60 59 49Z',blue),path('M67 55v23M58 80h18','none',ink,2)),part('water','Hai mặt nước',path('M25 41Q33 36 42 41M58 41Q67 36 75 41','none',gold,3))],
 row('sway','Hai ly nghiêng chạm',[swing('left',-9,.34,.78),swing('right',9,.67,.78)],3600,1),row('sway','Mặt nước lắng chậm',[swing('water',3,.5,.41,250)],4600,1),'Hai ly chạm nhẹ');
add(15,'tossed-graduation-cap','Mũ tốt nghiệp tung cao','Tossed graduation cap',[
 part('cap','Mũ tốt nghiệp',path('M17 42 50 27 83 42 50 57Z',purple),path('M31 49V65Q50 75 69 65V49L50 58Z',ink)),part('tassel','Tua mũ',path('M50 43 77 49V70','none',gold,2),path('M73 68h8l2 12H71Z',gold))],
 row('orbit','Mũ bay theo cung',[track('whole',[[0,{y:0,rotation:0}],[.35,{x:4,y:-14,rotation:12}],[.7,{x:0,y:0,rotation:-4}],[1,{x:0,y:0,rotation:0}]])],3800,1),row('sway','Tua quét ngược rồi rủ',[swing('tassel',-16,.77,.49,150)],4200,1),'Mũ và tua rủ');
add(16,'finish-medal','Huy chương chạm đích','Finish line medal',[
 part('tails','Hai đuôi ruy băng',path('M36 53 26 85 40 78 46 89 54 57Z',rose),path('M53 54 74 80 62 78 62 88 46 60Z',purple)),part('medal','Mặt huy chương',ellipse(50,43,24,24,gold),ellipse(50,43,19,19,paper),star(50,44,1.3,gold))],
 row('spin','Mặt huy chương bắt sáng',[track('medal',[[0,{scaleX:1}],[.35,{scaleX:.3}],[.7,{scaleX:1}],[1,{scaleX:1}]],.5,.43)],5800),row('sway','Ruy băng chuyển lệch',[swing('tails',5,.5,.54,300)],6700),'Huy chương chính diện');
add(17,'party-pinwheel','Chong chóng tiệc','Party pinwheel',[
 part('stick','Thân que',path('M50 44Q47 66 50 88','none',gold,3)),part('blades','Bốn cánh quanh chốt',path('M50 44 31 15 54 19Z',pink),path('M50 44 81 25 78 48Z',purple),path('M50 44 69 74 46 70Z',rose),path('M50 44 20 63 23 40Z',blue),ellipse(50,44,3,3,gold))],
 row('spin','Cánh quay quanh chốt',[track('blades',[[0,{rotation:0}],[1,{rotation:360}]],.5,.44)],11000),row('sway','Que cong theo gió',[swing('whole',2,.5,.88)],7200),'Bốn cánh rõ quanh chốt');
add(18,'parade-drum','Trống diễu hành','Parade drum',[
 part('body','Thân trống',path('M20 53H80V78Q50 91 20 78Z',rose),path('M23 56 35 80 48 57 62 80 77 56','none',gold,2)),part('head','Mặt trống',ellipse(50,53,30,10,paper)),part('stick-a','Dùi thứ nhất',path('M25 23 49 50','none',gold,3),ellipse(48,49,4,4,purple)),part('stick-b','Dùi thứ hai',path('M75 23 53 50','none',gold,3),ellipse(53,49,4,4,purple))],
 row('sway','Dùi gõ luân phiên',[swing('stick-a',16,.25,.23),swing('stick-b',-16,.75,.23,700)],3000),row('pulse','Mặt trống rung sau nhịp',[track('head',[[0,{scaleY:1}],[.24,{scaleY:.92}],[.35,{scaleY:1}],[.7,{scaleY:.94}],[.85,{scaleY:1}],[1,{scaleY:1}]],.5,.53)],3000),'Hai dùi trên mặt trống');
add(19,'opening-paper-fan','Quạt giấy khai tiệc','Opening paper fan',[
 part('fan','Nan quạt xòe',path('M50 76 14 42Q50 2 86 42Z',pink),path('M50 76 25 31M50 76 39 21M50 76 61 21M50 76 75 31','none',purple,1.5),ellipse(50,76,3,3,gold)),part('tassel','Tua cán quạt',path('M50 79v8M47 85h6l2 9H45Z',gold))],
 row('hinge','Xòe nan từ chốt',[open('fan',0,.5,.76)],2800,1),row('sway','Tua văng sau khi mở',[swing('tassel',14,.5,.79)],2200,1,2200),'Quạt đã xòe');
add(20,'opening-stage','Sân khấu mở màn','Opening stage',[
 part('frame','Khung sân khấu',rect(12,17,76,69,ink),rect(17,23,66,57,purple)),part('light','Vùng sáng ấm',path('M44 24H56L76 80H24Z',paper,'none')),part('left','Rèm trái đã mở',path('M16 21H30Q24 49 27 80H16Z',rose)),part('right','Rèm phải đã mở',path('M70 21H84V80H73Q76 49 70 21Z',rose)),part('top','Diềm rèm',path('M13 16H87V28Q68 38 50 27Q32 38 13 28Z',pink))],
 row('reveal','Hai rèm rút về hai bên',[track('left',[[0,{scaleX:2}],[.85,{scaleX:1}],[1,{scaleX:1}]],.16,.5),track('right',[[0,{scaleX:2}],[.85,{scaleX:1}],[1,{scaleX:1}]],.84,.5)],3200,1),row('reveal','Ánh sáng mở rộng rồi đứng',[track('light',[[0,{scaleX:.1,opacity:.2}],[.8,{scaleX:1,opacity:1}],[1,{scaleX:1,opacity:1}]],.5,.24)],3600,1),'Rèm mở, sân khấu sáng');
// 21–30 · Hoa lá và khu vườn
add(21,'opening-lotus','Sen hé nụ','Opening lotus',[
 part('water','Gợn nước',ellipse(50,79,29,5,blue)),part('outer','Lớp cánh ngoài',petal(50,72,-31,-22,pink),petal(50,72,31,-22,pink)),part('inner','Lớp cánh trong',petal(50,72,-17,-36,rose),petal(50,72,17,-36,rose),petal(50,72,0,-45,pink)),part('core','Nhụy sen',ellipse(50,70,10,4,gold))],
 row('hinge','Hai lớp cánh mở lệch',[open('outer',0,.5,.72),open('inner',0,.5,.72,450)],4200,1),row('reveal','Gợn nước nở rồi tan',[track('water',[[0,{scaleX:.6,scaleY:.6,opacity:.3}],[.7,{scaleX:1.1,scaleY:1.1,opacity:.8}],[1,{scaleX:1,scaleY:1,opacity:.35}]],.5,.79)],6000),'Sen hé nở trên nước');
add(22,'butterfly-daisy','Bướm đậu trên cúc','Butterfly on daisy',[
 part('stem','Cuống hoa',stem(46,82,50,57),petal(47,73,-18,-7,leaf)),part('flower','Đầu hoa cúc',...Array.from({length:6},(_,i)=>{const a=i*Math.PI/3;return ellipse(Math.round(50+13*Math.cos(a)),Math.round(55+13*Math.sin(a)),6,9,paper);}),ellipse(50,55,8,8,gold)),
 part('wing-a','Cánh bướm trái',path('M62 39C40 40 43 17 56 25Z',pink)),part('wing-b','Cánh bướm phải',path('M62 39C83 35 74 15 64 24Z',purple)),part('body','Thân bướm',path('M61 27 63 44M61 29 57 24M62 29 67 23','none',ink,2))],
 row('hinge','Hai cánh bướm khép mở',[track('wing-a',[[0,{scaleX:1}],[.4,{scaleX:.25}],[.75,{scaleX:1}],[1,{scaleX:1}]],.62,.39),track('wing-b',[[0,{scaleX:1}],[.4,{scaleX:.25}],[.75,{scaleX:1}],[1,{scaleX:1}]],.62,.39)],3400),row('sway','Đầu hoa trĩu nhẹ',[swing('flower',4,.5,.67,450)],5200),'Bướm nghiêng trên hoa cúc');
const seeds=Array.from({length:3},(_,i)=>part('seed-'+i,'Hạt bồ công anh '+(i+1),path(`M${62+i*9} ${27+i*8}l-3 12m3-12-5-3m5 3 5-2m-5 2 1-6`,'none',ink,1)));
add(23,'dandelion-seeds','Bồ công anh đưa hạt','Dandelion seeds',[
 part('flower','Đài và cuống',stem(36,85,40,47),ellipse(40,39,16,16,paper),path('M40 39V24M40 39 27 31M40 39 26 46M40 39 50 27M40 39 53 49','none',gold,1)),...seeds],
 row('orbit','Ba hạt trôi đường cong',seeds.map((p,i)=>track(p.id,[[0,{x:-12,y:12}],[.4,{x:0,y:-5}],[.8,{x:3,y:-2}],[1,{x:0,y:0}]],.5,.5,i*400)),5000,1),row('sway','Cuống bật lại',[swing('flower',4,.36,.85)],3600,1),'Đài hoa và ba hạt bên cạnh');
add(24,'dew-on-leaf','Giọt sương trên lá','Dew on leaf',[
 part('leaf','Lá và sống lá',path('M15 72Q24 17 81 36Q80 73 15 72Z',leaf),path('M16 72Q41 44 81 36M36 54 37 36M54 44 68 55','none',green,1.5)),part('dew','Giọt sương đầu lá',path('M78 39Q63 57 78 62Q92 57 78 39Z',blue),path('M76 49q-5 5-1 7','none',white,2))],
 row('orbit','Sương lăn rồi rơi',[track('dew',[[0,{x:-25,y:-6}],[.5,{x:0,y:0}],[.8,{x:0,y:14}],[1,{x:0,y:0}]])],4800,1),row('sway','Đầu lá nhấc nhẹ',[track('leaf',[[0,{rotation:0}],[.55,{rotation:2}],[.85,{rotation:-4}],[1,{rotation:0}]],.15,.72)],5500,1),'Sương ở đầu lá');
add(25,'sprouting-seed','Mầm cây tách vỏ','Sprouting seed',[
 part('seed','Vỏ hạt tách',path('M29 77Q30 57 49 67L47 84Z',gold),path('M51 67Q71 57 73 77L53 84Z',gold)),part('stem','Thân mầm',stem(50,78,50,39)),part('left','Lá mầm trái',petal(50,46,-25,-18,leaf)),part('right','Lá mầm phải',petal(50,46,25,-18,leaf))],
 row('reveal','Thân vươn khỏi hạt',[track('stem',[[0,{scaleY:.3}],[.8,{scaleY:1}],[1,{scaleY:1}]],.5,.78)],3500,1),row('hinge','Hai lá mở rồi dừng',[open('left',25,.5,.46),open('right',-25,.5,.46)],3600,1,800),'Mầm có hai lá mở');
add(26,'pressed-petal-book','Cánh hoa ép trong sách','Pressed petal in book',[
 part('book','Hai trang sách',path('M12 29Q31 22 49 33Q69 22 88 29V79Q66 72 49 82Q29 73 12 79Z',paper),path('M49 33v49M20 39l20 2M20 48l20 2M60 40l18-2M60 49l18-2','none',gold,1)),part('petal','Cánh hoa ló khỏi trang',petal(59,51,17,-30,pink)),part('corner','Góc trang uốn',path('M68 73 88 60V79Z',pink))],
 row('settle','Cánh hoa trượt ra',[track('petal',[[0,{y:12}],[.8,{y:0}],[1,{y:0}]])],3400,1),row('hinge','Góc giấy uốn rồi hạ',[track('corner',[[0,{scaleY:1}],[.45,{scaleY:.5}],[1,{scaleY:1}]],.88,.79)],4300,1),'Cánh hoa ló khỏi sách');
add(27,'firefly-jar','Đom đóm trong lọ','Fireflies in a jar',[
 part('jar','Lọ đêm',path('M32 24H68V34Q80 40 77 81Q50 89 23 81Q20 40 32 34Z',purple),rect(29,17,42,10,gold)),part('fly-a','Đom đóm thứ nhất',ellipse(41,51,4,4,paper)),part('fly-b','Đom đóm thứ hai',ellipse(63,68,3,3,gold))],
 row('orbit','Hai vòng bay trong lọ',[track('fly-a',[[0,{x:0,y:0}],[.25,{x:8,y:-5}],[.5,{x:12,y:3}],[.75,{x:3,y:8}],[1,{x:0,y:0}]]),track('fly-b',[[0,{x:0,y:0}],[.25,{x:-8,y:3}],[.5,{x:-10,y:-4}],[.75,{x:-3,y:-8}],[1,{x:0,y:0}]])],7000),row('glow','Ánh sáng lệch nhịp',[shine('fly-a'),{...shine('fly-b'),delayMs:1400}],5200),'Hai chấm sáng trong lọ');
add(28,'snail-after-rain','Ốc sên sau mưa','Snail after rain',[
 part('leaf','Lá sau mưa',path('M12 80Q45 53 89 76Q50 95 12 80Z',leaf)),part('body','Thân và vỏ ốc',path('M22 71Q49 65 71 68Q86 51 86 69Q79 81 22 78Z',paper),ellipse(45,57,19,18,gold),path('M45 47C29 47 33 68 46 64C56 60 48 51 42 56','none',ink,2)),part('feel-a','Râu trái',path('M77 65 76 46','none',ink,2),ellipse(76,45,2,2,ink)),part('feel-b','Râu phải',path('M82 65 89 51','none',ink,2),ellipse(89,50,2,2,ink))],
 row('settle','Ốc nhích rồi nghỉ',[track('body',[[0,{x:-4}],[.45,{x:1}],[.65,{x:0}],[1,{x:0}]])],6500),row('sway','Hai râu thăm dò',[swing('feel-a',8,.77,.65),swing('feel-b',-7,.82,.65,800)],5800),'Ốc vươn hai râu trên lá');
add(29,'garden-window','Khu vườn sau ô cửa','Garden window',[
 part('frame','Khung cửa',rect(17,17,66,69,paper),rect(25,23,50,54,blue)),part('flowers','Chậu hoa bên trong',path('M38 62H64L60 78H42Z',rose),stem(49,63,45,42),stem(55,63,62,46),ellipse(45,40,7,7,pink),ellipse(62,45,6,6,gold)),part('left','Cửa chớp trái',path('M17 22 7 27V76L17 80Z',green),path('M9 37h6M9 47h6M9 57h6M9 67h6','none',leaf,1)),part('right','Cửa chớp phải',path('M83 22 93 27V76L83 80Z',green),path('M85 37h6M85 47h6M85 57h6M85 67h6','none',leaf,1))],
 row('hinge','Cửa chớp mở dần',[open('left',0,.17,.5),open('right',0,.83,.5)],3400,1),row('sway','Chậu hoa đón gió',[swing('flowers',3,.51,.78)],6800),'Cửa mở, thấy chậu hoa');
add(30,'field-windmill','Cối xay giữa đồng','Windmill in a field',[
 part('tower','Tháp cối xay',path('M35 80 41 32 59 32 66 80Z',paper),rect(45,65,10,15,purple)),part('blades','Bốn cánh quạt',path('M48 42 48 14H56V39L52 44 79 44V52H55L50 48V77H42V52L47 47H20V39H45Z',gold),ellipse(50,45,3,3,ink)),part('grass','Cỏ chân tháp',path('M15 85Q16 71 20 72L25 83Q29 68 32 74L37 84M64 84Q69 65 72 75L76 84Q82 69 85 84','none',green,3))],
 row('spin','Cánh quay quanh trục',[track('blades',[[0,{rotation:0}],[1,{rotation:360}]],.5,.45)],15000),row('sway','Cỏ uốn theo gió',[swing('grass',3,.5,.85)],7200),'Cối xay đứng trên cỏ');
// 31–40 · Bầu trời và ánh sáng
add(31,'drawn-constellation','Chòm sao nối nét','Drawn constellation',[
 part('lines','Nét nối chòm sao',path('M20 65 38 31 65 45 81 23','none',purple,1.5)),...[[20,65],[38,31],[65,45],[81,23]].map(([x,y],i)=>part('star-'+i,'Điểm sao '+(i+1),star(x,y,.6,gold)))],
 row('reveal','Bốn sao hiện theo thứ tự',Array.from({length:4},(_,i)=>track('star-'+i,[[0,{opacity:0,scaleX:.5,scaleY:.5}],[.35,{opacity:1,scaleX:1,scaleY:1}],[1,{opacity:1,scaleX:1,scaleY:1}]],.5,.5,i*450)),1800,1),row('draw','Nối nét rồi đứng lại',[draw('lines')],3600,1,300),'Chòm bốn sao đã nối');
add(32,'silk-tailed-comet','Sao chổi đuôi lụa','Silk tailed comet',[
 part('tail','Đuôi lụa',path('M63 34Q44 76 14 71Q42 57 61 30Z',pink),path('M64 34Q45 60 24 61','none',purple,2)),part('head','Đầu sao',star(67,31,1.3,gold))],
 row('orbit','Đầu sao lướt cung',[track('head',[[0,{x:0,y:0}],[.4,{x:7,y:-3}],[.8,{x:0,y:0}],[1,{x:0,y:0}]])],6200),row('reveal','Đuôi dài rồi thu',[track('tail',[[0,{scaleX:1}],[.4,{scaleX:1.12}],[.8,{scaleX:1}],[1,{scaleX:1}]],.64,.33)],6200),'Sao và đuôi cong');
add(33,'ringed-planet','Hành tinh có vành','Ringed planet',[
 part('planet','Hành tinh',ellipse(50,48,25,25,purple)),part('bands','Vân hành tinh',path('M30 36Q50 45 70 36M26 48Q50 56 74 48M32 62Q50 67 68 62','none',pink,3)),part('satellite','Vệ tinh nhỏ',ellipse(22,62,5,5,gold)),part('ring','Vành trước',path('M17 42C-1 69 98 78 85 44M19 47C13 63 82 70 83 48','none',gold,3))],
 row('float','Vân trôi ngang',[track('bands',[[0,{x:-2}],[.5,{x:2}],[1,{x:-2}]])],12000),row('orbit','Vệ tinh trước sau vành',[track('satellite',[[0,{x:0,y:0,opacity:1}],[.3,{x:32,y:5,opacity:1}],[.55,{x:34,y:-20,opacity:.15}],[.8,{x:0,y:-20,opacity:.15}],[1,{x:0,y:0,opacity:1}]])],9000),'Hành tinh, vành và vệ tinh');
add(34,'moon-hammock','Trăng đưa võng','Moon hammock',[
 part('moon','Vầng trăng',path('M69 15C31 1 10 39 29 67Q47 91 74 68C47 78 34 59 39 40Q43 23 69 15Z',gold)),part('hammock','Võng hai điểm treo',path('M39 34 44 63Q58 77 76 57L80 30M44 63Q61 65 76 57','none',purple,2)),part('star','Sao dưới võng',path('M61 69v11','none',gold,1),star(61,85,.5,gold))],
 row('sway','Võng đu hai điểm treo',[swing('hammock',4,.6,.32)],6200),row('sway','Ngôi sao trễ nhịp',[swing('star',7,.61,.69,550)],6200),'Trăng và võng ở giữa');
const rainbowColors=[rose,gold,leaf,blue,purple];
add(35,'rainbow-clouds','Cầu vồng sau mây','Rainbow after clouds',[
 ...rainbowColors.map((c,i)=>part('arc-'+i,'Dải cầu vồng '+(i+1),path(`M${16+i*5} 70C${16+i*5} ${13+i*6} ${84-i*5} ${13+i*6} ${84-i*5} 70`,'none',c,4))),part('cloud-left','Mây trái',path('M12 76C4 63 16 56 24 62C27 50 44 57 42 70Q47 80 12 76Z',white)),part('cloud-right','Mây phải',path('M60 76C52 63 64 56 72 62C75 50 92 57 90 70Q95 80 60 76Z',white))],
 row('draw','Dải màu hiện theo cung',rainbowColors.map((_,i)=>({...draw('arc-'+i),delayMs:i*220})),3200,1),row('settle','Mây dịch nhẹ ra ngoài',[track('cloud-left',[[0,{x:6}],[.8,{x:0}],[1,{x:0}]]),track('cloud-right',[[0,{x:-6}],[.8,{x:0}],[1,{x:0}]])],3800,1),'Cầu vồng trọn vẹn');
add(36,'midautumn-lantern','Đèn lồng đêm rằm','Mid autumn lantern',[
 part('body','Thân đèn và móc',path('M50 10v12','none',ink,2),ellipse(50,45,23,25,rose),path('M41 22Q32 45 41 68M59 22Q68 45 59 68M28 45H72','none',gold,1.5),rect(38,19,24,6,gold),rect(38,67,24,6,gold)),part('tassel','Tua đèn',path('M50 73v9M45 80H55L58 94H42Z',gold),path('M47 83v9M51 83v10M54 84v8','none',rose,1))],
 row('sway','Thân lắc quanh móc',[swing('body',4,.5,.1)],6800),row('sway','Tua trễ pha, biên độ lớn',[swing('tassel',9,.5,.73,550)],6800),'Đèn buông tua');
add(37,'balloon-above-clouds','Khinh khí cầu qua mây','Balloon above clouds',[
 part('balloon','Khí cầu',path('M50 14C14 14 20 53 39 64H61C80 53 86 14 50 14Z',pink),path('M50 14C35 20 36 47 43 63M50 14C65 20 64 47 57 63','none',rose,2)),part('basket','Giỏ treo',path('M39 64 42 77M61 64 58 77','none',ink,1.5),path('M40 76H60L58 88H42Z',gold)),part('cloud','Tầng mây trước',path('M10 91C4 77 17 71 25 78C32 65 47 72 47 83C60 69 78 74 78 83C94 74 99 88 88 93Z',white))],
 row('reveal','Khí cầu nhô từ mây',[track('balloon',[[0,{y:15,opacity:.2}],[.8,{y:0,opacity:1}],[1,{y:0,opacity:1}]])],4000,1),row('sway','Giỏ nghiêng ngược chiều',[swing('basket',-4,.5,.64)],6500),'Khí cầu trên tầng mây');
add(38,'tiny-snow-globe','Quả cầu tuyết tí hon','Tiny snow globe',[
 part('glass','Quả cầu kính',ellipse(50,43,31,31,blue)),part('tree','Thông và nền tuyết',path('M50 29 37 47H43L31 64H69L57 47H63Z',green),path('M25 67Q50 60 75 67L69 73H31Z',white)),part('snow','Sáu hạt tuyết',...Array.from({length:6},(_,i)=>ellipse(32+(i%3)*17,32+Math.floor(i/3)*18,1.6,1.6,white))),part('shine','Vệt sáng kính',path('M30 30Q22 43 28 55','none',white,3)),part('base','Đế cầu',path('M29 74H71L77 87H23Z',purple),rect(23,85,54,6,gold))],
 row('burst','Tuyết khuấy rồi lắng',[track('snow',[[0,{rotation:0,y:0}],[.3,{rotation:30,y:-3}],[.6,{rotation:-15,y:5}],[1,{rotation:0,y:12}]],.5,.43)],6000,1),row('glow','Sáng trượt trên kính',[shine('shine')],7600),'Thông trên nền tuyết');
add(39,'lighthouse-beam','Hải đăng quét biển','Lighthouse beam',[
 part('beam','Chùm sáng',path('M50 31 89 18V49Z',paper,'none')),part('tower','Tháp hải đăng',path('M34 78 40 37H60L66 78Z',paper),rect(38,24,24,15,gold),path('M34 24 50 13 66 24Z',rose),path('M38 55H62M36 68H64','none',rose,5),rect(46,65,8,13,purple)),part('waves','Hai gợn sóng',path('M13 84Q24 77 35 84T57 84 79 84M18 91Q29 84 40 91T62 91 84 91','none',blue,2.5))],
 row('sway','Chùm sáng quét cửa tháp',[swing('beam',12,.5,.31)],8000),row('float','Gợn sóng trượt ngang',[track('waves',[[0,{x:-3}],[.5,{x:3}],[1,{x:-3}]])],6600),'Tháp, biển và chùm sáng');
add(40,'mini-aurora','Cực quang thu nhỏ','Miniature aurora',[
 part('sky','Nền trời đêm',path('M12 20Q50 7 88 20V80Q50 91 12 80Z',ink)),part('band-a','Dải sáng xanh',path('M16 31Q37 9 53 38T84 31V46Q65 65 48 44T16 47Z',leaf,'none')),part('band-b','Dải sáng tím',path('M17 51Q33 32 51 52T83 50V64Q63 78 47 61T17 68Z',purple,'none')),part('stars','Ba sao xa',star(26,26,.35,paper),star(71,23,.3,paper),star(75,75,.35,paper))],
 row('sway','Hai dải uốn lệch pha',[swing('band-a',3),swing('band-b',-3,.5,.5,1300)],10000),row('glow','Sao xa đổi sáng',[shine('stars')],8500),'Hai dải cực quang');
// 41–50 · Giấy thư và kỷ vật
add(41,'fountain-pen-signature','Bút máy ký tên','Fountain pen signature',[
 part('signature','Nét ký minh họa',path('M22 66C31 38 23 78 38 60S43 74 57 61S61 73 79 65','none',purple,2)),part('pen','Bút và ngòi',path('M58 46 76 18 84 24 66 52 57 58Z',ink),path('M57 58 58 46 66 52Z',gold),path('M61 51 57 58','none',paper,1))],
 row('orbit','Ngòi bút theo nét ký',[track('pen',[[0,{x:-35,y:8,rotation:0}],[.3,{x:-18,y:0,rotation:3}],[.6,{x:-6,y:5,rotation:-3}],[.8,{x:22,y:7,rotation:0}],[1,{x:22,y:7,rotation:0}]])],4200,1),row('draw','Nét mực lộ dưới ngòi',[draw('signature')],4200,1),'Bút bên nét ký hoàn chỉnh');
add(42,'postage-stamp','Con dấu bưu điện','Postage stamp',[
 part('postage','Tem thư',path('M17 40 23 37 29 40 35 37 41 40 47 37 53 40 59 37 65 40 71 37 77 40 83 37V83L77 80 71 83 65 80 59 83 53 80 47 83 41 80 35 83 29 80 23 83 17 80Z',paper),rect(26,47,48,28,pink),heart(50,62,.55,rose)),part('ink','Vòng mực lưu trên tem',ellipse(50,61,23,16,'none'),path('M34 61H66','none',ink,1)),part('stamp','Con dấu',path('M39 14Q50 7 61 14L57 30H43Z',purple),path('M29 31Q50 24 71 31V38H29Z',ink))],
 row('settle','Dấu hạ rồi nhấc',[track('stamp',[[0,{y:0}],[.4,{y:23}],[.55,{y:23}],[.8,{y:0}],[1,{y:0}]])],3000,1),row('reveal','Mực hiện từ tâm rồi lưu',[track('ink',[[0,{opacity:0,scaleX:.2,scaleY:.2}],[.4,{opacity:0,scaleX:.2,scaleY:.2}],[.65,{opacity:1,scaleX:1,scaleY:1}],[1,{opacity:1,scaleX:1,scaleY:1}]],.5,.61)],3000,1),'Tem đã đóng dấu');
add(43,'flying-paper-crane','Hạc giấy cất cánh','Flying paper crane',[
 part('body','Thân hạc giấy',path('M35 58 65 46 77 25 82 27 73 52 54 69 29 71 16 82 26 58Z',paper),path('M35 58 54 69 65 46','none',gold,1.5)),part('left','Cánh giấy trái',path('M44 58 14 25 20 65Z',pink)),part('right','Cánh giấy phải',path('M48 57 67 15 73 48Z',purple))],
 row('hinge','Cánh gập theo nếp',[track('left',[[0,{rotation:0,scaleY:1}],[.4,{rotation:-12,scaleY:.6}],[.8,{rotation:0,scaleY:1}],[1,{rotation:0,scaleY:1}]],.44,.58),track('right',[[0,{rotation:0}],[.4,{rotation:15}],[.8,{rotation:0}],[1,{rotation:0}]],.48,.57)],4200),row('float','Hạc lướt rồi lơ lửng',[bob('whole',5)],6800),'Hạc giấy xòe cánh');
add(44,'instant-camera','Máy ảnh nhả ảnh','Instant camera',[
 part('camera','Thân máy ảnh',path('M17 30H31L36 22H62L68 30H83V70H17Z',purple),rect(22,59,56,7,ink),rect(67,35,9,6,paper)),part('shutter','Màn trập',ellipse(48,43,13,13,ink),ellipse(48,43,8,8,blue)),part('photo','Ảnh minh họa',rect(32,65,36,25,paper),rect(36,69,28,15,pink),path('M36 84 45 74 51 80 57 75 64 84Z',leaf))],
 row('reveal','Màn trập khép mở',[track('shutter',[[0,{scaleX:1}],[.35,{scaleX:.1}],[.55,{scaleX:1}],[1,{scaleX:1}]],.48,.43)],1700,1),row('settle','Ảnh trượt ra rồi dừng',[track('photo',[[0,{y:-18,scaleY:.3}],[.8,{y:0,scaleY:1}],[1,{y:0,scaleY:1}]],.5,.65)],3800,1,600),'Ảnh nhô khỏi máy');
add(45,'keepsake-vinyl','Đĩa than kỷ niệm','Keepsake vinyl',[
 part('base','Bàn đĩa',rect(11,20,78,66,paper)),part('record','Đĩa than',ellipse(44,52,29,29,ink),ellipse(44,52,23,23,purple),ellipse(44,52,20,20,ink),ellipse(44,52,10,10,rose),ellipse(44,52,2,2,paper),path('M31 31Q21 39 23 50','none',blue,1)),part('arm','Cần kim',ellipse(78,31,5,5,gold),path('M78 31 72 60 61 65','none',gold,3),path('M57 63 62 62 65 69 60 71Z',ink))],
 row('spin','Đĩa quay đều',[track('record',[[0,{rotation:0}],[1,{rotation:360}]],.44,.52)],12000),row('hinge','Cần kim hạ vào rãnh',[track('arm',[[0,{rotation:-20}],[.8,{rotation:0}],[1,{rotation:0}]],.78,.31)],3000,1),'Cần kim nằm trên đĩa');
add(46,'ballerina-music-box','Hộp nhạc vũ công','Ballerina music box',[
 part('box','Hộp nhạc mở',path('M19 59 50 50 82 59V81L50 91 19 81Z',purple),path('M19 59 50 69 82 59M50 69V91','none',gold,1.5)),part('lid','Nắp hộp bản lề',path('M19 59 17 27 49 15 81 27 82 59 50 49Z',pink),path('M25 50 24 32 49 22 75 32 76 50 50 42Z',paper)),part('dancer','Vũ công trên bệ',ellipse(50,39,4,4,rose),path('M50 43v13M50 48 39 45M50 48 61 45M50 55 43 63M50 55 57 63','none',ink,2),path('M47 49 38 57Q50 64 62 57L53 49Z',rose),ellipse(50,66,10,3,gold))],
 row('hinge','Nắp hộp mở',[open('lid',0,.5,.59)],3200,1),row('spin','Vũ công xoay trên bệ',[track('dancer',[[0,{scaleX:1}],[.25,{scaleX:.15}],[.5,{scaleX:1}],[.75,{scaleX:.15}],[1,{scaleX:1}]],.5,.5)],7000,'infinite',3200),'Hộp mở, thấy vũ công');
add(47,'journey-compass','La bàn chuyến đi','Journey compass',[
 part('case','Vỏ la bàn',ellipse(50,53,33,33,gold),ellipse(50,53,28,28,paper),ellipse(50,14,5,5,'none')),part('dial','Vòng chia độ',path('M50 27v6M50 73v6M24 53h6M70 53h6M32 35l4 4M66 67l4 4M32 71l4-4M66 39l4-4','none',purple,2)),part('needle','Kim hướng đích',path('M50 29 43 58 50 54 57 58Z',rose),path('M50 77 43 58 50 54 57 58Z',blue),ellipse(50,54,3,3,gold))],
 row('settle','Kim vượt đích rồi lắng',[track('needle',[[0,{rotation:-100}],[.45,{rotation:18}],[.65,{rotation:-8}],[.82,{rotation:3}],[1,{rotation:0}]],.5,.54)],4300,1),row('spin','Vòng chia chuyển một nấc',[track('dial',[[0,{rotation:-15}],[.75,{rotation:0}],[1,{rotation:0}]],.5,.53)],2400,1),'Kim đứng tại hướng đích');
add(48,'pocket-hourglass','Đồng hồ cát bỏ túi','Pocket hourglass',[
 part('glass','Khung và hai bầu',path('M28 20H72Q70 40 54 50Q70 60 72 80H28Q30 60 46 50Q30 40 28 20Z',paper),rect(24,15,52,6,purple),rect(24,79,52,6,purple)),part('upper','Cát bầu trên',path('M33 31H67Q62 42 50 47Q38 42 33 31Z',gold)),part('lower','Cát bầu dưới',path('M33 75Q41 59 50 58Q59 59 67 75Z',gold)),part('stream','Tia cát',path('M50 48V65','none',gold,1.5))],
 row('draw','Tia cát chảy',[track('stream',[[0,{draw:.4,opacity:.7}],[.5,{draw:1,opacity:1}],[1,{draw:.4,opacity:.7}]])],2000),row('settle','Hai mực cát đồng bộ',[track('upper',[[0,{scaleY:1}],[1,{scaleY:.55}]],.5,.47),track('lower',[[0,{scaleY:.5}],[1,{scaleY:1}]],.5,.75)],9000,1),'Hai bầu còn cát');
add(49,'punched-train-ticket','Vé tàu bấm lỗ','Punched train ticket',[
 part('ticket','Vé tàu có lỗ',path('M12 43H85V76H12V65Q22 60 12 55Z',paper),path('M27 49v21M34 52H65M34 60H59M34 68H52','none',gold,1.5),ellipse(75,59,3.5,3.5,ink)),part('punch','Kìm vé',path('M51 19 76 34 79 51 70 55 68 39 47 29Z',purple),path('M48 29 69 47 70 55 78 56 76 63 65 62 61 47 43 36Z',gold)),part('disc','Mảnh giấy tròn',ellipse(80,84,3.5,3.5,pink))],
 row('hinge','Kìm khép rồi bật',[track('punch',[[0,{rotation:-8}],[.45,{rotation:8}],[.6,{rotation:8}],[1,{rotation:-8}]],.51,.25)],2400,1),row('settle','Giấy tròn rơi khỏi lỗ',[track('disc',[[0,{x:-5,y:-25,opacity:0}],[.45,{x:-5,y:-25,opacity:0}],[.6,{x:-2,y:-18,opacity:1}],[1,{x:0,y:0,opacity:1}]])],3000,1),'Vé đã bấm một lỗ');
add(50,'paper-boat-waves','Thuyền giấy trên sóng','Paper boat on waves',[
 part('boat','Thuyền giấy',path('M17 53 48 28 53 51 82 53 66 70H33Z',paper),path('M17 53 53 51 48 28M53 51 66 70M33 70 53 51 82 53','none',purple,1.5)),part('wave-a','Sóng thứ nhất',path('M13 77Q23 71 33 77T53 77 73 77 87 77','none',blue,2.5)),part('wave-b','Sóng thứ hai',path('M18 86Q28 80 38 86T58 86 78 86','none',purple,2))],
 row('float','Thuyền nhấp nhô và nghiêng',[track('boat',[[0,{y:0,rotation:-2}],[.45,{y:-4,rotation:2}],[.8,{y:0,rotation:-2}],[1,{y:0,rotation:-2}]],.5,.55)],6200),row('float','Hai nét sóng tốc độ riêng',[track('wave-a',[[0,{x:-3}],[.5,{x:3}],[1,{x:-3}]]),track('wave-b',[[0,{x:3}],[.35,{x:-2}],[.7,{x:3}],[1,{x:3}]],.5,.5,450)],7600),'Thuyền nằm trên hai nét sóng');

// Attach flexible appendages to their approved body, in the same coordinate space.
for(const [number,child,parent]of [[8,'wing','body'],[8,'branch','body'],[11,'ribbon','balloon'],[36,'tassel','body'],[37,'basket','balloon']])entries[number-1].parts.find(p=>p.id===child).parent=parent;
entries[32].parts.find(p=>p.id==='bands').clip={cx:50,cy:48,rx:24,ry:24};
entries[37].parts.find(p=>p.id==='snow').clip={cx:50,cy:43,rx:29,ry:29};
// The pen tip and ink share one measured polyline. Offsets follow cumulative
// arc length, so neither independent row relies on the other's completion.
const signaturePoints=[[22,66],[28,52],[30,68],[38,60],[43,67],[48,61],[57,61],[66,68],[79,65]],lengths=[0];
for(let i=1;i<signaturePoints.length;i++)lengths.push(lengths.at(-1)+Math.hypot(signaturePoints[i][0]-signaturePoints[i-1][0],signaturePoints[i][1]-signaturePoints[i-1][1]));
const signature=entries[40];signature.parts.find(p=>p.id==='signature').vector.paths[0].d=signaturePoints.map(([x,y],i)=>(i?'L':'M')+x+' '+y).join('');
signature.parts.find(p=>p.id==='pen').vector.paths=[path('M57 47 62 18 70 20 65 49 57 58Z',ink),path('M57 58 57 47 65 49Z',gold),path('M60 51 57 58','none',paper,1)];
signature.rows[0].tracks[0].frames=[...signaturePoints.map(([x,y],i)=>({at:Math.round(lengths[i]/lengths.at(-1)*.8*1e6)/1e6,x:x-57,y:y-58,rotation:0})),{at:1,x:22,y:7,rotation:0}];
// Folded/closed states project around a fixed hinge, rather than stretching
// the whole object. Each subsequent action still owns its own clock.
const locket=entries[4];locket.parts.find(p=>p.id==='lid').vector.paths=[ellipse(17,64,16,22,gold)];locket.rows[0].tracks=[track('lid',[[0,{x:32,scaleX:1}],[.4,{x:0,scaleX:.05}],[.8,{x:0,scaleX:1}],[1,{x:0,scaleX:1}]],.33,.64)];
entries[5].rows[0].tracks=[swing('left',-18,.31,.7),swing('right',18,.69,.7)];
for(const [i,t]of entries[12].rows[1].tracks.entries())t.frames[t.frames.length-1]={at:1,x:(i-2.5)*3,y:15,opacity:1,rotation:i*25};
const glasses=entries[13];glasses.parts.find(p=>p.id==='left').vector.paths=[path('M29 25H50L47 49Q40 60 32 49Z',blue),path('M40 55v23M31 80h18','none',ink,2)];glasses.parts.find(p=>p.id==='right').vector.paths=[path('M50 25H71L68 49Q61 60 53 49Z',blue),path('M61 55v23M52 80h18','none',ink,2)];glasses.parts.find(p=>p.id==='water').vector.paths=[path('M31 41Q39 36 48 41M52 41Q61 36 69 41','none',gold,3)];glasses.rows[0].tracks=[swing('left',-5,.4,.78),swing('right',5,.61,.78)];
const gardenWindow=entries[28];gardenWindow.parts.find(p=>p.id==='left').vector.paths=[path('M20 22 5 27V76L20 80Z',green),path('M8 37h9M8 47h9M8 57h9M8 67h9','none',leaf,1)];gardenWindow.parts.find(p=>p.id==='right').vector.paths=[path('M80 22 95 27V76L80 80Z',green),path('M83 37h9M83 47h9M83 57h9M83 67h9','none',leaf,1)];gardenWindow.rows[0].tracks=[track('left',[[0,{x:30,scaleX:2}],[.4,{x:0,scaleX:.05}],[.8,{x:0,scaleX:1}],[1,{x:0,scaleX:1}]],.2,.5),track('right',[[0,{x:-30,scaleX:2}],[.4,{x:0,scaleX:.05}],[.8,{x:0,scaleX:1}],[1,{x:0,scaleX:1}]],.8,.5)];
entries[43].parts.find(p=>p.id==='photo').clip={x:30,y:65,width:40,height:30};
entries[45].rows[0].tracks=[track('lid',[[0,{scaleY:.05}],[.8,{scaleY:1}],[1,{scaleY:1}]],.5,.59)];
const ticket=entries[48];ticket.parts[0].vector.paths.pop();ticket.parts.splice(1,0,part('hole','Lỗ vé vừa bấm',ellipse(75,59,3.5,3.5,ink)));ticket.rows[1].tracks.push(track('hole',[[0,{opacity:0}],[.45,{opacity:0}],[.6,{opacity:1}],[1,{opacity:1}]],.75,.59));
for(const e of entries)for(const r of e.rows)for(const t of r.tracks){const p=e.parts.find(p=>p.id===t.target);if(p)p.anchor={...t.anchor};}
const accents=[rose,gold,rose,gold,gold,pink,rose,blue,blue,rose,pink,pink,purple,blue,purple,gold,purple,rose,pink,rose,pink,gold,paper,leaf,leaf,pink,purple,gold,green,gold,gold,gold,purple,gold,rose,rose,pink,blue,rose,leaf,ink,ink,pink,purple,ink,purple,rose,gold,gold,paper];
revisePriorityMotion(entries);
reviseOtherMotion(entries);
refineMotion(entries);
for(const [i,e]of entries.entries()){
 e.accent=accents[i];for(const p of e.parts)for(const vector of [...p.vector.paths,...(p.poses||[]).flatMap(v=>v.paths)])for(const key of ['fill','stroke'])if(vector[key]===e.accent)vector[key]='color';
}
export const ANIMATED_GROUPS=[['Tình yêu và gắn kết','Love and connection'],['Sinh nhật và chúc mừng','Birthday and celebration'],['Hoa lá và khu vườn','Flowers and garden'],['Bầu trời và ánh sáng','Sky and light'],['Giấy thư và kỷ vật','Letters and keepsakes']];
export const ANIMATED_ELEMENTS=Object.freeze(entries);
export function animatedElementCards(group,locale='vi'){
 return entries.filter(e=>e.group===group).map(e=>({id:e.id,title:locale==='en'?e.en:e.vi,titleTexts:{vi:e.vi,en:e.en},visualKind:'animation',keywords:`${e.vi} ${e.en} ${e.rest} ${e.keywords||''} ${e.rows.map(r=>r.title).join(' ')}`,create:()=>[createElement('shape',{name:e.vi,layout:{x:0,y:0,width:220,height:220},props:{kind:'rectangle',color:e.accent,strokeWidth:0,radius:0},assembly:{version:e.assemblyVersion||1,parts:structuredClone(e.parts)},motions:{version:1,enabled:true,rows:structuredClone(e.rows)}})]}));
}
