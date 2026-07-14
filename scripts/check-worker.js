// Simulate what buildWorkerBlobUrl will do: concat sim-core + worker glue and verify
// it parses + handles each message type correctly in a worker-like sandbox.
const fs = require('fs');
const vm = require('vm');
const src = fs.readFileSync('index.html', 'utf8');
const simCore = /<script id="sim-core">([\s\S]*?)<\/script>/.exec(src)[1];
const workerSrc = /<script id="autozuk-worker"[^>]*>([\s\S]*?)<\/script>/.exec(src)[1];
const combined = simCore + ';\n' + workerSrc;

// Fake `self` object that records postMessage calls
let posted = [];
const self = {
  postMessage(m){ posted.push(m); },
  onmessage: null,
};
const ctx = vm.createContext({ console, Math, Set, Map, Uint8Array, Infinity, NaN, isNaN, parseInt, parseFloat, JSON, self });

try { vm.runInContext(combined, ctx); } catch (e) {
  console.error('Worker combined source failed to load:', e.message);
  process.exit(1);
}
if (typeof self.onmessage !== 'function') { console.error('self.onmessage not registered'); process.exit(1); }

// Run probe inside the vm so it can see const-bound LOADOUTS
const probe = `
self._test = {};
self._test.legacyCode = parseSpawnCode('OX1OY2MOOOO');
self._test.hpCode = parseSpawnCode('OX1OY2MOOOO007221');
self._test.fullHpCode = parseSpawnCode('OOOOOOOOO999999');
self._test.badHpCode = parseSpawnCode('Y1Y2B3OOOOOX499999');
let dynamicState = hlInitState('OX1OY2MOOOO007221',{x:15,y:15},{S:true,W:true,N:true},LOADOUTS.ayak,null,12345);
let legacyAliveState = hlInitState('OX1OY2MOOOO',{x:15,y:15},{S:true,W:true,N:true},LOADOUTS.ayak,null,12345);
let legacyDeadState = hlInitState('OX1OY2MOOOO',{x:15,y:15},{S:false,W:false,N:false},LOADOUTS.ayak,null,12345);
let dynamicNibblers=dynamicState.mobs.filter(m=>m.type==='nibbler');
self._test.dynamicNibblerCount=dynamicNibblers.length;
self._test.dynamicNibblerTargets=[...new Set(dynamicNibblers.map(m=>m.pillarTargetId))];
self._test.dynamicPillarHp=Object.fromEntries(dynamicState.region.pillars.map(p=>[p.key,p.hp]));
self._test.legacyAliveNibblers=legacyAliveState.mobs.filter(m=>m.type==='nibbler').length;
self._test.legacyDeadNibblers=legacyDeadState.mobs.filter(m=>m.type==='nibbler').length;
let collapseState=hlInitState('XOOOOOOOO019999',{x:10,y:24},{S:true,W:true,N:true},LOADOUTS.ayak,null,77);
let collapsePillar=collapseState.region.pillars.find(p=>p.key==='S');
let collapseVictim=collapseState.mobs.find(m=>m.type==='meleer');
collapseState.player.x=collapsePillar.x-1;collapseState.player.y=collapsePillar.y;
collapseVictim.x=collapsePillar.x-1;collapseVictim.y=collapsePillar.y+1;
collapsePillar.hp=1;
hlDamagePillar(collapsePillar,1,5,collapseState);
self._test.collapseTick={
  collapsing:collapsePillar.collapsing,
  dead:collapsePillar.dead,
  blocked:collapseState.region.blocked[(collapsePillar.x<<6)|collapsePillar.y],
  playerEvent:collapseState.attacks.some(a=>a.isPillarCollapsePlayerDamage)
};
hlProcessPillarTransitions(collapseState,6);
self._test.nibblersKilledByCollapse=collapseState.mobs.filter(m=>m.type==='nibbler').every(m=>m.hp===0&&m.pendingRemovalTick===6);
self._test.afterCollapse={
  dead:collapsePillar.dead,
  blocked:collapseState.region.blocked[(collapsePillar.x<<6)|collapsePillar.y],
  victimHp:collapseVictim.hp,
  mobDamage:collapseState.attacks.find(a=>a.isPillarCollapseMobDamage&&a.mobId===collapseVictim.id)?.damage
};
self._test.collapsePlayerDamage=calcSimDamage(
  [{tick:5,isPillarCollapsePlayerDamage:true,pillarId:'pillarS'}],
  ['mage','mage','mage','mage'],LOADOUTS.ayak,{}
).damage;
self._test.activePillarThreat=hlHasActivePillarThreat(dynamicState);
let movementCollapse=hlRunSim('OOOOOOOOO000100',{x:15,y:15},{S:true,W:true,N:true},LOADOUTS.ayak,120,null,4242);
self._test.movementCollapse={
  status:movementCollapse.status,
  hasDelayedMobDamage:movementCollapse.attacks.some(a=>a.isPillarCollapseMobDamage),
  nibblersDead:movementCollapse.mobs.filter(m=>m.type==='nibbler').every(m=>m.dead)
};
self._test.cleanupThree = hlCleanupStopReason({
  initialEnemyCount:3, delayedBlobletSpawns:[],
  mobs:[{type:'ranger',dead:false,dying:-1}]
});
self._test.cleanupFour = hlCleanupStopReason({
  initialEnemyCount:4, delayedBlobletSpawns:[],
  mobs:[{type:'ranger',dead:false,dying:-1}]
});
self._test.cleanupBloblets = hlCleanupStopReason({
  initialEnemyCount:4, delayedBlobletSpawns:[],
  mobs:[
    {type:'blobletMage',dead:false,dying:-1},
    {type:'blobletRange',dead:false,dying:-1}
  ]
});
self._test.cleanupThreeBloblets = hlCleanupStopReason({
  initialEnemyCount:3, delayedBlobletSpawns:[],
  mobs:[
    {type:'blobletMage',dead:false,dying:-1},
    {type:'blobletRange',dead:false,dying:-1}
  ]
});
self._test.cleanupPendingBloblets = hlCleanupStopReason({
  initialEnemyCount:4, delayedBlobletSpawns:[{tick:10}],
  mobs:[{type:'blobletMage',dead:false,dying:-1}]
});
self._test.smallWaveTrapped = hlTrappedResultStatus(
  {initialEnemyCount:3},
  [{type:'ranger'}]
);
self._test.normalWaveTrapped = hlTrappedResultStatus(
  {initialEnemyCount:4},
  [{type:'ranger'}]
);
self._test.smallWaveTimeout = hlTimeoutResultStatus({initialEnemyCount:3});
self._test.normalWaveTimeout = hlTimeoutResultStatus({initialEnemyCount:4});
const testAttack = (tick,mobType,style) => ({
  tick, mobType, style, isScan:false, accRoll:0, dmgRoll:.9, mobId:tick,
  hitTick:tick+1, distAtFire:5
});
self._test.singleRangerPrayer = optimizePrayer(
  [{attacks:[testAttack(1,'ranger','range')],mobInitHP:{}}],
  'ROOOOOOOO', {S:true,W:true,N:true}, LOADOUTS.ayak
).sequence;
self._test.splitPrayer = optimizePrayer(
  [{attacks:[
    testAttack(0,'meleer','melee'),
    testAttack(2,'ranger','range')
  ],mobInitHP:{}}],
  'XOROOOOOO', {S:true,W:true,N:true}, LOADOUTS.ayak
).sequence;
self.onmessage({ data: { type:'init', pillarConfig:{S:true,W:true,N:true}, loadout: LOADOUTS.blowpipe } });
self.onmessage({ data: { type:'exclude', tiles:[{x:5,y:5},{x:15,y:15},{x:11,y:24}], spawnCode:'MRYBXOOOO' } });
self.onmessage({ data: { type:'simulate', tile:{x:15,y:15}, spawnCode:'MRYBXOOOO', loadout: LOADOUTS.blowpipe, maxTicks:400, maxSims:20, seedBase:42 } });
`;
vm.runInContext(probe, ctx);
function assertEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    process.exit(1);
  }
  console.log(`OK ${label}:`, actual);
}
assertEqual(self._test.cleanupThree, null, 'three-enemy last target keeps running');
assertEqual(self._test.cleanupFour, 'last-enemy', 'four-enemy last target stops');
assertEqual(self._test.cleanupBloblets, 'bloblets', 'bloblet-only cleanup stops');
assertEqual(self._test.cleanupThreeBloblets, null, 'three-enemy bloblets require a full clear');
assertEqual(self._test.cleanupPendingBloblets, null, 'pending bloblet spawn keeps running');
assertEqual(self._test.smallWaveTrapped, 'invalid', 'three-enemy trapped result is invalid');
assertEqual(self._test.normalWaveTrapped, 'trapped', 'four-enemy trapped result stays valid');
assertEqual(self._test.smallWaveTimeout, 'invalid', 'three-enemy timeout is invalid');
assertEqual(self._test.normalWaveTimeout, 'timeout', 'four-enemy timeout is unchanged');
assertEqual(self._test.singleRangerPrayer, ['range','range','range','range'], 'single ranger prayer fill');
assertEqual(self._test.splitPrayer, ['melee','melee','range','range'], 'neighbor prayer fill');
assertEqual(self._test.legacyCode.hasPillarHp, false, 'legacy code keeps pillar HP mode off');
assertEqual(self._test.hpCode.pillarHp, {N:0,S:72,W:21}, 'N/S/W pillar suffix parsing');
assertEqual(self._test.fullHpCode.pillarHp, {N:100,S:100,W:100}, '99 pillar value maps to 100 percent');
assertEqual(self._test.badHpCode.invalidPillarSuffix, true, 'five-digit pillar suffix is rejected');
assertEqual(self._test.badHpCode.sanitizedCode, 'Y1Y2B3OOOOOX4', 'malformed suffix trims to legacy code');
assertEqual(self._test.dynamicNibblerCount, 3, 'HP-aware code always spawns three nibblers');
assertEqual(self._test.dynamicNibblerTargets.length, 1, 'all nibblers share one pillar target');
assertEqual(self._test.dynamicPillarHp, {S:183,W:53}, 'pillar percentages convert to game HP');
assertEqual(self._test.legacyAliveNibblers, 0, 'legacy alive pillars do not spawn nibblers');
assertEqual(self._test.legacyDeadNibblers, 3, 'legacy dead pillars still spawn nibblers');
assertEqual(self._test.collapseTick, {collapsing:true,dead:false,blocked:1,playerEvent:true}, 'collapse tick stays blocked and damages player');
assertEqual(self._test.afterCollapse, {dead:true,blocked:0,victimHp:38,mobDamage:37}, 'next tick unblocks pillar and damages diagonal monster');
assertEqual(self._test.nibblersKilledByCollapse, true, 'pillar collapse fully kills every nibbler');
assertEqual(self._test.collapsePlayerDamage, 49, 'player takes floor of half current HP');
assertEqual(self._test.activePillarThreat, true, 'active pillar threat suppresses trapped shortcut');
assertEqual(self._test.movementCollapse, {status:'complete',hasDelayedMobDamage:true,nibblersDead:true}, 'nibblers path to, collapse, and leave the pillar');
console.log('OK init:', posted[0]);
console.log('OK exclude:', posted[1].excluded.length, 'excluded,', posted[1].eligible.length, 'eligible');
console.log('OK simulate:', posted[2].summary
  ? `avgDamage=${posted[2].summary.avgDamage.toFixed(1)}, totalSims=${posted[2].summary.totalSims}, prayer=${JSON.stringify(posted[2].summary.prayer)}`
  : 'null summary');
