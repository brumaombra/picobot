import { calculateTotal } from './pricing.js';

export function buildReceipt(unitPrice, quantity) {
    return {
        unitPrice,
        quantity,
        total: calculateTotal(unitPrice, quantity)
    };
}
