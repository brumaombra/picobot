import { calculateTotal } from '../src/pricing.js';

const actual = calculateTotal(12, 3);
const expected = 36;

if (actual !== expected) {
    console.error(`Expected ${expected}, received ${actual}`);
    process.exit(1);
}

console.log('pricing test passed');
