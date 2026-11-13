// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Flames of Shiva contributors
// Local-only semantic rendering regression. Never copy the reference into this repository.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {DIVISIONS,chartSVG,houseBodies} from './public/kundli-model.js';
const path=process.env.KUNDLI_REFERENCE_FILE;
if(!path)throw Error('Set KUNDLI_REFERENCE_FILE to the private JSON outside this repository.');
const data=JSON.parse(readFileSync(path,'utf8'));
for(const d of Object.keys(DIVISIONS)){
 const chart=data[d];assert.equal(chart.houses.length,12);assert.equal(chart.houses[0].sign,chart.ascendant.sign);
 const bodies=chart.houses.flatMap(h=>houseBodies(chart,h));assert.equal(bodies.length,10);
 for(const style of ['north','south']){const svg=chartSVG(chart,style,d);assert.match(svg,/viewBox="0 0 600 600"/);assert.match(svg,/Asc/);assert.equal((svg.match(/class="k-(?:asc|planet)(?: k-packed)?"/g)||[]).length,10);}
}
console.log('Private reference: all 16 divisions rendered in both layouts; ascendant and 9 planets accounted for. No reference output written.');
