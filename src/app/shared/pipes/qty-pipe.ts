import { Pipe, type PipeTransform } from '@angular/core';
import { formatQty } from '../utils/format';
import type { Unit } from '../utils/qty';

/** `{{ line.qtyBase | qty: line.unit }}` → "1.250 kg" */
@Pipe({ name: 'qty' })
export class QtyPipe implements PipeTransform {
  transform(qtyBase: number | null | undefined, unit: Unit): string {
    return formatQty(qtyBase, unit);
  }
}
